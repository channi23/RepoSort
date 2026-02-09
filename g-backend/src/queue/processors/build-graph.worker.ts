import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../db/prisma.service';
import { GeminiRunnerService } from '../../llm/gemini-runner.service';
import { GeminiService } from '../../llm/gemini.service';
import { QUEUE_NAMES } from '../queues/queue.names';
import { QUEUE_REGISTRY } from '../queue.tokens'; // Added
import { Queue } from 'bullmq'; // Added
import { Inject } from '@nestjs/common'; // Added
import { SnapshotStatus } from '@prisma/client'; // Added

type GraphHints = {
  typeByPath?: Record<string, 'DIR' | 'FILE' | 'MODULE' | 'SERVICE' | 'CONFIG' | 'SUBSYSTEM' | 'LAYER' | 'COMPONENT' | 'HOOK' | 'CLASS' | 'HANDLER' | 'CONTEXT'>;
  labelByPath?: Record<string, string>;
  dependencies?: Array<{ from: string; to: string; type: string }>;
  units?: Array<{ filePath: string; name: string; type: 'COMPONENT' | 'HOOK' | 'CLASS' | 'HANDLER' | 'CONTEXT' | 'FUNCTION'; description?: string }>;
};

@Injectable()
export class BuildGraphWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BuildGraphWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly geminiRunner: GeminiRunnerService,
    @Inject(QUEUE_REGISTRY) private readonly queues: any, // Added
  ) { }

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.BUILD_GRAPH,
      async (job: Job) => this.handle(job),
      {
        connection: { host: 'localhost', port: 6379 },
      },
    );
    this.logger.log(`BuildGraphWorker listening on queue: ${QUEUE_NAMES.BUILD_GRAPH}`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handle(job: Job) {
    const { projectId, repoSnapshotId, traceId } = job.data;

    this.logger.log(`[traceId=${traceId}] [step=BUILD_GRAPH] start project=${projectId} snapshot=${repoSnapshotId}`);

    const snapshot = await this.prisma.repoSnapshot.findUnique({ where: { id: repoSnapshotId } });
    if (!snapshot) {
      throw new Error(`RepoSnapshot not found: ${repoSnapshotId}`);
    }

    const repoRoot = snapshot.sandboxRepoPath;

    if (!repoRoot || repoRoot === 'pending' || !fs.existsSync(repoRoot)) {
      this.logger.error(`[traceId=${traceId}] [step=BUILD_GRAPH] aborting: repoRoot invalid or pending: ${repoRoot}`);
      throw new Error(`Invalid repoRoot: ${repoRoot}`);
    }

    // Idempotency Check
    const existingGraph = await this.prisma.graphSnapshot.findFirst({
      where: { repoSnapshotId, status: SnapshotStatus.COMPLETED }
    });
    if (existingGraph) {
      this.logger.log(`[traceId=${traceId}] [step=BUILD_GRAPH] already exists graph=${existingGraph.id}`);
      // Optionally trigger analyze again if needed, or just return
      // For now, let's trigger analyze just in case it was missed
      await this.queues.analyze.add(QUEUE_NAMES.ANALYZE_REPO, {
        projectId,
        graphSnapshotId: existingGraph.id,
        traceId,
      });
      return { graphSnapshotId: existingGraph.id, status: 'EXISTING' };
    }

    const hintsAttr = await this.geminiRunner.runWithGeminiFirst<GraphHints>({
      stepName: 'BUILD_GRAPH',
      traceId,
      projectId,
      geminiFn: async () => this.getGraphHintsWithGemini(repoRoot),
      fallbackFn: async () => ({ typeByPath: {}, labelByPath: {}, dependencies: [] }),
    });

    const hints = hintsAttr.value || { typeByPath: {}, labelByPath: {} };

    const graph = await this.prisma.graphSnapshot.create({
      data: {
        projectId,
        repoSnapshotId,
        status: SnapshotStatus.PROCESSING, // Set to PROCESSING
      },
    });

    try {

      const crypto = require('crypto');
      const projectNode = await this.prisma.node.create({
        data: {
          graphSnapshotId: graph.id,
          type: 'PROJECT',
          label: path.basename(repoRoot),
          path: '/',
        },
      });

      const nodesToCreate: any[] = [];
      const edgesToCreate: any[] = [];

      // Permanent Layers
      const layers = [
        { id: crypto.randomUUID(), label: 'Frontend', type: 'LAYER', path: '/frontend' },
        { id: crypto.randomUUID(), label: 'Backend', type: 'LAYER', path: '/backend' },
        { id: crypto.randomUUID(), label: 'Database', type: 'LAYER', path: '/database' },
      ];

      const [feId, beId, dbId] = layers.map(l => l.id);
      const usedLayerIds = new Set<string>();

      // We will create layers later based on usage

      const getTargetParentId = (relPath: string, entryName: string) => {
        const lower = relPath.toLowerCase();
        // Heuristics for layer categorization
        if (lower.includes('frontend') || lower.includes('web') || lower.includes('client') || lower.includes('app/')) return feId;
        if (lower.includes('backend') || lower.includes('server') || lower.includes('api/') || lower.includes('src/')) return beId;
        if (lower.includes('db') || lower.includes('database') || lower.includes('prisma') || lower.includes('.sql')) return dbId;

        // Default guess based on common project structures
        if (entryName.match(/\.(tsx|jsx|css|scss|html)$/)) return feId;
        if (entryName.match(/\.(ts|js|py|go|php)$/)) return beId;

        return beId; // Default to backend if unsure
      };

      const pendingDependencies: Array<{ fromNodeId: string; sourceDir: string; importPath: string }> = [];

      const walk = async (dirPath: string, currentPath: string) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (
            entry.name === '.git' ||
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '.next' ||
            entry.name === '.venv' ||
            entry.name === 'target' ||
            entry.name === 'vendor' ||
            entry.name === 'out' ||
            entry.name === '__pycache__' ||
            entry.name === '.npm'
          )
            continue;

          const fullPath = path.join(dirPath, entry.name);
          const relPath = path.relative(repoRoot, fullPath);
          const nodeId = crypto.randomUUID();
          const parentId = getTargetParentId(relPath, entry.name);

          // Track that this layer is used
          if ([feId, beId, dbId].includes(parentId)) {
            usedLayerIds.add(parentId);
          }

          if (entry.isDirectory()) {
            const hintType = hints.typeByPath?.[relPath];
            const nodeType = hintType && ['DIR', 'MODULE', 'SERVICE', 'CONFIG', 'SUBSYSTEM'].includes(hintType) ? hintType : 'DIR';

            nodesToCreate.push({
              id: nodeId,
              graphSnapshotId: graph.id,
              type: nodeType as any,
              label: hints.labelByPath?.[relPath] || entry.name,
              path: relPath,
            });

            edgesToCreate.push({
              graphSnapshotId: graph.id,
              type: 'CONTAINS',
              fromNodeId: parentId,
              toNodeId: nodeId,
            });

            await walk(fullPath, relPath);
          } else if (entry.isFile()) {
            const hintType = hints.typeByPath?.[relPath];
            const nodeType = hintType && ['FILE', 'MODULE', 'SERVICE', 'CONFIG'].includes(hintType) ? hintType : 'FILE';

            nodesToCreate.push({
              id: nodeId,
              graphSnapshotId: graph.id,
              type: nodeType as any,
              label: hints.labelByPath?.[relPath] || entry.name,
              path: relPath,
            });

            edgesToCreate.push({
              graphSnapshotId: graph.id,
              type: 'CONTAINS',
              fromNodeId: parentId,
              toNodeId: nodeId,
            });

            // --- SYMBOL EXTRACTION START ---
            try {
              // Only parse code files
              if (relPath.match(/\.(ts|js|tsx|jsx|py)$/)) {
                const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf-8');
                const lines = content.split('\n');

                const symbols: Array<{ type: 'FUNCTION' | 'CLASS', name: string, line: number, snippet: string }> = [];
                const imports: Array<{ path: string }> = [];

                if (relPath.match(/\.(ts|js|tsx|jsx)$/)) {
                  // Primitive regex parsing for JS/TS
                  const funcRegex = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
                  const constFuncRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/g;
                  const classRegex = /class\s+([a-zA-Z0-9_]+)/g;

                  // Import Regex: import ... from '...'
                  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
                  // Dynamic import: import('...')
                  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;


                  let match;
                  while ((match = funcRegex.exec(content)) !== null) {
                    symbols.push({ type: 'FUNCTION', name: match[1], line: 0, snippet: '' });
                  }
                  while ((match = constFuncRegex.exec(content)) !== null) {
                    symbols.push({ type: 'FUNCTION', name: match[1], line: 0, snippet: '' });
                  }
                  while ((match = classRegex.exec(content)) !== null) {
                    symbols.push({ type: 'CLASS', name: match[1], line: 0, snippet: '' });
                  }
                  while ((match = importRegex.exec(content)) !== null) {
                    imports.push({ path: match[1] });
                  }
                  while ((match = dynamicImportRegex.exec(content)) !== null) {
                    imports.push({ path: match[1] });
                  }

                } else if (relPath.endsWith('.py')) {
                  const defRegex = /def\s+([a-zA-Z0-9_]+)\s*\(/g;
                  const classRegex = /class\s+([a-zA-Z0-9_]+)/g;
                  const importRegex = /^(?:from\s+([a-zA-Z0-9_\.]+)\s+import|import\s+([a-zA-Z0-9_\.]+))/gm;

                  let match;
                  while ((match = defRegex.exec(content)) !== null) {
                    symbols.push({ type: 'FUNCTION', name: match[1], line: 0, snippet: '' });
                  }
                  while ((match = classRegex.exec(content)) !== null) {
                    symbols.push({ type: 'CLASS', name: match[1], line: 0, snippet: '' });
                  }
                  while ((match = importRegex.exec(content)) !== null) {
                    // Python imports: from x.y import z OR import x.y
                    const imp = match[1] || match[2];
                    if (imp) imports.push({ path: imp.replace(/\./g, '/') }); // Crude conversion to path
                  }
                }

                // Simple line number lookup
                if (symbols.length > 0) {
                  symbols.forEach(sym => {
                    for (let i = 0; i < lines.length; i++) {
                      if (lines[i].includes(sym.name) && (lines[i].includes('function') || lines[i].includes('const') || lines[i].includes('class') || lines[i].includes('def'))) {
                        sym.line = i + 1;
                        sym.snippet = lines.slice(i, i + 5).join('\n');
                        break;
                      }
                    }
                  });

                  for (const sym of symbols) {
                    if (!sym.line) continue;
                    const symId = crypto.randomUUID();
                    nodesToCreate.push({
                      id: symId,
                      graphSnapshotId: graph.id,
                      type: sym.type,
                      label: sym.name,
                      path: `${relPath}::${sym.name}`,
                      meta: {
                        startLine: sym.line,
                        snippet: sym.snippet,
                        fileId: nodeId
                      }
                    });
                    edgesToCreate.push({
                      graphSnapshotId: graph.id,
                      type: 'CONTAINS',
                      fromNodeId: nodeId,
                      toNodeId: symId
                    });
                  }
                }

                // Collect imports for later resolution
                if (imports.length > 0) {
                  // We need to resolve these relative paths to repo-root-relative paths
                  // and store them to create edges later.
                  // We'll store them in a temporary structure on the 'graph' object or a global map?
                  // Since we are inside 'walk', we can't easily access a global map unless passed or defined outside.
                  // 'nodesToCreate' is outside. Let's add a 'pendingDependencies' array outside 'walk'.
                  imports.forEach(imp => {
                    pendingDependencies.push({
                      fromNodeId: nodeId,
                      sourceDir: path.dirname(relPath),
                      importPath: imp.path
                    });
                  });
                }

              }
            } catch (e) {
              // Ignore read errors
            }
            // --- SYMBOL EXTRACTION END ---

            // Create semantic units for this file if they exist in hints
            if (hints.units) {
              const fileUnits = hints.units.filter(u => u.filePath === relPath);
              for (const unit of fileUnits) {
                const unitId = crypto.randomUUID();
                nodesToCreate.push({
                  id: unitId,
                  graphSnapshotId: graph.id,
                  type: unit.type as any,
                  label: unit.name,
                  path: `${relPath}::${unit.name}`,
                  meta: { description: unit.description }
                });

                edgesToCreate.push({
                  graphSnapshotId: graph.id,
                  type: 'CONTAINS',
                  fromNodeId: nodeId,
                  toNodeId: unitId,
                });
              }
            }
          }
        }
      };

      await walk(repoRoot, '');

      // Now create the layers that were actually used
      for (const layer of layers) {
        if (usedLayerIds.has(layer.id)) {
          nodesToCreate.push({
            id: layer.id,
            graphSnapshotId: graph.id,
            type: layer.type as any,
            label: layer.label,
            path: layer.path,
          });

          edgesToCreate.push({
            graphSnapshotId: graph.id,
            type: 'CONTAINS',
            fromNodeId: projectNode.id,
            toNodeId: layer.id,
          });
        } else {
          // If a layer is unused, we should re-parent any stray nodes (though our logic ensures parents are valid)
          // Check if we need to link explicitly to project node if everything was filtered out? 
          // No, if usedLayerIds doesn't have it, then no node has it as parent.
        }
      }

      // Map nodes by path for easy edge creation
      const nodeMapByPath = new Map<string, string>();
      nodesToCreate.forEach(n => {
        if (n.path) nodeMapByPath.set(n.path.replace(/\\/g, '/'), n.id);
      });
      nodeMapByPath.set('/', projectNode.id);

      // Resolve Pending Dependencies
      if (pendingDependencies.length > 0) {
        for (const dep of pendingDependencies) {
          let targetPath = '';

          // Handle relative imports
          if (dep.importPath.startsWith('.')) {
            targetPath = path.join(dep.sourceDir, dep.importPath).replace(/\\/g, '/');
          } else {
            // Absolute/Module imports - heuristic: try to find in root, or src/
            // For now, assume if it doesn't start with ., it might be a library OR a path from root (e.g. src/utils)
            targetPath = dep.importPath.replace(/\\/g, '/');
          }

          // Try to find exact match
          let targetNodeId = nodeMapByPath.get(targetPath);

          // Try extensions
          if (!targetNodeId) targetNodeId = nodeMapByPath.get(targetPath + '.ts');
          if (!targetNodeId) targetNodeId = nodeMapByPath.get(targetPath + '.tsx');
          if (!targetNodeId) targetNodeId = nodeMapByPath.get(targetPath + '.js');
          if (!targetNodeId) targetNodeId = nodeMapByPath.get(targetPath + '/index.ts');

          if (targetNodeId && targetNodeId !== dep.fromNodeId) {
            edgesToCreate.push({
              graphSnapshotId: graph.id,
              type: 'DEPENDS_ON', // Generic dependency
              fromNodeId: dep.fromNodeId,
              toNodeId: targetNodeId,
            });
          }
        }
      }

      // Create dependency edges from hints (Legacy/LLM hints)
      if (hints.dependencies) {
        for (const dep of hints.dependencies) {
          const fromId = nodeMapByPath.get(dep.from);
          const toId = nodeMapByPath.get(dep.to);
          if (fromId && toId) {
            edgesToCreate.push({
              graphSnapshotId: graph.id,
              type: dep.type as any,
              fromNodeId: fromId,
              toNodeId: toId,
            });
          }
        }
      }

      // Batch creation
      if (nodesToCreate.length > 0) {
        this.logger.log(`[traceId=${traceId}] batch creating ${nodesToCreate.length} nodes...`);
        await this.prisma.node.createMany({ data: nodesToCreate });
      }
      if (edgesToCreate.length > 0) {
        this.logger.log(`[traceId=${traceId}] batch creating ${edgesToCreate.length} edges...`);
        await this.prisma.edge.createMany({ data: edgesToCreate });
      }

      const totalNodes = nodesToCreate.length + 1;
      const totalEdges = edgesToCreate.length;

      await this.prisma.graphSnapshot.update({
        where: { id: graph.id },
        data: {
          nodeCount: totalNodes,
          edgeCount: totalEdges,
          status: SnapshotStatus.COMPLETED, // Set to COMPLETED
        },
      });

      // Trigger Next Step: Analyze
      const analyzeJob = await this.queues.analyze.add(QUEUE_NAMES.ANALYZE_REPO, {
        projectId,
        graphSnapshotId: graph.id,
        traceId,
      });

      this.logger.log(
        `[traceId=${traceId}] [step=BUILD_GRAPH] done. Enqueued ANALYZE jobId=${analyzeJob.id} graphSnapshotId=${graph.id}`,
      );

      return { graphSnapshotId: graph.id, nodeCount: totalNodes, edgeCount: totalEdges };

    } catch (error) {
      this.logger.error(`[traceId=${traceId}] [step=BUILD_GRAPH] failed: ${error}`);
      await this.prisma.graphSnapshot.update({
        where: { id: graph.id },
        data: {
          status: SnapshotStatus.FAILED,
          error: String(error).slice(0, 1000)
        }
      });
      throw error;
    }
  }

  private async getGraphHintsWithGemini(repoRoot: string): Promise<GraphHints> {
    this.gemini.assertConfigured();

    const paths: string[] = [];
    const walk = (dir: string, depth: number) => {
      if (depth <= 0) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true }).slice(0, 150)) {
        if (e.name === '.git' || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        const rel = path.relative(repoRoot, full);
        paths.push(rel + (e.isDirectory() ? '/' : ''));
        if (e.isDirectory()) walk(full, depth - 1);
      }
    };
    walk(repoRoot, 3);

    const hints = await this.gemini.generateJson<GraphHints>(
      [
        'Analyze the repository structure and code to identify hierarchy, dependencies, and semantic units.',
        '1. Hierarchy: Use CONTAINS for folder/file structure.',
        '2. Code Dependencies: Use IMPORTS or CALLS for cross-file relationships.',
        '3. Semantic Units: Identify important Components, Hooks, Classes, Handlers, and Functions INSIDE files.',
        '',
        'Return JSON:',
        '{',
        '  "typeByPath": { "path": "DIR|FILE|MODULE|SERVICE|CONFIG|SUBSYSTEM|LAYER" },',
        '  "labelByPath": { "path": "Human Label" },',
        '  "dependencies": [ { "from": "path/a", "to": "path/b", "type": "IMPORTS|CALLS|DEPENDS_ON" } ],',
        '  "units": [ { "filePath": "path/to/file.ts", "name": "MyComponent", "type": "COMPONENT|HOOK|CLASS|HANDLER|CONTEXT|FUNCTION", "description": "brief purpose" } ]',
        '}',
        'Only include keys for provided paths or important code modules.',
      ].join('\n'),
      JSON.stringify({ paths: paths.slice(0, 500) }).slice(0, 15_000),
      25_000,
    );

    if (!hints || typeof hints !== 'object') {
      throw new Error('Gemini graph hints invalid');
    }

    return {
      typeByPath: hints.typeByPath ?? {},
      labelByPath: hints.labelByPath ?? {},
      dependencies: hints.dependencies ?? [],
      units: hints.units ?? [],
    };
  }
}

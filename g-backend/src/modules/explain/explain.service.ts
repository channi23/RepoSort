import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { GeminiService } from '../../llm/gemini.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ExplainService {
    private readonly logger = new Logger(ExplainService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly gemini: GeminiService,
    ) { }

    async explainNode(projectId: string, nodeId: string): Promise<string> {
        try {
            // 1. Fetch Node with Graph and Repo Snapshot info
            const node = await this.prisma.node.findUnique({
                where: { id: nodeId },
                include: {
                    graphSnapshot: {
                        include: {
                            repoSnapshot: true,
                        },
                    },
                },
            });

            if (!node) {
                return "Node not found.";
            }

            let context = `Node: ${node.label} (${node.type})`;

            // 2. Determine Context based on Node Type
            const sandboxPath = node.graphSnapshot?.repoSnapshot?.sandboxRepoPath;

            if (!sandboxPath) {
                this.logger.warn(`No sandbox path found for node ${nodeId}. Using basic description.`);
                context += `\n\nNote: Repository files not available for detailed analysis.`;
            } else {
                // Heuristic: If path is stored in node, use it. Otherwise try to find file by label match in sandbox.
                const relPath = node.path || node.label;
                const fullPath = path.join(sandboxPath, relPath);

                try {
                    const stats = await fs.stat(fullPath);

                    if (stats.isDirectory()) {
                        // For Directories: List contents
                        try {
                            const files = await fs.readdir(fullPath);
                            const fileList = files.slice(0, 20).join('\n- '); // Limit to 20 files
                            context += `\n\nDirectory Contents (Top 20):\n- ${fileList}`;
                            if (files.length > 20) context += `\n... and ${files.length - 20} more.`;
                        } catch (dirErr) {
                            this.logger.warn(`Could not list directory ${fullPath}: ${dirErr}`);
                        }

                    } else if (stats.isFile()) {
                        // For Files: Read content based on extension
                        const ext = path.extname(fullPath).toLowerCase();

                        // Text-based formats we can read directly
                        const textExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.json', '.xml', '.csv', '.md', '.txt', '.html', '.css', '.scss', '.yaml', '.yml', '.sql', '.sh', '.bat', '.ps1'];

                        if (textExtensions.includes(ext)) {
                            const content = await fs.readFile(fullPath, 'utf-8');
                            // Limit context size, but maybe a bit more generous for CSVs/JSONs to capture structure
                            const limit = (ext === '.csv' || ext === '.json') ? 3000 : 2000;
                            context += `\n\nFile Content Preview:\n${content.slice(0, limit)}`;
                        } else if (ext === '.xlsx' || ext === '.xls') {
                            context += `\n\n[Excel File] Binary content not displayed. Analyzing generic purpose based on filename.`;
                        } else {
                            // Attempt to read as text but fallback if binary chars found? 
                            // For safety, just say Binary or Unknown
                            context += `\n\n[Binary/Other File] Content not displayed.`;
                        }
                    }
                } catch (fsError) {
                    this.logger.warn(`Could not access path ${fullPath} for node ${node.label}: ${fsError}`);
                    context += `\n\nNote: File system access failed. Using node metadata only.`;
                }
            }

            const systemPrompt = `You are an expert code and data analyzer. 
            - For code, explain the purpose of the component.
            - For data files (CSV, JSON, Excel), explain the structure and likely content.
            - For directories, explain what kind of module or package it represents based on its name and contents.
            Keep it concise (max 3 sentences). Focus on what it IS and DOES.`;

            const userPrompt = `
        Explain the following item:
        ${context}
      `;

            const result = await this.gemini.generateText(systemPrompt, userPrompt);
            return result;

        } catch (e) {
            this.logger.error(`Failed to explain node ${nodeId}`, e);
            throw e;
        }
    }
}

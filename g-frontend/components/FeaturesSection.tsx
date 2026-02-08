"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  Node,
  Edge,
  NodeChange,
  applyNodeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import FeatureCard from "./FeatureCard";

// Node type colors
const nodeColors: Record<string, string> = {
  root: "#4F46E5",
  system: "#059669",
  layer: "#DC2626",
  folder: "#D97706",
  file: "#7C3AED",
};

// Type definitions
interface HierarchyNode {
  label: string;
  type: string;
  children?: string[];
  details?: {
    functions?: string[];
    components?: string[];
    imports?: string[];
    exports?: string[];
  };
  connections?: string[]; // IDs of nodes this connects to
}

type HierarchyMap = Record<string, HierarchyNode>;

// Hierarchical data structure with details
const hierarchy: HierarchyMap = {
  project: {
    label: "Your Codebase",
    type: "root",
    children: ["frontend", "backend", "database"],
  },
  frontend: {
    label: "Frontend",
    type: "system",
    children: ["ui"],
    details: {
      components: ["Pages", "Components", "Layouts"],
    },
  },
  backend: {
    label: "Backend",
    type: "system",
    children: ["api"],
    details: {
      components: ["Controllers", "Services", "Auth"],
    },
  },
  database: {
    label: "Database",
    type: "system",
    children: ["db"],
    details: {
      components: ["Tables", "Indexes", "Migrations"],
    },
  },
  ui: {
    label: "UI",
    type: "layer",
    children: ["pages", "components"],
  },
  pages: {
    label: "Pages",
    type: "folder",
    children: ["home", "dashboard"],
  },
  components: {
    label: "Components",
    type: "folder",
    children: ["navbar", "card"],
  },
  home: {
    label: "Home.tsx",
    type: "file",
    details: {
      components: ["HeroSection", "FeatureCards", "Footer"],
      functions: ["handleScroll", "loadData"],
      imports: ["React", "FeatureCard", "Navbar"],
    },
    connections: ["navbar", "card"],
  },
  dashboard: {
    label: "Dashboard.tsx",
    type: "file",
    details: {
      components: ["Header", "StatsCards", "RepoTable"],
      functions: ["fetchRepos", "handleRefresh", "exportData"],
      imports: ["React", "Card", "Navbar"],
    },
    connections: ["navbar", "card", "repoCtrl"],
  },
  navbar: {
    label: "Navbar.tsx",
    type: "file",
    details: {
      components: ["Logo", "NavLinks", "UserMenu"],
      functions: ["handleAuth", "toggleMenu"],
      imports: ["React", "Link"],
      exports: ["Navbar"],
    },
    connections: ["authSvc"],
  },
  card: {
    label: "Card.tsx",
    type: "file",
    details: {
      components: ["CardHeader", "CardBody", "CardFooter"],
      functions: ["handleClick"],
      imports: ["React"],
      exports: ["Card"],
    },
  },
  api: {
    label: "API",
    type: "layer",
    children: ["controllers", "services"],
  },
  controllers: {
    label: "Controllers",
    type: "folder",
    children: ["userCtrl", "repoCtrl"],
  },
  services: {
    label: "Services",
    type: "folder",
    children: ["authSvc", "graphSvc"],
  },
  userCtrl: {
    label: "UserController.ts",
    type: "file",
    details: {
      functions: ["getUsers", "createUser", "updateUser", "deleteUser"],
      imports: ["AuthService", "UserModel"],
    },
    connections: ["authSvc", "users"],
  },
  repoCtrl: {
    label: "RepoController.ts",
    type: "file",
    details: {
      functions: ["getRepos", "createRepo", "analyzeRepo", "deleteRepo"],
      imports: ["GraphService", "RepoModel"],
    },
    connections: ["graphSvc", "repos"],
  },
  authSvc: {
    label: "AuthService.ts",
    type: "file",
    details: {
      functions: ["login", "logout", "verifyToken", "refreshToken"],
      imports: ["JWT", "bcrypt", "UserModel"],
      exports: ["AuthService"],
    },
    connections: ["jwt", "users"],
  },
  graphSvc: {
    label: "GraphService.ts",
    type: "file",
    details: {
      functions: ["analyzeDependencies", "findCycles", "calculateMetrics"],
      imports: ["Graph", "DFS", "BFS"],
      exports: ["GraphService"],
    },
  },
  jwt: {
    label: "JWT.ts",
    type: "file",
    details: {
      functions: ["sign", "verify", "decode"],
      imports: ["jsonwebtoken"],
      exports: ["JWT"],
    },
  },
  oauth: {
    label: "OAuth.ts",
    type: "file",
    details: {
      functions: ["githubAuth", "googleAuth", "handleCallback"],
      imports: ["passport"],
      exports: ["OAuth"],
    },
  },
  db: {
    label: "Database",
    type: "layer",
    children: ["tables", "indexes"],
  },
  tables: {
    label: "Tables",
    type: "folder",
    children: ["users", "repos"],
  },
  indexes: {
    label: "Indexes",
    type: "folder",
    children: ["userIdx", "repoIdx"],
  },
  users: {
    label: "users",
    type: "file",
    details: {
      components: ["id", "email", "password_hash", "created_at"],
    },
  },
  repos: {
    label: "repositories",
    type: "file",
    details: {
      components: ["id", "name", "owner_id", "created_at"],
    },
  },
  userIdx: {
    label: "users_email_idx",
    type: "file",
    details: {
      components: ["email (unique, btree)"],
    },
  },
  repoIdx: {
    label: "repos_owner_idx",
    type: "file",
    details: {
      components: ["owner_id (btree)"],
    },
  },
};

// Custom node component
function ExpandableNode({ id, data }: any) {
  const color = nodeColors[data.type] || "#6B7280";
  const hasChildren = data.hasChildren;
  const isExpanded = data.isExpanded;
  const showDetails = data.showDetails;
  const nodeInfo = hierarchy[id];

  return (
    <div
      className="relative cursor-pointer hover:scale-105 transition-transform"
      style={{
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: showDetails ? "scale(1.15)" : isExpanded ? "scale(1.05)" : "scale(1)",
      }}
    >
      <div
        className="rounded-xl border-2 font-semibold text-sm shadow-lg bg-white overflow-hidden"
        style={{
          borderColor: color,
          minWidth: showDetails ? "280px" : "140px",
          maxWidth: showDetails ? "320px" : "160px",
          boxShadow: showDetails
            ? `0 20px 40px -10px ${color}80`
            : isExpanded
            ? `0 10px 25px -5px ${color}60`
            : `0 4px 6px -1px ${color}30`,
        }}
      >
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span style={{ color }} className="truncate">{data.label}</span>
          </div>
          {hasChildren && (
            <div
              className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0"
              style={{
                backgroundColor: `${color}20`,
                color: color,
                transform: isExpanded ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 0.3s ease",
              }}
            >
              +
            </div>
          )}
        </div>

        {/* Details Panel */}
        {showDetails && nodeInfo?.details && (
          <div 
            className="border-t px-4 py-3 text-xs overflow-y-auto"
            style={{ 
              borderColor: `${color}20`,
              maxHeight: "300px",
            }}
          >
            {nodeInfo.details.functions && (
              <div className="mb-3">
                <div className="font-bold text-black/60 mb-1.5 uppercase tracking-wide" style={{ fontSize: "10px" }}>
                  Functions
                </div>
                <div className="space-y-1">
                  {nodeInfo.details.functions.slice(0, 5).map((fn, i) => (
                    <div
                      key={i}
                      className="px-2 py-1 rounded text-[11px] font-mono truncate"
                      style={{ backgroundColor: `${color}10`, color }}
                      title={fn}
                    >
                      {fn}()
                    </div>
                  ))}
                  {nodeInfo.details.functions.length > 5 && (
                    <div className="text-[10px] text-gray-500 italic">
                      +{nodeInfo.details.functions.length - 5} more...
                    </div>
                  )}
                </div>
              </div>
            )}

            {nodeInfo.details.components && (
              <div className="mb-3">
                <div className="font-bold text-black/60 mb-1.5 uppercase tracking-wide" style={{ fontSize: "10px" }}>
                  Components
                </div>
                <div className="space-y-1">
                  {nodeInfo.details.components.slice(0, 5).map((comp, i) => (
                    <div
                      key={i}
                      className="px-2 py-1 rounded text-[11px] truncate"
                      style={{ backgroundColor: `${color}10`, color }}
                      title={comp}
                    >
                      {comp}
                    </div>
                  ))}
                  {nodeInfo.details.components.length > 5 && (
                    <div className="text-[10px] text-gray-500 italic">
                      +{nodeInfo.details.components.length - 5} more...
                    </div>
                  )}
                </div>
              </div>
            )}

            {nodeInfo.details.imports && (
              <div className="mb-2">
                <div className="font-bold text-black/60 mb-1 uppercase tracking-wide" style={{ fontSize: "10px" }}>
                  Imports
                </div>
                <div className="text-[10px] text-black/60 truncate" title={nodeInfo.details.imports.join(", ")}>
                  {nodeInfo.details.imports.slice(0, 3).join(", ")}
                  {nodeInfo.details.imports.length > 3 && "..."}
                </div>
              </div>
            )}

            {/* Expand Network Button */}
            {nodeInfo.connections && nodeInfo.connections.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (data.onExpandNetwork) {
                    data.onExpandNetwork(id);
                  }
                }}
                className="mt-3 w-full py-2 rounded-lg font-semibold text-xs transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: color,
                  color: "white",
                }}
              >
                🔗 Expand Network ({nodeInfo.connections.length})
              </button>
            )}
          </div>
        )}
      </div>

      {data.hasTarget && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !bg-white"
          style={{ borderColor: color }}
        />
      )}
      {(hasChildren || (nodeInfo?.connections && nodeInfo.connections.length > 0)) && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !bg-white"
          style={{ borderColor: color }}
        />
      )}
    </div>
  );
}

function GraphContent() {
  const [expandedNodes, setExpandedNodes] = useState(new Set(["project"]));
  const [detailedNode, setDetailedNode] = useState<string | null>(null);
  const [networkExpandedNodes, setNetworkExpandedNodes] = useState(new Set<string>());
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { fitView } = useReactFlow();

  // Define handleExpandNetwork BEFORE useMemo
  const handleExpandNetwork = useCallback((nodeId: string) => {
    setNetworkExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // Build graph structure
  const initialGraph = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];
    const processedNodes = new Set<string>();

    function addNode(id: string, depth: number, x: number, y: number, parentId: string | null = null) {
      if (processedNodes.has(id)) return;
      processedNodes.add(id);

      const nodeData = hierarchy[id];
      if (!nodeData) return;

      const isExpanded = expandedNodes.has(id);
      const hasChildren = nodeData.children && nodeData.children.length > 0;
      const showDetails = detailedNode === id;

      nodeList.push({
        id,
        type: "expandable",
        data: {
          label: nodeData.label,
          type: nodeData.type,
          hasChildren,
          isExpanded,
          showDetails,
          hasTarget: parentId !== null,
          onExpandNetwork: handleExpandNetwork,
        },
        position: { x, y },
        draggable: true,
      });

      // Add hierarchical children
      if (isExpanded && hasChildren) {
        const childCount = nodeData.children!.length;
        const spacing = 200;
        nodeData.children!.forEach((childId, index) => {
          const childX = x + (index - (childCount - 1) / 2) * spacing;
          const childY = y + 140;
          
          addNode(childId, depth + 1, childX, childY, id);

          edgeList.push({
            id: `${id}-${childId}`,
            source: id,
            target: childId,
            animated: true,
            style: {
              stroke: nodeColors[nodeData.type] || "#6B7280",
              strokeWidth: 2,
            },
            type: "smoothstep",
          });
        });
      }

      // Add network connections (when expanded)
      if (networkExpandedNodes.has(id) && nodeData.connections) {
        nodeData.connections.forEach((connId, index) => {
          const connNode = hierarchy[connId];
          if (!connNode || processedNodes.has(connId)) return;

          // Position connected nodes around the source
          const angle = (index / nodeData.connections!.length) * Math.PI * 2;
          const radius = 250;
          const connX = x + Math.cos(angle) * radius;
          const connY = y + Math.sin(angle) * radius;

          addNode(connId, depth, connX, connY, id);

          edgeList.push({
            id: `network-${id}-${connId}`,
            source: id,
            target: connId,
            animated: true,
            style: {
              stroke: "#F59E0B",
              strokeWidth: 2,
              strokeDasharray: "5,5",
            },
            type: "smoothstep",
            label: "uses",
            labelStyle: { fontSize: 10, fill: "#F59E0B" },
          });
        });
      }
    }

    addNode("project", 0, 400, 50);
    return { nodes: nodeList, edges: edgeList };
  }, [expandedNodes, detailedNode, networkExpandedNodes, handleExpandNetwork]);

  // Update nodes and edges
  useEffect(() => {
    setNodes(initialGraph.nodes);
    setEdges(initialGraph.edges);
  }, [initialGraph]);

  // Handle node dragging
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Mark that user has interacted (dragged/moved nodes)
      const hasDragChange = changes.some(c => c.type === 'position' && (c as any).dragging);
      if (hasDragChange) {
        setHasUserInteracted(true);
      }
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  // Initial fit view only
  useEffect(() => {
    if (!isInitialized && nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.3, duration: 600, maxZoom: 1.5 });
        setIsInitialized(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, isInitialized, fitView]);

  // Auto-fit only when structure changes AND user hasn't manually interacted
  useEffect(() => {
    if (!hasUserInteracted && isInitialized) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.3, duration: 600, maxZoom: 1.5 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expandedNodes.size, networkExpandedNodes.size, hasUserInteracted, isInitialized, fitView]);

  const handleNodeClick = useCallback((event: any, node: any) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Node clicked:', node.id); // DEBUG
    
    const nodeData = hierarchy[node.id];
    if (!nodeData) return;

    // If node has details, show them
    if (nodeData.details) {
      console.log('Toggling details for:', node.id); // DEBUG
      if (detailedNode === node.id) {
        setDetailedNode(null);
      } else {
        setDetailedNode(node.id);
      }
      return;
    }

    // Otherwise expand/collapse children
    const hasChildren = nodeData.children && nodeData.children.length > 0;
    if (!hasChildren) return;

    console.log('Toggling expansion for:', node.id); // DEBUG
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(node.id)) {
        // Collapse - just remove this node, keep children visible
        newSet.delete(node.id);
      } else {
        // Expand - add this node
        newSet.add(node.id);
      }
      return newSet;
    });
  }, [detailedNode]);

  const handleReset = useCallback(() => {
    setExpandedNodes(new Set(["project"]));
    setDetailedNode(null);
    setNetworkExpandedNodes(new Set());
    setHasUserInteracted(false);
    setTimeout(() => fitView({ padding: 0.3, duration: 800 }), 100);
  }, [fitView]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={{ expandable: ExpandableNode }}
        onNodeClick={handleNodeClick}
        minZoom={0.1}
        maxZoom={4}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        zoomOnScroll={true}
        panOnScroll={false}
        panOnDrag={true}
        preventScrolling={false}
        nodesFocusable={true}
        onMove={() => setHasUserInteracted(true)}
        onMoveEnd={() => setHasUserInteracted(true)}
        onPaneClick={() => {
          // Clicking on empty space closes details
          if (detailedNode) {
            setDetailedNode(null);
          }
        }}
      >
        <Background gap={20} size={1} color="#00000008" />
        <Controls />
      </ReactFlow>

      <button
        onClick={handleReset}
        className="absolute top-4 left-4 z-20 px-4 py-2 rounded-lg bg-white border-2 border-black/10 shadow-lg text-sm font-semibold hover:bg-black hover:text-white transition-all"
      >
        ↺ Reset View
      </button>

      {/* Zoom hint */}
      {detailedNode && (
        <div className="absolute top-4 right-4 z-20 px-4 py-2 rounded-lg bg-white/90 border border-black/10 shadow-lg text-xs font-medium">
          Click anywhere to exit detail view
        </div>
      )}
    </>
  );
}

export default function FeaturesSection() {
  const [atTop, setAtTop] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  
  const cardColors = ["#8A38F5", "#F03E3F", "#375922", "#736C2E", "#2D4C8F"];
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAtTop(el.scrollTop === 0);
    
    // Calculate which card is currently in view
    const cardHeight = 600 + 32; // card height + gap
    const currentIndex = Math.round(el.scrollTop / cardHeight);
    setCurrentCardIndex(Math.min(currentIndex, 4)); // max index is 4 (5 cards)
  };

  return (
    <section className="relative px-6 py-16 overflow-hidden bg-[#B3BAC9]">
      <div className="relative z-10">
        <h2 className="text-center text-5xl mb-10 text-black font-italiana">
          Built for students, researchers, and production engineers.
        </h2>
        <div className="bg-[#D9D9D9] rounded-[15px] border border-black shadow-[0px_4px_4px_rgba(49.60,161.96,196.15,0.66)] px-8 py-6 w-full mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[600px_520px] justify-center gap-8">
            {/* LEFT: Feature cards */}
            <div className="relative flex gap-4">
              {/* Custom Scroll Indicator - Single dynamic bar */}
              <div className="flex flex-col justify-center py-8 flex-shrink-0 relative h-[600px]">
                {/* Background track */}
                <div className="absolute top-8 bottom-8 left-0 w-1.5 bg-gray-300/40 rounded-full" />
                
                {/* Active scroll thumb that changes color */}
                <div
                  className="absolute left-0 w-2 rounded-full transition-all duration-300 shadow-lg"
                  style={{
                    backgroundColor: cardColors[currentCardIndex] || cardColors[0],
                    top: `${32 + (currentCardIndex * 116)}px`, // 32px start + index * (96px thumb + 20px gap)
                    height: '96px',
                  }}
                />
              </div>
              
              {/* Scrollable cards container */}
              <div
                className="h-[600px] overflow-y-auto pr-4 snap-y snap-mandatory space-y-8 scrollbar-hide flex-1"
                onScroll={handleScroll}
              >
                <div className="snap-start h-[600px] flex items-center py-4">
                  <FeatureCard
                    title="Visualize Your Code"
                    description="See your entire repository as an interactive system graph."
                    color="#8A38F5"
                  />
                </div>
                <div className="snap-start h-[600px] flex items-center py-4">
                  <FeatureCard
                    title="Find Hidden Risks"
                    description="Automatically detect architectural and security issues."
                    color="#F03E3F"
                  />
                </div>
                <div className="snap-start h-[600px] flex items-center py-4">
                  <FeatureCard
                    title="Plan Fixes Safely"
                    description="Turn intent into clear, approval-ready repair plans."
                    color="#375922"
                  />
                </div>
                <div className="snap-start h-[600px] flex items-center py-4">
                  <FeatureCard
                    title="Apply & Verify"
                    description="Fix code in a sandbox and re-check for risks."
                    color="#736C2E"
                  />
                </div>
                <div className="snap-start h-[600px] flex items-center py-4">
                  <FeatureCard
                    title="Explain the Changes"
                    description="View diffs, graphs, and clear impact summaries."
                    color="#2D4C8F"
                  />
                </div>
              </div>
              
              {/* "What We Offer" scroll hint */}
              {atTop && (
                <div className="pointer-events-none absolute bottom-0 right-0 left-0 h-16 bg-gradient-to-t from-[#D9D9D9] to-transparent flex items-end justify-center pb-2">
                  <div className="flex flex-col items-center text-black/60 text-[13px] tracking-wide font-medium">
                    <span>What We Offer</span>
                    <span className="text-base leading-none">↓</span>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Interactive graph */}
            <div className="relative bg-gradient-to-br from-[#EFEFEF] to-[#E0E0E0] rounded-2xl border-3 border-black/30 overflow-hidden h-[600px] shadow-2xl">
              <ReactFlowProvider>
                <GraphContent />
              </ReactFlowProvider>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
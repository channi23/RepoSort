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
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import FeatureCard from "./FeatureCard";

// Refined Palette
const nodeColors: Record<string, string> = {
  root: "#4F46E5",    // Indigo
  system: "#10B981",  // Emerald
  layer: "#F43F5E",   // Rose
  folder: "#F59E0B",  // Amber
  file: "#8B5CF6",    // Violet
};

// ----------------------
// 1. DATA STRUCTURE
// ----------------------
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
  connections?: string[];
}

const hierarchy: Record<string, HierarchyNode> = {
  project: {
    label: "Your Codebase",
    type: "root",
    children: ["frontend", "backend", "database"],
  },
  frontend: {
    label: "Frontend",
    type: "system",
    children: ["home", "dashboard", "navbar", "card"], 
  },
  backend: {
    label: "Backend",
    type: "system",
    children: ["userCtrl", "repoCtrl", "authSvc"],
  },
  database: {
    label: "Database",
    type: "system",
    children: ["usersTable", "reposTable"],
  },
  // -- Frontend Files --
  home: {
    label: "Home.tsx",
    type: "file",
    details: {
      components: ["HeroSection", "FeatureCards"],
      functions: ["handleScroll", "loadData"],
    },
    connections: ["navbar", "card"],
  },
  dashboard: {
    label: "Dashboard.tsx",
    type: "file",
    details: {
      components: ["Header", "StatsCards"],
      functions: ["fetchRepos"],
    },
    connections: ["navbar", "repoCtrl"],
  },
  navbar: {
    label: "Navbar.tsx",
    type: "file",
    details: {
      components: ["Logo", "NavLinks"],
      exports: ["Navbar"],
    },
    connections: ["authSvc"],
  },
  card: {
    label: "Card.tsx",
    type: "file",
    details: {
      components: ["CardHeader", "CardBody"],
    },
  },
  // -- Backend Files --
  userCtrl: {
    label: "UserController.ts",
    type: "file",
    details: {
      functions: ["createUser", "updateUser"],
    },
    connections: ["authSvc", "usersTable"],
  },
  repoCtrl: {
    label: "RepoController.ts",
    type: "file",
    details: {
      functions: ["getRepos", "analyzeRepo"],
    },
    connections: ["reposTable"],
  },
  authSvc: {
    label: "AuthService.ts",
    type: "file",
    details: {
      functions: ["login", "verifyToken"],
    },
    connections: ["usersTable"],
  },
  // -- Database Tables --
  usersTable: {
    label: "users",
    type: "file",
    details: {
      components: ["id", "email", "password_hash"],
    },
  },
  reposTable: {
    label: "repositories",
    type: "file",
    details: {
      components: ["id", "name", "owner_id"],
    },
  },
};

// ----------------------
// 2. CUSTOM NODE COMPONENT
// ----------------------
function ExpandableNode({ id, data }: any) {
  const color = nodeColors[data.type] || "#6B7280";
  const { hasChildren, isExpanded, showDetails } = data;
  const nodeInfo = hierarchy[id];
  const isRoot = data.type === 'root';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren && data.onToggleExpand) {
      data.onToggleExpand(id);
    } else if (data.showDetails !== undefined) {
      data.onToggleDetails?.(id);
    }
  };

  return (
    <div
      className="relative group"
      onClick={handleClick}
      style={{
        zIndex: showDetails ? 100 : 1,
        cursor: hasChildren ? "pointer" : "default",
      }}
    >
      {/* Active Glow */}
      {(isRoot || showDetails) && (
        <div 
          className="absolute inset-0 rounded-xl blur-xl opacity-20 transition-opacity duration-500"
          style={{ backgroundColor: color }}
        />
      )}

      <div
        className={`
          relative rounded-xl border bg-white/95 backdrop-blur-md overflow-hidden transition-all duration-300 ease-out
          ${isRoot && !isExpanded ? 'animate-pulse-slow' : ''}
        `}
        style={{
          borderColor: isExpanded || showDetails ? color : `${color}40`,
          borderWidth: isExpanded || showDetails ? '2px' : '1px',
          minWidth: showDetails ? "280px" : "180px",
          maxWidth: showDetails ? "320px" : "200px",
          transform: showDetails ? "scale(1.1)" : "scale(1)",
          boxShadow: showDetails
            ? `0 20px 40px -10px ${color}50`
            : `0 4px 12px -2px rgba(0,0,0,0.05)`,
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className={`w-3 h-3 rounded-full shrink-0 shadow-sm ${isExpanded ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: color }}
            />
            <span 
              className="truncate text-[13px] font-bold tracking-tight text-gray-800"
            >
              {data.label}
            </span>
          </div>
          
          {hasChildren && (
            <div
              className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 transition-colors duration-200"
              style={{
                backgroundColor: isExpanded ? color : "#F3F4F6",
                color: isExpanded ? "white" : "#6B7280",
              }}
            >
              {isExpanded ? "−" : "+"}
            </div>
          )}
        </div>

        {/* Details Panel */}
        {showDetails && nodeInfo?.details && (
          <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 text-xs animate-in slide-in-from-top-2 fade-in duration-200">
            {nodeInfo.details.functions && (
              <div className="mb-3">
                <div className="font-bold text-gray-400 mb-1.5 text-[9px] uppercase tracking-wider">
                  Functions
                </div>
                <div className="flex flex-col gap-1">
                  {nodeInfo.details.functions.slice(0, 5).map((fn, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-gray-600 font-mono">
                      <span className="w-1 h-1 rounded-full bg-gray-300"/>
                      {fn}()
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {nodeInfo.details.components && (
              <div className="mb-3">
                <div className="font-bold text-gray-400 mb-1.5 text-[9px] uppercase tracking-wider">
                  Components
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {nodeInfo.details.components.slice(0, 5).map((comp, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] bg-white border border-gray-200 text-gray-600 shadow-sm"
                    >
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Connection Button */}
            {nodeInfo.connections && nodeInfo.connections.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  data.onExpandNetwork?.(id);
                }}
                className="mt-2 w-full py-1.5 rounded-md text-[10px] font-semibold transition-all hover:brightness-110 active:scale-98"
                style={{ backgroundColor: `${color}15`, color: color }}
              >
                Reveal Connections
              </button>
            )}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !border-0 !bg-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-0 !bg-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  );
}

const nodeTypes = { expandable: ExpandableNode };

// ----------------------
// 3. GRAPH LOGIC
// ----------------------
function GraphContent() {
  const [expandedNodes, setExpandedNodes] = useState(new Set(["project"]));
  const [detailedNode, setDetailedNode] = useState<string | null>(null);
  const [networkExpandedNodes, setNetworkExpandedNodes] = useState(new Set<string>());
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const { fitView, setCenter } = useReactFlow();

  const handleExpandNetwork = useCallback((nodeId: string) => {
    setNetworkExpandedNodes((prev) => {
      const newSet = new Set(prev);
      newSet.has(nodeId) ? newSet.delete(nodeId) : newSet.add(nodeId);
      return newSet;
    });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Calculate Layout
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

      // Focus Mode Visibility Logic
      const isNetworkRevealed = detailedNode && networkExpandedNodes.has(detailedNode) && hierarchy[detailedNode]?.connections?.includes(id);
      const isFocused = detailedNode === id;
      const isVisible = detailedNode === null || isFocused || isNetworkRevealed;

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
          onToggleExpand: toggleExpand,
          onToggleDetails: (id: string) => setDetailedNode(prev => prev === id ? null : id),
        },
        position: { x, y },
        style: { 
          opacity: isVisible ? 1 : 0.05, 
          filter: isVisible ? 'none' : 'blur(4px) grayscale(100%)',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: isFocused ? 50 : (isVisible ? 10 : 0),
          pointerEvents: isVisible ? 'auto' : 'none',
        }
      });

      if (isExpanded && hasChildren) {
        const children = nodeData.children!;
        const spacing = Math.max(180, 260 - (depth * 30));
        const totalWidth = (children.length - 1) * spacing;
        
        children.forEach((childId, index) => {
          const childX = x - (totalWidth / 2) + (index * spacing);
          const childY = y + 180;
          
          addNode(childId, depth + 1, childX, childY, id);

          const isEdgeVisible = detailedNode === null || (detailedNode === id && isNetworkRevealed);

          edgeList.push({
            id: `${id}-${childId}`,
            source: id,
            target: childId,
            animated: true,
            style: { 
                stroke: "#CBD5E1", 
                strokeWidth: 2,
                opacity: isEdgeVisible ? 1 : 0.05
            },
            type: "smoothstep",
          });
        });
      }

      if (networkExpandedNodes.has(id) && nodeData.connections) {
        nodeData.connections.forEach((connId, index) => {
            const angle = (index / nodeData.connections!.length) * Math.PI + (Math.PI/2);
            const radius = 240;
            const connX = x + Math.cos(angle) * radius;
            const connY = y + Math.sin(angle) * radius;

            if (!processedNodes.has(connId)) addNode(connId, depth, connX, connY, id);

            edgeList.push({
                id: `network-${id}-${connId}`,
                source: id,
                target: connId,
                animated: true,
                style: { stroke: "#F59E0B", strokeWidth: 2, strokeDasharray: "5,5" },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#F59E0B" },
                type: "default",
            });
        });
      }
    }

    addNode("project", 0, 0, 0);
    return { nodes: nodeList, edges: edgeList };
  }, [expandedNodes, detailedNode, networkExpandedNodes, handleExpandNetwork, toggleExpand]);

  useEffect(() => {
    setNodes(initialGraph.nodes);
    setEdges(initialGraph.edges);
  }, [initialGraph]);

  // SMART ZOOM EFFECT
  useEffect(() => {
    if (detailedNode) {
      // Find the detailed node to zoom in on
      const node = nodes.find((n) => n.id === detailedNode);
      if (node) {
        // Calculate center position (approximate node center)
        const x = node.position.x + 150; 
        const y = node.position.y + 100;
        setCenter(x, y, { zoom: 1.5, duration: 1000 });
      }
    } else if (nodes.length > 0) {
      // Zoom out when details are closed
      fitView({ duration: 1000, padding: 0.2 });
    }
  }, [detailedNode, nodes, setCenter, fitView]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        minZoom={0.2}
        maxZoom={2}
        fitView
        onPaneClick={() => setDetailedNode(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="#00000008" />
        <Controls showInteractive={false} className="!bg-white !shadow-lg !border-0 !rounded-lg" />
      </ReactFlow>

      {/* Helper UI Elements */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button
          onClick={() => {
            setExpandedNodes(new Set(["project"]));
            setDetailedNode(null);
            setNetworkExpandedNodes(new Set());
          }}
          className="px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur border border-black/5 shadow-sm text-xs font-semibold hover:bg-black hover:text-white transition-all"
        >
          Reset View
        </button>
      </div>

      {detailedNode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-black/80 text-white shadow-xl text-[10px] font-medium animate-in fade-in slide-in-from-bottom-2">
          Click background to zoom out
        </div>
      )}
    </>
  );
}

// ----------------------
// 4. MAIN COMPONENT
// ----------------------
export default function FeaturesSection() {
  const [atTop, setAtTop] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  
  const cardColors = ["#8A38F5", "#F03E3F", "#375922", "#736C2E", "#2D4C8F"];
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setAtTop(el.scrollTop === 0);
    const cardHeight = 632; 
    const currentIndex = Math.round(el.scrollTop / cardHeight);
    setCurrentCardIndex(Math.min(currentIndex, 4));
  };

  return (
    <section className="relative px-6 py-16 overflow-hidden bg-[#B3BAC9]">
        <style jsx global>{`
            @keyframes pulse-slow {
                0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
                50% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(79, 70, 229, 0); }
            }
            .animate-pulse-slow {
                animation: pulse-slow 3s infinite;
            }
        `}</style>
      <div className="relative z-10 max-w-7xl mx-auto">
        <h2 className="text-center text-5xl mb-12 text-black font-italiana">
          Built for students, researchers, and production engineers.
        </h2>
        <div className="bg-[#D9D9D9] rounded-[24px] border border-black/10 shadow-[0px_4px_24px_rgba(0,0,0,0.08)] px-8 py-8 w-full mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[550px_1fr] justify-center gap-12">
            
            {/* LEFT: Feature cards */}
            <div className="relative flex gap-6">
              <div className="flex flex-col justify-center py-8 flex-shrink-0 relative h-[600px]">
                <div className="absolute top-8 bottom-8 left-1 w-1 bg-gray-300/40 rounded-full" />
                <div
                  className="absolute left-1 w-1.5 -ml-[1px] rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,0,0,0.2)]"
                  style={{
                    backgroundColor: cardColors[currentCardIndex],
                    top: `${32 + (currentCardIndex * 116)}px`,
                    height: '96px',
                  }}
                />
              </div>
              
              <div
                className="h-[600px] overflow-y-auto pr-4 snap-y snap-mandatory space-y-8 scrollbar-hide flex-1"
                onScroll={handleScroll}
              >
                {[
                  { title: "Visualize Your Code", desc: "See your entire repository as an interactive system graph.", color: "#8A38F5" },
                  { title: "Find Hidden Risks", desc: "Automatically detect architectural and security issues.", color: "#F03E3F" },
                  { title: "Plan Fixes Safely", desc: "Turn intent into clear, approval-ready repair plans.", color: "#375922" },
                  { title: "Apply & Verify", desc: "Fix code in a sandbox and re-check for risks.", color: "#736C2E" },
                  { title: "Explain the Changes", desc: "View diffs, graphs, and clear impact summaries.", color: "#2D4C8F" }
                ].map((card, i) => (
                    <div key={i} className="snap-start h-[600px] flex items-center py-4">
                        <FeatureCard title={card.title} description={card.desc} color={card.color} />
                    </div>
                ))}
              </div>
              
              {atTop && (
                <div className="pointer-events-none absolute bottom-0 right-0 left-0 h-24 bg-gradient-to-t from-[#D9D9D9] to-transparent flex items-end justify-center pb-4">
                  <div className="flex flex-col items-center text-black/40 text-[12px] uppercase tracking-widest font-bold animate-bounce">
                    <span>Scroll</span>
                    <span className="text-lg leading-none mt-1">↓</span>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Interactive graph */}
            <div className="relative bg-[#F3F4F6] rounded-2xl border border-black/5 overflow-hidden h-[600px] shadow-inner">
              <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50 pointer-events-none"/>
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
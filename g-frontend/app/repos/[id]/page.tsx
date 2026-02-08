"use client";
import Navbar from "@/components/AuthNavbar";
import { useState, use, useEffect } from "react";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
export default function RepoSortingPage({
  params,
}: {params:Promise<{id:string}>;
}) {
  const {id}=use(params);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [nodeMeta, setNodeMeta] = useState<
    Record<string, { label: string; description: string }>
  >({});

  // Undo/Redo history state
  const [history, setHistory] = useState<any[]>([]);
  const [future, setFuture] = useState<any[]>([]);
  const [isBatching, setIsBatching] = useState(false);

  // Helper to push snapshot to history
  const pushHistory = () => {
    if (isBatching) return;

    setHistory((prev) => [
      ...prev,
      {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        expanded: JSON.parse(JSON.stringify(expanded)),
        nodeMeta: JSON.parse(JSON.stringify(nodeMeta)),
      },
    ]);
    setFuture([]);
  };

  const beginBatch = () => {
    setHistory((prev) => [
      ...prev,
      {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        expanded: JSON.parse(JSON.stringify(expanded)),
        nodeMeta: JSON.parse(JSON.stringify(nodeMeta)),
      },
    ]);
    setFuture([]);
    setIsBatching(true);
  };

  const endBatch = () => {
    setIsBatching(false);
  };

  const SUBGRAPHS: Record<
    string,
    { id: string; label: string }[]
  > = {
    frontend: [
      { id: "pages", label: "Pages" },
      { id: "components", label: "Components" },
    ],

    pages: [
      { id: "home", label: "Home.tsx" },
      { id: "dashboard", label: "Dashboard.tsx" },
    ],

    home: [
      { id: "home_layout", label: "Layout" },
    ],

    home_layout: [
      { id: "home_background", label: "Background" },
      { id: "home_sections", label: "Sections" },
    ],

    components: [
      { id: "navbar", label: "Navbar.tsx" },
      { id: "card", label: "Card.tsx" },
    ],

    backend: [
      { id: "controllers", label: "Controllers" },
      { id: "services", label: "Services" },
    ],

    controllers: [
      { id: "user_controller", label: "UserController" },
      { id: "repo_controller", label: "RepoController" },
    ],

    database: [
      { id: "tables", label: "Tables" },
      { id: "indexes", label: "Indexes" },
    ],

    tables: [
      { id: "users_table", label: "users" },
      { id: "repos_table", label: "repositories" },
    ],
  };

  // Helper: collect all descendant node ids (including root)
  const collectSubtreeIds = (rootId: string): string[] => {
    const result = new Set<string>();
    const stack = [rootId];

    while (stack.length) {
      const current = stack.pop()!;
      result.add(current);

      const children = SUBGRAPHS[current];
      if (children) {
        children.forEach((c) => {
          if (!result.has(c.id)) stack.push(c.id);
        });
      }
    }

    return Array.from(result);
  };

  const addNode = (
    id: string,
    label?: string,
    parentId?: string,
    offsetX = 0,
    offsetY = 0
  ) => {
    pushHistory();
    setNodes((prev) => {
      if (prev.find((n) => n.id === id)) return prev;

      const parent = prev.find((n) => n.id === parentId);
      const position = parent
        ? { x: parent.position.x + offsetX, y: parent.position.y + offsetY }
        : { x: 120 + prev.length * 180, y: 220 };

      return [...prev, { id, data: { label: label ?? id }, position }];
    });

    setNodeMeta((prev) => ({
      ...prev,
      [id]: { label: label ?? id, description: "" },
    }));
  };

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          label: nodeMeta[n.id]?.label ?? n.data.label,
        },
      }))
    );
  }, [nodeMeta]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandSubgraph = (parentId: string) => {
    pushHistory();
    const children = SUBGRAPHS[parentId];
    if (!children) return;

    children.forEach((child, index) => {
      addNode(
        child.id,
        child.label,
        parentId,
        -120 + index * 200,
        140
      );
      connectNodes(parentId, child.id);
    });
  };

  const collapseSubgraph = (parentId: string) => {
    pushHistory();
    const children = SUBGRAPHS[parentId];
    if (!children) return;

    setNodes((prev) =>
      prev.filter(
        (n) => n.id === parentId || !children.some((c) => c.id === n.id)
      )
    );

    setEdges((prev) =>
      prev.filter(
        (e) =>
          e.source !== parentId &&
          !children.some((c) => c.id === e.target)
      )
    );
  };

  const connectNodes = (from: string, to: string) => {
    pushHistory();
    setEdges((prev) => [
      ...prev,
      { id: `${from}-${to}-${Date.now()}`, source: from, target: to },
    ]);
  };

  const renameNode = (id: string, newLabel: string) => {
    pushHistory();
    setNodeMeta((prev) =>
      prev[id]
        ? { ...prev, [id]: { ...prev[id], label: newLabel } }
        : prev
    );
  };

  // Remove a node and its entire subtree, with history, edges, expanded, and meta cleanup.
  const removeNode = (id: string) => {
    pushHistory();

    const idsToRemove = collectSubtreeIds(id);

    setNodes((prev) => prev.filter((n) => !idsToRemove.includes(n.id)));

    setEdges((prev) =>
      prev.filter(
        (e) =>
          !idsToRemove.includes(e.source) &&
          !idsToRemove.includes(e.target)
      )
    );

    setExpanded((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((i) => delete next[i]);
      return next;
    });

    setNodeMeta((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((i) => delete next[i]);
      return next;
    });

    if (selectedNodeId && idsToRemove.includes(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  };

  // Undo/Redo handlers
  const undo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;

      const last = prev[prev.length - 1];
      setFuture((f) => [
        {
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
          expanded: JSON.parse(JSON.stringify(expanded)),
          nodeMeta: JSON.parse(JSON.stringify(nodeMeta)),
        },
        ...f,
      ]);

      setNodes(last.nodes);
      setEdges(last.edges);
      setExpanded(last.expanded);
      setNodeMeta(last.nodeMeta);

      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;

      const next = prev[0];
      setHistory((h) => [
        ...h,
        {
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
          expanded: JSON.parse(JSON.stringify(expanded)),
          nodeMeta: JSON.parse(JSON.stringify(nodeMeta)),
        },
      ]);

      setNodes(next.nodes);
      setEdges(next.edges);
      setExpanded(next.expanded);
      setNodeMeta(next.nodeMeta);

      return prev.slice(1);
    });
  };

  // Keyboard shortcut for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmd = isMac ? e.metaKey : e.ctrlKey;

      if (cmd && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if (cmd && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nodes, edges, expanded, nodeMeta]);

  const runAgentCommand = (input: string) => {
    const text = input.toLowerCase().trim();

    if (text.includes("frontend")) addNode("frontend", "Frontend");
    if (text.includes("backend")) addNode("backend", "Backend");
    if (text.includes("database")) addNode("database", "Database");

    if (text.includes("connect")) {
      if (text.includes("frontend") && text.includes("backend"))
        connectNodes("frontend", "backend");
      if (text.includes("backend") && text.includes("database"))
        connectNodes("backend", "database");
      if (text.includes("frontend") && text.includes("database"))
        connectNodes("frontend", "database");
    }

    if (text.startsWith("rename")) {
      const match = text.match(/rename\s+(\w+)\s+to\s+(.+)/);
      if (match) renameNode(match[1], match[2].trim());
    }

    if (text.startsWith("describe")) {
      // examples:
      // "describe backend as auth layer"
      // "describe database as postgres storage"
      const match = text.match(/describe\s+(\w+)\s+as\s+(.+)/);
      if (match) {
        const [, target, description] = match;
        setNodeMeta((prev) =>
          prev[target]
            ? {
                ...prev,
                [target]: {
                  ...prev[target],
                  description: description.trim(),
                },
              }
            : prev
        );
      }
    }

    if (text.startsWith("expand")) {
      // examples:
      // "expand frontend"
      // "expand backend"
      const match = text.match(/expand\s+(\w+)/);
      if (match) {
        const [, target] = match;
        if (SUBGRAPHS[target] && !expanded[target]) {
          expandSubgraph(target);
          toggleExpand(target);
        }
      }
    }

    if (text.startsWith("collapse")) {
      // examples:
      // "collapse frontend"
      // "collapse backend"
      const match = text.match(/collapse\s+(\w+)/);
      if (match) {
        const [, target] = match;
        if (SUBGRAPHS[target] && expanded[target]) {
          collapseSubgraph(target);
          toggleExpand(target);
        }
      }
    }
    if (text.startsWith("remove") || text.startsWith("delete")) {
      // examples:
      // "remove database"
      // "delete frontend"
      const match = text.match(/(remove|delete)\s+(\w+)/);
      if (match) {
        const [, , target] = match;
        removeNode(target);
      }
    }
  };

  // --- Gemini JSON Action Executor ---
  type AgentAction =
    | { type: "addNode"; id: string; label?: string }
    | { type: "connect"; from: string; to: string }
    | { type: "expand"; id: string }
    | { type: "collapse"; id: string }
    | { type: "rename"; id: string; value: string }
    | { type: "describe"; id: string; value: string }
    | { type: "remove"; id: string };

  const applyAction = (action: AgentAction) => {
    switch (action.type) {
      case "addNode":
        addNode(action.id, action.label);
        break;
      case "connect":
        connectNodes(action.from, action.to);
        break;
      case "expand":
        if (SUBGRAPHS[action.id] && !expanded[action.id]) {
          expandSubgraph(action.id);
          toggleExpand(action.id);
        }
        break;
      case "collapse":
        if (SUBGRAPHS[action.id] && expanded[action.id]) {
          collapseSubgraph(action.id);
          toggleExpand(action.id);
        }
        break;
      case "rename":
        renameNode(action.id, action.value);
        break;
      case "describe":
        setNodeMeta((prev) =>
          prev[action.id]
            ? {
                ...prev,
                [action.id]: {
                  ...prev[action.id],
                  description: action.value,
                },
              }
            : prev
        );
        break;
      case "remove":
        removeNode(action.id);
        break;
      default:
        break;
    }
  };

  const runAgentActionsFromJSON = (json: unknown) => {
    if (!json || typeof json !== "object") return;
    const payload = json as { actions?: AgentAction[] };
    if (!Array.isArray(payload.actions)) return;

    beginBatch();

    payload.actions.forEach((action) => {
      applyAction(action);
    });

    endBatch();
  };

  // Example Gemini response:
  // {
  //   "actions": [
  //     { "type": "addNode", "id": "frontend" },
  //     { "type": "addNode", "id": "backend" },
  //     { "type": "connect", "from": "frontend", "to": "backend" },
  //     { "type": "expand", "id": "frontend" }
  //   ]
  // }
  //
  // runAgentActionsFromJSON(geminiResponse);

  const hasGraphData = nodes.length > 0;

  const statuses=[
    "1",
    "2",
    "3", //change it later to the needed words for laoding 
    "4",
    "5",
  ];
  const [statusIndex, setStatusIndex] = useState(0);
  useEffect(()=>{
    const id=setInterval(()=>{
      setStatusIndex((i)=>(i+1)%statuses.length); //this interval needed to be rmoved when connecting backend
    },1600);
    return ()=>clearInterval(id);
  },[]);

  return (
    <main className="min-h-screen bg-[#B3BAC9]">
      <Navbar/>
      <div className="relative w-full h-[calc(100vh-96px)] overflow-hidden">
        {!hasGraphData&&(<div className="absolute inset-0" style={{backgroundImage:"radial-gradient(#6B84C6 1px, transparent 1px)",backgroundSize:"24px 24px",}}/>)}
        {hasGraphData&&(<div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[85%] h-[85%] bg-[#E6E6E6] rounded-3xl shadow-[0px_8px_40px_rgba(0,0,0,0.25)] relative overflow-hidden">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                onNodeClick={(_, node) => {
                  const id = node.id;
                  setSelectedNodeId(id);

                  if (SUBGRAPHS[id]) {
                    expanded[id] ? collapseSubgraph(id) : expandSubgraph(id);
                    toggleExpand(id);
                  }
                }}
              >
                <Background gap={24} />
                <Controls />
              </ReactFlow>
            </div>
          </div>)}
        {/*so here the node backend goes marking for easy implementaion */}
        {!hasGraphData && (<div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin w-6 h-6 border-2 border-black/30 border-t-black rounded-full" />
            <p className="text-black/60 font-itim text-lg">
              {statuses[statusIndex]}
            </p>
          </div>)}
        {showChat && (<div className="absolute bottom-20 left-6 w-[420px] h-[560px] bg-[#5E6B91] rounded-2xl shadow-lg p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3 text-white text-sm">
              <span>Agent</span>
              <button onClick={() => setShowChat(false)}>✕</button>
            </div>
            <div className="flex-1 space-y-3 text-base text-white overflow-hidden"></div>
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!chatInput.trim()) return;
                runAgentCommand(chatInput);
                setChatInput("");
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask RepoSort"
                className="w-full bg-[#8E9AD0] rounded-lg px-3 py-2 text-base text-white placeholder-white/70 outline-none"
              />
            </form>
          </div>)}
        {!showChat && (<button className="absolute bottom-10 left-10 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow text-xl" onClick={() => setShowChat(true)} aria-label="Open chat">✦</button>)}

        {selectedNodeId && nodeMeta[selectedNodeId] && (
          <div className="absolute top-24 right-6 w-[320px] bg-white rounded-xl shadow-xl p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-700">
              Node Inspector
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Label</label>
              <input
                value={nodeMeta[selectedNodeId].label}
                onChange={(e) =>
                  setNodeMeta((prev) => ({
                    ...prev,
                    [selectedNodeId]: {
                      ...prev[selectedNodeId],
                      label: e.target.value,
                    },
                  }))
                }
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Description</label>
              <textarea
                value={nodeMeta[selectedNodeId].description}
                onChange={(e) =>
                  setNodeMeta((prev) => ({
                    ...prev,
                    [selectedNodeId]: {
                      ...prev[selectedNodeId],
                      description: e.target.value,
                    },
                  }))
                }
                rows={3}
                className="w-full border rounded px-2 py-1 text-sm resize-none"
              />
            </div>

            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-xs text-gray-500 hover:text-black"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
"use client";
import Navbar from "@/components/Navbar";
import RiskPanel, { Risk } from "@/components/RiskPanel"; // Import RiskPanel
import React, { useState, use, useEffect, useRef } from "react";
import ReactFlow, { Background, Controls, ReactFlowProvider, applyNodeChanges, applyEdgeChanges, OnNodesChange, OnEdgesChange } from "reactflow";
import "reactflow/dist/style.css";
import IndustrialNode from "@/components/IndustrialNode";
import NodeInspector from "@/components/NodeInspector";

const nodeTypes = {
  PROJECT: IndustrialNode,
  DIR: IndustrialNode,
  FILE: IndustrialNode,
  MODULE: IndustrialNode,
  SERVICE: IndustrialNode,
  CONFIG: IndustrialNode,
};

export default function RepoSortingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = id; // Assuming ID in URL is project ID for now
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [nodeMeta, setNodeMeta] = useState<
    Record<string, { label: string; description: string }>
  >({});

  // AI & Risk State
  const [risks, setRisks] = useState<Risk[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<"IDLE" | "INGESTING" | "BUILDING" | "ANALYZING" | "FIXING">("IDLE");
  const [highlightedRiskNodes, setHighlightedRiskNodes] = useState<string[] | null>(null);
  const [currGraphSnapshotId, setCurrGraphSnapshotId] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  // Undo/Redo history state
  const [history, setHistory] = useState<any[]>([]);
  const [future, setFuture] = useState<any[]>([]);
  const [isBatching, setIsBatching] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'agent'; text: string }[]>([
    { role: 'agent', text: 'Agent is monitoring repository structure. Ask me anything about dependencies or risks.' }
  ]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);

  // Refs to track current state for pushHistory (avoid stale closures)
  const nodesRef = useRef<any[]>([]);
  const edgesRef = useRef<any[]>([]);
  const expandedRef = useRef<Record<string, boolean>>({});
  const nodeMetaRef = useRef<Record<string, { label: string; description: string }>>({});

  // Helper to push snapshot to history
  const pushHistory = () => {
    if (isBatching) return;

    setHistory((prev) => [
      ...prev,
      {
        nodes: JSON.parse(JSON.stringify(nodesRef.current)),
        edges: JSON.parse(JSON.stringify(edgesRef.current)),
        expanded: JSON.parse(JSON.stringify(expandedRef.current)),
        nodeMeta: JSON.parse(JSON.stringify(nodeMetaRef.current)),
      },
    ]);
    setFuture([]);
  };

  const beginBatch = () => {
    setHistory((prev) => [
      ...prev,
      {
        nodes: JSON.parse(JSON.stringify(nodesRef.current)),
        edges: JSON.parse(JSON.stringify(edgesRef.current)),
        expanded: JSON.parse(JSON.stringify(expandedRef.current)),
        nodeMeta: JSON.parse(JSON.stringify(nodeMetaRef.current)),
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

  const steps = [
    { id: "INGESTING", label: "INGESTING" },
    { id: "BUILDING", label: "BUILDING" },
    { id: "ANALYZING", label: "ANALYZING" },
    { id: "FIXING", label: "FIXING" },
  ];

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
    offsetY = 0,
    recordHistory = true
  ) => {
    if (recordHistory) {
      pushHistory();
    }
    setNodes((prev) => {
      if (prev.find((n) => n.id === id)) return prev;

      const parent = prev.find((n) => n.id === parentId);
      const position = parent
        ? { x: parent.position.x + offsetX, y: parent.position.y + offsetY }
        : { x: 120 + prev.length * 180, y: 220 };

      const newNodes = [...prev, { id, data: { label: label ?? id }, position }];
      nodesRef.current = newNodes;
      return newNodes;
    });

    setNodeMeta((prev) => {
      const newMeta = {
        ...prev,
        [id]: { label: label ?? id, description: "" },
      };
      nodeMetaRef.current = newMeta;
      return newMeta;
    });
  };

  // Sync refs whenever state changes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useEffect(() => {
    nodeMetaRef.current = nodeMeta;
  }, [nodeMeta]);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          label: nodeMeta[n.id]?.label ?? n.data.label,
        },
        style: highlightedRiskNodes?.includes(n.id)
          ? { border: '2px solid #ef4444', boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)' }
          : undefined
      }))
    );
  }, [nodeMeta, highlightedRiskNodes]);

  const onNodesChange: OnNodesChange = (changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  const onEdgesChange: OnEdgesChange = (changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };

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
        140,
        false
      );
      connectNodes(parentId, child.id, false);
    });
  };

  const collapseSubgraph = (parentId: string) => {
    pushHistory();
    const idsToRemove = new Set(collectSubtreeIds(parentId));
    idsToRemove.delete(parentId); // Keep the parent itself

    setNodes((prev) => {
      const newNodes = prev.filter((n) => !idsToRemove.has(n.id));
      nodesRef.current = newNodes;
      return newNodes;
    });

    setEdges((prev) => {
      const newEdges = prev.filter(
        (e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target)
      );
      edgesRef.current = newEdges;
      return newEdges;
    });

    setExpanded((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => delete next[id]);
      expandedRef.current = next;
      return next;
    });

    setNodeMeta((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => delete next[id]);
      nodeMetaRef.current = next;
      return next;
    });
  };

  const connectNodes = (from: string, to: string, recordHistory = true) => {
    if (recordHistory) {
      pushHistory();
    }
    setEdges((prev) => {
      const newEdges = [
        ...prev,
        {
          id: `${from}-${to}-${Date.now()}`,
          source: from,
          target: to,
          label: "CONTAINS",
          style: { stroke: '#000', strokeWidth: 3 },
          animated: false,
        },
      ];
      edgesRef.current = newEdges;
      return newEdges;
    });
  };

  const renameNode = (id: string, newLabel: string) => {
    pushHistory();
    setNodeMeta((prev) => {
      const next = prev[id]
        ? { ...prev, [id]: { ...prev[id], label: newLabel } }
        : prev;
      nodeMetaRef.current = next;
      return next;
    });
  };

  // Remove a node and its entire subtree, with history, edges, expanded, and meta cleanup.
  const removeNode = (id: string) => {
    pushHistory();

    const idsToRemove = collectSubtreeIds(id);

    setNodes((prev) => {
      const next = prev.filter((n) => !idsToRemove.includes(n.id));
      nodesRef.current = next;
      return next;
    });

    setEdges((prev) => {
      const next = prev.filter(
        (e) =>
          !idsToRemove.includes(e.source) &&
          !idsToRemove.includes(e.target)
      );
      edgesRef.current = next;
      return next;
    });

    setExpanded((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((i) => delete next[i]);
      expandedRef.current = next;
      return next;
    });

    setNodeMeta((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((i) => delete next[i]);
      nodeMetaRef.current = next;
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
      return prev.slice(0, -1);
    });

    setHistory((prev) => {
      if (prev.length === 0) return prev;

      const last = prev[prev.length - 1];
      const futureEntry = {
        nodes: JSON.parse(JSON.stringify(nodesRef.current)),
        edges: JSON.parse(JSON.stringify(edgesRef.current)),
        expanded: JSON.parse(JSON.stringify(expandedRef.current)),
        nodeMeta: JSON.parse(JSON.stringify(nodeMetaRef.current)),
      };

      setFuture((f) => [futureEntry, ...f]);
      setNodes(last.nodes);
      setEdges(last.edges);
      setExpanded(last.expanded);
      setNodeMeta(last.nodeMeta);

      nodesRef.current = last.nodes;
      edgesRef.current = last.edges;
      expandedRef.current = last.expanded;
      nodeMetaRef.current = last.nodeMeta;

      return prev;
    });
  };

  const redo = () => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;

      const next = prev[0];
      const historyEntry = {
        nodes: JSON.parse(JSON.stringify(nodesRef.current)),
        edges: JSON.parse(JSON.stringify(edgesRef.current)),
        expanded: JSON.parse(JSON.stringify(expandedRef.current)),
        nodeMeta: JSON.parse(JSON.stringify(nodeMetaRef.current)),
      };

      setHistory((h) => [...h, historyEntry]);

      setNodes(next.nodes);
      setEdges(next.edges);
      setExpanded(next.expanded);
      setNodeMeta(next.nodeMeta);

      nodesRef.current = next.nodes;
      edgesRef.current = next.edges;
      expandedRef.current = next.expanded;
      nodeMetaRef.current = next.nodeMeta;

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
  }, []);

  // Initial Load: Check if project already has a graph/risks
  useEffect(() => {
    const initLoad = async () => {
      try {
        const res = await fetch(`http://localhost:3000/projects/${projectId}/graph`);
        if (res.ok) {
          const data = await res.json();
          if (data.graphSnapshotId) {
            setCurrGraphSnapshotId(data.graphSnapshotId);
            setHasScanned(true);

            if (data.nodes) {
              const laidOutNodes = data.nodes.map((n: any, i: number) => ({
                ...n,
                position: (n.position?.x === 0 && n.position?.y === 0)
                  ? { x: (i % 6) * 280, y: Math.floor(i / 6) * 220 }
                  : n.position
              }));
              setNodes(laidOutNodes);
            }
            if (data.edges) setEdges(data.edges);

            // Fetch risks too
            const risksRes = await fetch(`http://localhost:3000/projects/${projectId}/risks`);
            if (risksRes.ok) {
              const rData = await risksRes.json();
              const rList = Array.isArray(rData) ? rData : (rData.risks || []);
              setRisks(rList.map((r: any) => ({
                id: r.id,
                type: r.type,
                severity: r.severity,
                title: r.title,
                description: r.description,
                ruleId: r.ruleId,
                nodeIds: r.nodeIds || (r.nodes?.map((n: any) => n.nodeId)) || [],
              })));
            }
          }
        }
      } catch (e) {
        console.error("Initial load failed", e);
      }
    };
    initLoad();
  }, [projectId]);

  // --- API Integrations ---

  const handleAnalyzeFn = async () => {
    setIsAnalyzing(true);
    setAnalysisStep("INGESTING");
    try {
      // 1. Ensure Repo Snapshot exists (Ingestion check)
      let repoSnapshotId = null;
      let graphSnapshotId = null;
      let checkAttempts = 0;

      while (!repoSnapshotId && checkAttempts < 20) {
        // We check for graph first as it's the end goal
        const res = await fetch(`http://localhost:3000/projects/${projectId}/graph`);
        if (res.ok) {
          const data = await res.json();
          graphSnapshotId = data.graphSnapshotId;
          setCurrGraphSnapshotId(graphSnapshotId);
          // If graph exists, we don't need to check repo snapshot
          if (graphSnapshotId) {
            if (data.nodes) {
              const laidOutNodes = data.nodes.map((n: any, i: number) => ({
                ...n,
                position: (n.position?.x === 0 && n.position?.y === 0)
                  ? { x: (i % 6) * 280, y: Math.floor(i / 6) * 220 }
                  : n.position
              }));
              setNodes(laidOutNodes);
            }
            if (data.edges) setEdges(data.edges);
            break;
          }
        }

        // If no graph, check if we at least have a repo snapshot to build from
        // We don't have a direct endpoint for repo snapshot list usually, 
        // but we can try the build endpoint and see if it gives a 404 or something else
        // Actually, let's keep it simple: try to build. If 404, we are still ingesting.
        const buildCheck = await fetch(`http://localhost:3000/projects/${projectId}/graph/build`, {
          method: "POST",
        });

        if (buildCheck.ok) {
          const buildData = await buildCheck.json();
          repoSnapshotId = buildData.repoSnapshotId;
          break;
        }

        if (buildCheck.status === 404) {
          // Still ingesting...
          console.log("Still ingesting or no snapshot yet...");
          await new Promise(r => setTimeout(r, 3000));
          checkAttempts++;
          continue;
        }

        throw new Error("Failed to communicate with ingestion service");
      }

      if (!graphSnapshotId && !repoSnapshotId) {
        throw new Error("Ingestion is taking longer than expected. Please try again in a moment.");
      }

      // 2. If we have a repo snapshot but still no graph, poll for graph build completion
      if (!graphSnapshotId && repoSnapshotId) {
        setAnalysisStep("BUILDING");
        let buildAttempts = 0;
        // Increase to 100 attempts (300 seconds) for larger repos
        while (!graphSnapshotId && buildAttempts < 100) {
          await new Promise(r => setTimeout(r, 3000));
          const checkRes = await fetch(`http://localhost:3000/projects/${projectId}/graph`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            graphSnapshotId = checkData.graphSnapshotId;
            setCurrGraphSnapshotId(graphSnapshotId);
            if (checkData.nodes) {
              // Apply simple grid layout to avoid (0,0) stacking
              const laidOutNodes = checkData.nodes.map((n: any, i: number) => ({
                ...n,
                position: (n.position?.x === 0 && n.position?.y === 0)
                  ? { x: (i % 6) * 280, y: Math.floor(i / 6) * 220 }
                  : n.position
              }));
              setNodes(laidOutNodes);
            }
            if (checkData.edges) setEdges(checkData.edges);
          }
          buildAttempts++;
        }
      }

      if (!graphSnapshotId) throw new Error("Graph building timed out.");

      setAnalysisStep("ANALYZING");

      // 3. Trigger Analysis
      const analyzeRes = await fetch(`http://localhost:3000/projects/${projectId}/analyze`, {
        method: "POST",
      });
      if (!analyzeRes.ok) throw new Error("Failed to start analysis");

      // 4. Poll for Risks
      const pollInterval = setInterval(async () => {
        try {
          const risksRes = await fetch(`http://localhost:3000/projects/${projectId}/risks`);
          if (risksRes.ok) {
            const data = await risksRes.json();
            // Backend returns { graphSnapshotId, risks: [...] }
            const riskList = Array.isArray(data) ? data : (data.risks || []);

            if (data.graphSnapshotId) {
              const mappedRisks: Risk[] = riskList.map((r: any) => ({
                id: r.id,
                type: r.type,
                severity: r.severity,
                title: r.title,
                description: r.description,
                ruleId: r.ruleId,
                nodeIds: r.nodeIds || (r.nodes?.map((n: any) => n.nodeId)) || [],
              }));

              setRisks(mappedRisks);
              setIsAnalyzing(false);
              setAnalysisStep("IDLE");
              setHasScanned(true);
              clearInterval(pollInterval);
            }
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 3000);

      // Stop polling after 120 seconds if no result
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsAnalyzing((prev) => {
          if (prev) {
            setAnalysisStep("IDLE");
            return false;
          }
          return prev;
        });
      }, 120000);

    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
      setAnalysisStep("IDLE");
      alert(err instanceof Error ? err.message : "Failed to analyze repository.");
    }
  };

  const handleFixRisk = async (risk: Risk) => {
    if (!currGraphSnapshotId) return;

    setIsAnalyzing(true);
    setAnalysisStep("FIXING");

    try {
      const res = await fetch(`http://localhost:3000/node-actions/refactor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          graphSnapshotId: currGraphSnapshotId,
          selectedNodeIds: risk.nodeIds,
          prompt: `Fix risk: ${risk.title}. ${risk.description}`,
        }),
      });

      if (!res.ok) throw new Error("Failed to start AI fix");

      const actionData = await res.json();
      const nodeActionId = actionData.nodeActionId;

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const statusRes = await fetch(`http://localhost:3000/node-actions/${nodeActionId}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.status === "SUCCEEDED" || statusData.status === "FAILED") {
            clearInterval(pollInterval);
            setIsAnalyzing(false);
            setAnalysisStep("IDLE");
            if (statusData.status === "FAILED") {
              alert(`AI Fix failed: ${statusData.error || "Unknown error"}`);
            } else {
              // Refresh risks after fix
              const updatedRisksRes = await fetch(`http://localhost:3000/projects/${projectId}/risks`);
              if (updatedRisksRes.ok) {
                const updatedData = await updatedRisksRes.json();
                const riskList = Array.isArray(updatedData) ? updatedData : (updatedData.risks || []);
                setRisks(riskList.map((r: any) => ({
                  id: r.id,
                  type: r.type,
                  severity: r.severity,
                  title: r.title,
                  description: r.description,
                  ruleId: r.ruleId,
                  nodeIds: r.nodeIds || (r.nodes?.map((n: any) => n.nodeId)) || [],
                })));
              }
            }
          }
        }
      }, 3000);

    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
      setAnalysisStep("IDLE");
      alert("Failed to trigger AI fix.");
    }
  };

  const runAgentCommand = async (input: string) => {
    const text = input.trim();
    if (!text) return;

    // 1. Add user message
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setIsAgentThinking(true);

    try {
      // 2. Call backend
      const res = await fetch('http://localhost:3000/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, prompt: text }),
      });

      if (!res.ok) throw new Error("Agent connection failed");
      const data = await res.json();

      // 3. Add agent response
      setChatMessages(prev => [...prev, { role: 'agent', text: data.message }]);

      // 4. Run actions
      if (data.actions && data.actions.length > 0) {
        beginBatch();
        data.actions.forEach((action: any) => applyAction(action));
        endBatch();
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'agent', text: "ERROR: System offline. Please try again later." }]);
    } finally {
      setIsAgentThinking(false);
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
    | { type: "remove"; id: string }
    | { type: "refactor"; nodeIds: string[]; prompt: string };

  const applyAction = (action: AgentAction) => {
    switch (action.type) {
      case "addNode":
        addNode(action.id, action.label);
        break;
      case "connect":
        connectNodes(action.from, action.to);
        break;
      case "expand":
        if (SUBGRAPHS[action.id] && !expandedRef.current[action.id]) {
          expandSubgraph(action.id);
          setExpanded((prev) => {
            const next = { ...prev, [action.id]: true };
            expandedRef.current = next;
            return next;
          });
        }
        break;
      case "collapse":
        if (SUBGRAPHS[action.id] && expandedRef.current[action.id]) {
          collapseSubgraph(action.id);
          setExpanded((prev) => {
            const next = { ...prev, [action.id]: false };
            expandedRef.current = next;
            return next;
          });
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
      case "refactor":
        handleFixRisk({
          id: `ai-refactor-${Date.now()}`,
          title: "AI Suggested Refactor",
          description: action.prompt || "Refactoring codebase...",
          severity: "MEDIUM",
          type: "REFACTOR",
          nodeIds: action.nodeIds || [],
          ruleId: "ai-agent-refactor"
        });
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

  return (
    <main className="min-h-screen bg-[#B3BAC9]">
      <Navbar showGetStarted={false} />

      {/* Brutalist Analysis Trigger Popup */}
      {!isAnalyzing && !hasScanned && nodes.length === 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-none p-6">
          <div className="pointer-events-auto animate-in fade-in zoom-in-95 duration-500 max-w-md w-full">
            <div className="relative transform -rotate-1">
              {/* Hard Shadow Background Layer */}
              <div className="absolute inset-0 bg-black rounded-3xl translate-x-3 translate-y-3" />

              <div className="relative bg-[#E6E6E6] border-4 border-black p-10 rounded-3xl flex flex-col items-center gap-10 text-center">
                <div className="w-24 h-24 bg-white border-4 border-black rounded-2xl flex items-center justify-center shadow-[6px_6px_0px_rgba(0,0,0,1)] -rotate-3">
                  <span className="text-5xl">✨</span>
                </div>

                <div className="space-y-4">
                  <h2 className="text-5xl font-black text-black font-epilogue tracking-tighter uppercase leading-tight">
                    AI AGENT <br /> READY
                  </h2>
                  <p className="text-black font-itim text-xl leading-relaxed">
                    Map dependencies and surface mission-critical risks in seconds.
                  </p>
                </div>

                <button
                  onClick={handleAnalyzeFn}
                  className="w-full bg-red-500 text-white font-bold text-2xl py-6 rounded-2xl border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all duration-200 uppercase font-pixelify tracking-wider"
                >
                  Start Scan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <RiskPanel
        risks={risks}
        onFix={handleFixRisk}
        onHoverRisk={(ids) => setHighlightedRiskNodes(ids)}
      />

      <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden bg-[#F8F9FB]">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(#E2E8F0 1.5px, transparent 1.5px)",
          backgroundSize: "32px 32px"
        }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[94%] h-[92%] bg-white border-4 border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] relative overflow-hidden transition-all duration-500">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              onNodeClick={(_, node) => {
                const id = node.id;
                setSelectedNodeId(id);

                if (SUBGRAPHS[id]) {
                  expanded[id] ? collapseSubgraph(id) : expandSubgraph(id);
                  toggleExpand(id);
                }
              }}
              defaultEdgeOptions={{
                style: { stroke: '#000', strokeWidth: 3 },
                type: 'smoothstep',
              }}
            >
              <Background
                color="#000"
                gap={40}
                size={2}
                variant={'lines' as any}
                style={{ opacity: 0.15 }}
              />
              <Controls className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] rounded-none" />
            </ReactFlow>
          </div>
        </div>
        {/* Brutalist Loading Overlay */}
        {isAnalyzing && (
          <div className="absolute inset-0 z-40 bg-[#B3BAC9]/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">

            <div className="max-w-md w-full px-6">
              <div className="relative">
                {/* Shadow */}
                <div className="absolute inset-0 bg-black rounded-3xl translate-x-2 translate-y-2" />

                <div className="relative bg-white border-4 border-black p-12 rounded-3xl flex flex-col items-center gap-10">
                  {/* Industrial Spinner */}
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-8 border-black/10" />
                    <div className="absolute inset-0 w-24 h-24 rounded-full border-8 border-t-red-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-black text-black font-epilogue italic">
                        {analysisStep === "INGESTING" ? "01" : analysisStep === "BUILDING" ? "02" : "03"}
                      </span>
                    </div>
                  </div>

                  <div className="text-center space-y-3">
                    <h3 className="text-4xl font-black text-black font-epilogue tracking-tighter uppercase italic">
                      {analysisStep === "INGESTING" ? "INGESTING" :
                        analysisStep === "BUILDING" ? "BUILDING" : "ANALYZING"}
                    </h3>
                    <p className="text-black font-pixelify text-sm tracking-widest uppercase bg-red-500 text-white px-3 py-1 rounded-lg border-2 border-black inline-block">
                      {analysisStep === "INGESTING" ? "Source Mapping" :
                        analysisStep === "BUILDING" ? "Graph Construction" :
                          "Risk Detection"}
                    </p>
                  </div>

                  {/* Industrial Progress Indicator */}
                  <div className="w-full flex items-center justify-between gap-2 px-4">
                    {[1, 2, 3].map((step) => {
                      const steps = ["INGESTING", "BUILDING", "ANALYZING"];
                      const isActive = analysisStep === steps[step - 1];
                      const idx = steps.indexOf(analysisStep);
                      const isDone = idx > step - 1;

                      return (
                        <React.Fragment key={step}>
                          <div className="flex flex-col items-center gap-2">
                            <div className={`w-6 h-6 rounded-md border-2 border-black flex items-center justify-center text-[10px] font-black transition-all duration-300 ${isActive ? "bg-red-500 text-white shadow-[4px_4px_0px_rgba(0,0,0,1)] -translate-x-0.5 -translate-y-0.5" : isDone ? "bg-black text-white" : "bg-white text-black"}`}>
                              {isDone ? "✓" : step}
                            </div>
                          </div>
                          {step < 3 && <div className={`flex-1 h-1 border border-black/10 rounded-full ${isDone ? "bg-black" : "bg-neutral-200"}`} />}
                        </React.Fragment>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12">
              <span className="font-pixelify text-black animate-pulse uppercase tracking-[0.2em]">Executing Agent Pipeline...</span>
            </div>
          </div>
        )}
        {showChat && (
          <div className="absolute bottom-20 left-6 w-[450px] h-[600px] bg-[#0B0A0C] border-4 border-black shadow-[10px_10px_0px_rgba(239,68,68,1)] flex flex-col z-50 rounded-none overflow-hidden">
            <div className="flex items-center justify-between p-5 bg-[#0B0A0C] border-b-4 border-black text-white text-xs font-black font-pixelify uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <span>TERMINAL://AI_AGENT_STDOUT</span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all font-black text-lg border-2 border-white/20"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 p-6 space-y-4 text-sm text-green-400 overflow-y-auto font-mono bg-[#0B0A0C]">
              <div className="text-white/20 mb-6 font-pixelify uppercase text-[10px]">SYSTEM INITIALIZED (v4.2.1)</div>
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'agent' ? 'items-start' : 'items-end'}`}>
                  <div className={`p-4 rounded-none border-2 ${m.role === 'agent' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'} max-w-[90%]`}>
                    <div className="flex items-center gap-2 mb-2 opacity-50 text-[10px] uppercase font-pixelify tracking-tighter">
                      <span>{m.role === 'agent' ? '>> ADVISOR' : '>> OPERATOR'}</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              ))}
              {isAgentThinking && (
                <div className="flex flex-col items-start animate-pulse">
                  <div className="p-4 rounded-none border-2 border-white/10 bg-white/5">
                    <p className="leading-relaxed font-pixelify tracking-[0.2em]">CALCULATING...</p>
                  </div>
                </div>
              )}
            </div>
            <form
              className="p-5 bg-[#0B0A0C] border-t-4 border-black"
              onSubmit={(e) => {
                e.preventDefault();
                if (!chatInput.trim()) return;
                runAgentCommand(chatInput);
                setChatInput("");
              }}
            >
              <div className="relative">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="EXECUTE CMD..."
                  className="w-full bg-black border-2 border-green-500/30 rounded-none px-4 py-3 text-sm text-green-400 placeholder-green-900/50 outline-none focus:border-green-500 transition-all font-mono"
                />
              </div>
            </form>
          </div>
        )}
        {!showChat && (<button className="absolute bottom-10 left-10 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow text-xl z-20" onClick={() => setShowChat(true)} aria-label="Open chat">✦</button>)}

        {selectedNodeId && nodeMeta[selectedNodeId] && (
          <NodeInspector
            nodeId={selectedNodeId}
            nodeData={nodeMeta[selectedNodeId]}
            onClose={() => setSelectedNodeId(null)}
            onUpdate={(id, updates) => {
              setNodeMeta((prev) => ({
                ...prev,
                [id]: { ...prev[id], ...updates },
              }));
            }}
            onFix={(id) => {
              const node = nodes.find(n => n.id === id);
              if (node) {
                handleFixRisk({
                  id: `manual-${id}`,
                  title: `Manual Refactor: ${node.data.label}`,
                  description: nodeMeta[id]?.description || "Requested manual refactor via inspector.",
                  severity: "MEDIUM",
                  type: "REFACTOR",
                  nodeIds: [id],
                  ruleId: "manual-refactor"
                });
              }
            }}
          />
        )}
      </div>
    </main >
  );
}
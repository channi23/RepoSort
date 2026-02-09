"use client";
import Navbar from "@/components/Navbar";
import RiskPanel from "@/components/RiskPanel";
import React, { useState, use, useEffect, useRef } from "react";
import ReactFlow, { Background, Controls, ReactFlowProvider, applyNodeChanges, applyEdgeChanges, OnNodesChange, OnEdgesChange, Node } from "reactflow";
import { useProjectStatus } from "@/hooks/useProjectStatus";
import { Risk, ProjectStatus } from "@/lib/types";
import api, { nodeActions } from "@/lib/api";
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
  LAYER: IndustrialNode,
  FUNCTION: IndustrialNode
};

export default function RepoSortingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = id;
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Use shared hook for status
  const { status: projectStatus, data: statusData, error: projectError } = useProjectStatus(projectId);

  const [nodeMeta, setNodeMeta] = useState<
    Record<string, { label: string; description: string }>
  >({});

  // AI & Risk State
  const [risks, setRisks] = useState<Risk[]>([]);
  const [analysisStep, setAnalysisStep] = useState<"IDLE" | "INGESTING" | "BUILDING" | "ANALYZING" | "FIXING">("IDLE");
  const [highlightedRiskNodes, setHighlightedRiskNodes] = useState<string[] | null>(null);
  const [currGraphSnapshotId, setCurrGraphSnapshotId] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  // Sync UI state with Project Status
  useEffect(() => {
    if (projectStatus === ProjectStatus.INGESTING) setAnalysisStep("INGESTING");
    else if (projectStatus === ProjectStatus.ANALYZING) setAnalysisStep("ANALYZING");
    else if (projectStatus === ProjectStatus.READY) {
      setAnalysisStep("IDLE");
      setHasScanned(true);
      if (statusData?.graphSnapshotId) {
        setCurrGraphSnapshotId(statusData.graphSnapshotId);
        // Trigger graph fetch if we don't have nodes yet
        if (nodes.length === 0) fetchGraph();
        fetchRisks();
      }
    }
    else if (projectStatus === ProjectStatus.FAILED) {
      setAnalysisStep("IDLE");
      alert(`Project Failed: ${projectError || 'Unknown error'}`);
    }
  }, [projectStatus, statusData]);

  // Undo/Redo history state
  const [history, setHistory] = useState<any[]>([]);
  const [future, setFuture] = useState<any[]>([]);
  const [isBatching, setIsBatching] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'agent'; text: string }[]>([
    { role: 'agent', text: 'Agent is monitoring repository structure. Ask me anything about dependencies or risks.' }
  ]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [activeActionNodeIds, setActiveActionNodeIds] = useState<Set<string>>(new Set());

  // Refs to track current state for pushHistory
  const nodesRef = useRef<any[]>([]);
  const edgesRef = useRef<any[]>([]);
  const expandedRef = useRef<Record<string, boolean>>({});
  const nodeMetaRef = useRef<Record<string, { label: string; description: string }>>({});

  // Dynamic Subgraphs Map (Populated from API)
  const subgraphsRef = useRef<Record<string, { id: string; label: string; type: string }[]>>({});

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

  // Helper: collect all descendant node ids (including root)
  const collectSubtreeIds = (rootId: string): string[] => {
    const result = new Set<string>();
    const stack = [rootId];

    while (stack.length) {
      const current = stack.pop()!;
      result.add(current);

      const children = subgraphsRef.current[current];
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
    recordHistory = true,
    type = 'FILE'
  ) => {
    if (recordHistory) {
      pushHistory();
    }
    setNodes((prev) => {
      if (prev.find((n) => n.id === id)) return prev;

      const parent = prev.find((n) => n.id === parentId);
      const position = parent
        ? { x: parent.position.x + offsetX, y: parent.position.y + offsetY }
        : { x: 120 + prev.length * 180, y: 220 }; // Default for roots

      const newNodes = [...prev, { id, type, data: { label: label ?? id }, position }];
      nodesRef.current = newNodes;
      return newNodes;
    });

    setNodeMeta((prev) => {
      const newMeta = {
        ...prev,
        [id]: { label: label ?? id, description: "", type },
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
          isAiActive: activeActionNodeIds.has(n.id),
        },
        style: highlightedRiskNodes?.includes(n.id)
          ? { border: '4px solid #ef4444', boxShadow: '0 0 15px rgba(239, 68, 68, 0.6)' }
          : undefined
      }))
    );
  }, [nodeMeta, highlightedRiskNodes, activeActionNodeIds]);

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
    const children = subgraphsRef.current[parentId];
    if (!children) return;

    // Centered Layout Config
    const CHILD_WIDTH = 250;
    const CHILD_GAP = 50;
    const totalWidth = children.length * CHILD_WIDTH + (children.length - 1) * CHILD_GAP;
    const startX = -(totalWidth / 2) + (CHILD_WIDTH / 2);

    children.forEach((child, index) => {
      addNode(
        child.id,
        child.label,
        parentId,
        startX + index * (CHILD_WIDTH + CHILD_GAP), // Centered horizontal spread
        300, // Increased vertical spacing
        false,
        child.type
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
      // Avoid duplicate edges
      if (prev.find(e => e.source === from && e.target === to)) return prev;

      const newEdges = [
        ...prev,
        {
          id: `${from}-${to}-${Date.now()}`,
          source: from,
          target: to,
          label: "CONTAINS", // Default label for UI-created edges
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

  const fetchGraph = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/graph`);
      const data = res.data;

      const apiNodes = data.nodes || [];
      const apiEdges = data.edges || [];

      // Process Edges for Containment
      const containment: Record<string, any[]> = {};
      const incomingContains = new Set<string>();

      apiEdges.forEach((e: any) => {
        if (e.label === 'CONTAINS') {
          if (!containment[e.source]) containment[e.source] = [];
          const child = apiNodes.find((n: any) => n.id === e.target);
          if (child) {
            containment[e.source].push(child);
            incomingContains.add(e.target);
          }
        }
      });

      // Populate Subgraphs Ref
      subgraphsRef.current = {};
      Object.keys(containment).forEach(parentId => {
        subgraphsRef.current[parentId] = containment[parentId].map(n => ({
          id: n.id,
          label: n.data?.label || n.id,
          type: n.type
        }));
      });

      // Hydrate meta with types from API
      const metaInit: Record<string, any> = {};
      apiNodes.forEach((n: any) => {
        metaInit[n.id] = {
          label: n.data?.label || n.id,
          description: n.data?.description || "",
          type: n.type
        };
      });
      setNodeMeta(prev => ({ ...prev, ...metaInit }));

      // Find Roots (nodes not contained by anything)
      // If no nodes have 'CONTAINS' edges pointing to them, they are roots.
      // If using 'PROJECT' as root, we can filter by type too.
      let rootNodes = apiNodes.filter((n: any) => !incomingContains.has(n.id));

      if (rootNodes.length === 0 && apiNodes.length > 0) {
        // Fallback if circular or weird structure
        rootNodes = apiNodes.filter((n: any) => n.type === 'PROJECT');
        if (rootNodes.length === 0) rootNodes = [apiNodes[0]]; // fallback to first
      }

      // Initial Layout for Roots
      const initialNodes = rootNodes.map((n: any, i: number) => ({
        ...n,
        type: n.type,
        data: { label: n.data?.label || n.id },
        position: (n.position?.x === 0 && n.position?.y === 0)
          ? { x: (i % 6) * 350, y: Math.floor(i / 6) * 300 }
          : n.position
      }));

      setNodes(initialNodes);

      // Initially show no edges or only edges between roots (likely none if they are roots)
      // Non-containment edges (calls, depends) could be shown if both nodes are visible
      // For now, start clean.
      setEdges([]);

    } catch (e) {
      console.error("Failed to load graph", e);
    }
  };

  const fetchRisks = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/risks`);
      const rList = Array.isArray(res.data) ? res.data : (res.data.risks || []);
      setRisks(rList.map((r: any) => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        title: r.title,
        description: r.description,
        ruleId: r.ruleId,
        nodeIds: r.nodeIds || (r.nodes?.map((n: any) => n.nodeId)) || [],
      })));
    } catch (e) {
      console.error("Failed to load risks", e);
    }
  };

  // --- API Integrations ---

  const handleAnalyzeFn = async () => {
    setAnalysisStep("INGESTING");
    try {
      const res = await api.post(`/projects/${projectId}/analyze`);
    } catch (err) {
      console.error(err);
      setAnalysisStep("IDLE");
      alert(err instanceof Error ? err.message : "Failed to analyze repository.");
    }
  };

  const handleFixRisk = async (risk: Risk) => {
    if (!currGraphSnapshotId) return;

    setAnalysisStep("FIXING");

    try {
      const res = await api.post(`/node-actions/refactor`, {
        projectId,
        graphSnapshotId: currGraphSnapshotId,
        selectedNodeIds: risk.nodeIds,
        prompt: `Fix risk: ${risk.title}. ${risk.description}`,
      });

      const actionData = res.data;
      const nodeActionId = actionData.nodeActionId;

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/node-actions/${nodeActionId}`);
          const statusData = statusRes.data;

          if (statusData.status === "SUCCEEDED" || statusData.status === "FAILED") {
            clearInterval(pollInterval);
            setAnalysisStep("IDLE");
            if (statusData.status === "FAILED") {
              alert(`AI Fix failed: ${statusData.error || "Unknown error"}`);
            } else {
              const updatedRisksRes = await api.get(`/projects/${projectId}/risks`);
              const updatedData = updatedRisksRes.data;
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
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(pollInterval);
      }, 120000);

    } catch (err) {
      console.error(err);
      setAnalysisStep("IDLE");
      alert("Failed to trigger AI fix.");
    }
  };

  const handleExplainNode = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setIsExplaining(true);
    try {
      // Use specialized Explain Module
      const res = await api.post('/explain', { projectId, nodeId });
      const explanation = res.data.description;

      setNodeMeta(prev => ({
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          description: explanation
        }
      }));

    } catch (e) {
      console.error("Failed to explain node", e);
      alert("Failed to generate explanation.");
    } finally {
      setIsExplaining(false);
    }
  };

  const handleRefactor = async (nodeId: string, prompt: string, type: 'REFACTOR' | 'HARDEN' | 'ADD_TESTS') => {
    try {
      const actionMap = {
        'REFACTOR': nodeActions.refactor,
        'HARDEN': nodeActions.harden,
        'ADD_TESTS': nodeActions.addTests
      };
      const apiCall = actionMap[type];
      if (!apiCall) return;

      alert(`AI Engineer dispatched! \nTask: ${type}\nTarget: ${nodeId}\n\nCheck back soon for results.`);

      const res = await apiCall({
        projectId,
        graphSnapshotId: currGraphSnapshotId,
        selectedNodeIds: [nodeId],
        prompt: prompt,
        autoApply: true
      });

      if (res.data.queued) {
        console.log("Action queued:", res.data);
      }

    } catch (e: any) {
      console.error("Refactor failed", e);
      alert(`Failed to start refactoring: ${e.response?.data?.message || e.message}`);
    }
  };


  const runAgentCommand = async (input: string) => {
    const text = input.trim();
    if (!text) return;

    setChatMessages(prev => [...prev, { role: 'user', text }]);

    // Command Parsing
    if (text.startsWith('/')) {
      const [cmd, ...args] = text.split(' ');
      const targetName = args.join(' ');

      if (cmd === '/refactor' || cmd === '/harden' || cmd === '/test') {
        if (!targetName) {
          setChatMessages(prev => [...prev, { role: 'agent', text: "Please specify a target node. Usage: /refactor <NodeName>" }]);
          return;
        }

        // Fuzzy find node
        const targetNode = nodes.find(n => n.data.label.toLowerCase().includes(targetName.toLowerCase()));

        if (targetNode) {
          const actionType = cmd === '/harden' ? 'HARDEN' : cmd === '/test' ? 'ADD_TESTS' : 'REFACTOR';
          const actionVerb = cmd === '/harden' ? 'Hardening' : cmd === '/test' ? 'Adding tests for' : 'Refactoring';

          setChatMessages(prev => [...prev, { role: 'agent', text: `Found target: [${targetNode.data.label}]. ${actionVerb}...` }]);

          // Set Visual State
          setActiveActionNodeIds(prev => new Set(prev).add(targetNode.id));

          // Trigger Action
          try {
            await handleRefactor(targetNode.id, `Agent command: ${text}`, actionType);
            setChatMessages(prev => [...prev, { role: 'agent', text: `✅ Action queued for ${targetNode.data.label}. Monitor graph for updates.` }]);
          } catch (e) {
            setChatMessages(prev => [...prev, { role: 'agent', text: `❌ Failed to execute action on ${targetNode.data.label}.` }]);
            setActiveActionNodeIds(prev => {
              const next = new Set(prev);
              next.delete(targetNode.id);
              return next;
            });
          }

          // Note: We leave it in "active" state to show work is in progress. 
          // Ideally, polling system removes it when done. For now, we clear it after 10s for demo effect if no real polling.
          setTimeout(() => {
            setActiveActionNodeIds(prev => {
              const next = new Set(prev);
              next.delete(targetNode.id);
              return next;
            });
          }, 15000); // 15s visual feedback

          return;
        } else {
          setChatMessages(prev => [...prev, { role: 'agent', text: `Could not find any node matching "${targetName}".` }]);
          return;
        }
      }
    }

    setIsAgentThinking(true);

    try {
      const res = await api.post('/agent/chat', { projectId, prompt: text });
      const data = res.data;

      setChatMessages(prev => [...prev, { role: 'agent', text: data.message }]);

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
        if (subgraphsRef.current[action.id] && !expandedRef.current[action.id]) {
          expandSubgraph(action.id);
          setExpanded((prev) => {
            const next = { ...prev, [action.id]: true };
            expandedRef.current = next;
            return next;
          });
        }
        break;
      case "collapse":
        if (subgraphsRef.current[action.id] && expandedRef.current[action.id]) {
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

  const isAnalyzing = projectStatus === ProjectStatus.INGESTING || projectStatus === ProjectStatus.ANALYZING; // Computed
  const hasGraphData = nodes.length > 0;

  return (
    <main className="min-h-screen bg-[#B3BAC9]">
      <Navbar showGetStarted={false} />

      {!isAnalyzing && !hasScanned && nodes.length === 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-none p-6">
          <div className="pointer-events-auto animate-in fade-in zoom-in-95 duration-500 max-w-md w-full">
            <div className="relative transform -rotate-1">
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
                // Check if we have children to expand
                if (subgraphsRef.current[id] && subgraphsRef.current[id].length > 0) {
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

        {isAnalyzing && (
          <div className="absolute inset-0 z-40 bg-[#B3BAC9]/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="max-w-md w-full px-6">
              <div className="relative">
                <div className="absolute inset-0 bg-black rounded-3xl translate-x-2 translate-y-2" />
                <div className="relative bg-white border-4 border-black p-12 rounded-3xl flex flex-col items-center gap-10">
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
            onExplain={handleExplainNode}
            isExplaining={isExplaining}
          />
        )}
      </div>
    </main>
  );
}
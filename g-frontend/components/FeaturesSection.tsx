"use client";
import { useState, useMemo, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import FeatureCard from "./FeatureCard";

function AutoFitOnChange({ view }: { view: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const timeout = setTimeout(() => {
      fitView({ padding: 0.2, duration: 400 });
    }, 50);

    return () => clearTimeout(timeout);
  }, [view, fitView]);

  return null;
}

const INITIAL_FILE_INSPECTORS: Record<string, any> = {
  home: {
    name: "Home.tsx",
    path: "/app/pages/Home.tsx",
    sections: [
      {
        id: "layout",
        label: "Layout",
        props: {
          wrapper: "MainLayout",
          backgroundColor: "#ffffff",
          alignment: "center",
          maxWidth: "1200px",
          padding: "24px",
          responsive: true,
        },
      },
      {
        id: "hero",
        label: "Hero Section",
        props: {
          background: "gradient",
          hasCTA: true,
          animated: true,
        },
      },
      {
        id: "features",
        label: "Features Section",
        props: {
          cards: 5,
          scrollSnap: true,
        },
      },
      {
        id: "footer",
        label: "Footer",
        props: {
          variant: "minimal",
          links: 6,
        },
      },
    ],
  },

  dashboard: {
    name: "Dashboard.tsx",
    path: "/app/pages/Dashboard.tsx",
    sections: [
      {
        id: "layout",
        label: "Layout",
        props: {
          backgroundColor: "#f9fafb",
          alignment: "left",
          padding: "16px",
          grid: "12-column",
        },
      },
      {
        id: "header",
        label: "Header",
        props: {
          title: "Dashboard",
          showBreadcrumbs: true,
          actions: ["Refresh", "Export"],
        },
      },
      {
        id: "stats",
        label: "Stats Cards",
        props: {
          cards: 4,
          columns: 4,
          animated: true,
        },
      },
      {
        id: "table",
        label: "Repositories Table",
        props: {
          rowsPerPage: 25,
          sortable: true,
          filterable: true,
        },
      },
    ],
  },

  navbar: {
    name: "Navbar.tsx",
    path: "/app/components/Navbar.tsx",
    sections: [
      {
        id: "container",
        label: "Container",
        props: {
          position: "fixed",
          height: "64px",
          backgroundColor: "#0f172a",
          blur: true,
        },
      },
      {
        id: "brand",
        label: "Brand",
        props: {
          logo: "RepoSort",
          link: "/",
        },
      },
      {
        id: "navigation",
        label: "Navigation",
        props: {
          links: ["Home", "Dashboard", "Repositories"],
          activeStyle: "underline",
        },
      },
      {
        id: "actions",
        label: "Actions",
        props: {
          buttons: ["Login", "GitHub"],
          alignment: "right",
        },
      },
    ],
  },

  card: {
    name: "Card.tsx",
    path: "/app/components/Card.tsx",
    sections: [
      {
        id: "wrapper",
        label: "Wrapper",
        props: {
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          shadow: "md",
          padding: "16px",
        },
      },
      {
        id: "header",
        label: "Header",
        props: {
          showDivider: true,
          titleSize: "sm",
        },
      },
      {
        id: "content",
        label: "Content",
        props: {
          slots: ["title", "body", "actions"],
          gap: "12px",
        },
      },
      {
        id: "footer",
        label: "Footer",
        props: {
          alignment: "right",
          showActions: true,
        },
      },
    ],
  },

  // Backend file inspectors (added below card)
  userCtrl: {
    name: "UserController.ts",
    path: "/api/controllers/UserController.ts",
    sections: [
      {
        id: "routes",
        label: "Routes",
        props: {
          endpoints: ["GET /users", "POST /users"],
          protected: true,
        },
      },
      {
        id: "logic",
        label: "Business Logic",
        props: {
          complexity: "medium",
          sideEffects: ["db-write"],
        },
      },
    ],
  },

  repoCtrl: {
    name: "RepoController.ts",
    path: "/api/controllers/RepoController.ts",
    sections: [
      {
        id: "routes",
        label: "Routes",
        props: {
          endpoints: ["GET /repos", "POST /repos"],
          protected: true,
        },
      },
      {
        id: "logic",
        label: "Business Logic",
        props: {
          complexity: "high",
          sideEffects: ["db-write", "fs-read"],
        },
      },
    ],
  },

  authSvc: {
    name: "AuthService.ts",
    path: "/api/services/AuthService.ts",
    sections: [
      {
        id: "auth",
        label: "Authentication",
        props: {
          strategy: "JWT",
          tokenTTL: "15m",
        },
      },
      {
        id: "crypto",
        label: "Crypto",
        props: {
          hashing: "bcrypt",
          saltRounds: 12,
        },
      },
    ],
  },

  graphSvc: {
    name: "GraphService.ts",
    path: "/api/services/GraphService.ts",
    sections: [
      {
        id: "analysis",
        label: "Graph Analysis",
        props: {
          algorithms: ["DFS", "BFS"],
          caching: true,
        },
      },
    ],
  },

  jwt: {
    name: "JWT.ts",
    path: "/api/auth/JWT.ts",
    sections: [
      {
        id: "tokens",
        label: "Token Handling",
        props: {
          type: "access+refresh",
          rotation: true,
        },
      },
    ],
  },

  oauth: {
    name: "OAuth.ts",
    path: "/api/auth/OAuth.ts",
    sections: [
      {
        id: "providers",
        label: "Providers",
        props: {
          enabled: ["GitHub", "Google"],
        },
      },
    ],
  },

  users: {
    name: "users",
    path: "database.tables.users",
    sections: [
      {
        id: "columns",
        label: "Columns",
        props: {
          id: "uuid (PK)",
          email: "varchar (unique)",
          created_at: "timestamp",
        },
      },
      {
        id: "usage",
        label: "Usage",
        props: {
          readHeavy: true,
          writtenBy: ["AuthService", "UserController"],
        },
      },
    ],
  },

  repos: {
    name: "repositories",
    path: "database.tables.repositories",
    sections: [
      {
        id: "columns",
        label: "Columns",
        props: {
          id: "uuid (PK)",
          owner_id: "uuid (FK)",
          name: "varchar",
        },
      },
      {
        id: "usage",
        label: "Usage",
        props: {
          readHeavy: true,
          writtenBy: ["RepoController"],
        },
      },
    ],
  },

  userIdx: {
    name: "users_email_idx",
    path: "database.indexes.users_email_idx",
    sections: [
      {
        id: "definition",
        label: "Index Definition",
        props: {
          column: "email",
          unique: true,
          type: "btree",
        },
      },
    ],
  },

  repoIdx: {
    name: "repos_owner_idx",
    path: "database.indexes.repos_owner_idx",
    sections: [
      {
        id: "definition",
        label: "Index Definition",
        props: {
          column: "owner_id",
          unique: false,
          type: "btree",
        },
      },
    ],
  },
};

export default function FeaturesSection(){
  const [view, setView] = useState<
    "project" | "system" | "frontend" | "backend" | "database"
  >("project");
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const graph = useMemo<{
    nodes: Node[];
    edges: Edge[];
  }>(() => {
    if (view === "project") {
      return {
        nodes: [
          {
            id: "project",
            data: { label: "Your Codebase" },
            position: { x: 150, y: 150 },
          },
        ],
        edges: [],
      };
    }

    if (view === "system") {
      return {
        nodes: [
          { id: "frontend", data: { label: "Frontend" }, position: { x: 50, y: 200 } },
          { id: "backend", data: { label: "Backend" }, position: { x: 200, y: 120 } },
          { id: "database", data: { label: "Database" }, position: { x: 350, y: 200 } },
        ],
        edges: [
          { id: "f-b", source: "frontend", target: "backend" },
          { id: "b-d", source: "backend", target: "database" },
        ],
      };
    }

    if (view === "frontend") {
      return {
        nodes: [
          { id: "ui", data: { label: "UI" }, position: { x: 40, y: 160 } },

          { id: "pages", data: { label: "Pages" }, position: { x: 220, y: 60 } },
          { id: "home", data: { label: "Home.tsx" }, position: { x: 400, y: 20 } },
          { id: "dashboard", data: { label: "Dashboard.tsx" }, position: { x: 400, y: 100 } },

          { id: "components", data: { label: "Components" }, position: { x: 220, y: 260 } },
          { id: "navbar", data: { label: "Navbar" }, position: { x: 400, y: 220 } },
          { id: "card", data: { label: "Card" }, position: { x: 400, y: 300 } },
        ],
        edges: [
          { id: "ui-pages", source: "ui", target: "pages" },
          { id: "ui-components", source: "ui", target: "components" },

          { id: "pages-home", source: "pages", target: "home" },
          { id: "pages-dashboard", source: "pages", target: "dashboard" },

          { id: "components-navbar", source: "components", target: "navbar" },
          { id: "components-card", source: "components", target: "card" },
        ],
      };
    }

    if (view === "backend") {
      return {
        nodes: [
          { id: "api", data: { label: "API" }, position: { x: 40, y: 160 } },

          { id: "controllers", data: { label: "Controllers" }, position: { x: 220, y: 40 } },
          { id: "userCtrl", data: { label: "UserController" }, position: { x: 400, y: 20 } },
          { id: "repoCtrl", data: { label: "RepoController" }, position: { x: 400, y: 80 } },

          { id: "services", data: { label: "Services" }, position: { x: 220, y: 160 } },
          { id: "authSvc", data: { label: "AuthService" }, position: { x: 400, y: 140 } },
          { id: "graphSvc", data: { label: "GraphService" }, position: { x: 400, y: 200 } },

          { id: "auth", data: { label: "Auth" }, position: { x: 220, y: 280 } },
          { id: "jwt", data: { label: "JWT" }, position: { x: 400, y: 260 } },
          { id: "oauth", data: { label: "OAuth" }, position: { x: 400, y: 320 } },
        ],
        edges: [
          { id: "api-c", source: "api", target: "controllers" },
          { id: "api-s", source: "api", target: "services" },
          { id: "api-a", source: "api", target: "auth" },

          { id: "c-user", source: "controllers", target: "userCtrl" },
          { id: "c-repo", source: "controllers", target: "repoCtrl" },

          { id: "s-auth", source: "services", target: "authSvc" },
          { id: "s-graph", source: "services", target: "graphSvc" },

          { id: "a-jwt", source: "auth", target: "jwt" },
          { id: "a-oauth", source: "auth", target: "oauth" },
        ],
      };
    }

    return {
      nodes: [
        { id: "db", data: { label: "Database" }, position: { x: 260, y: 20 } },

        { id: "tables", data: { label: "Tables" }, position: { x: 120, y: 140 } },
        { id: "users", data: { label: "users" }, position: { x: 40, y: 260 } },
        { id: "repos", data: { label: "repositories" }, position: { x: 200, y: 260 } },

        { id: "indexes", data: { label: "Indexes" }, position: { x: 400, y: 140 } },
        { id: "userIdx", data: { label: "users_email_idx" }, position: { x: 340, y: 260 } },
        { id: "repoIdx", data: { label: "repos_owner_idx" }, position: { x: 500, y: 260 } },
      ],
      edges: [
        { id: "db-t", source: "db", target: "tables" },
        { id: "db-i", source: "db", target: "indexes" },

        { id: "t-users", source: "tables", target: "users" },
        { id: "t-repos", source: "tables", target: "repos" },

        { id: "i-users", source: "indexes", target: "userIdx" },
        { id: "i-repos", source: "indexes", target: "repoIdx" },
      ],
    };
  }, [view]);

  const [inspectorState, setInspectorState] = useState<Record<string, any>>(
    INITIAL_FILE_INSPECTORS
  );

  return (
    <section className="relative px-6 py-16 overflow-hidden bg-[#B3BAC9]">
      <div className="relative z-10" >
        <h2 className="text-center text-5xl mb-10 text-black font-italiana">Built for students, researchers, and production engineers.</h2>
        <div className="bg-[#D9D9D9] rounded-[15px] border border-black shadow-[0px_4px_4px_rgba(49.60,161.96,196.15,0.66)] px-8 py-6 w-full mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[520px_520px] justify-center gap-12">

            {/* LEFT: Feature cards */}
            <div className="h-[420px] overflow-y-auto pr-4 snap-y snap-mandatory space-y-6 scrollbar-hide">
              <div className="snap-start h-[420px] flex items-center">
                <FeatureCard title="Visualize Your Code" description="See your entire repository as an interactive system graph." color="#8A38F5"/>
              </div>
              <div className="snap-start h-[420px] flex items-center">
                <FeatureCard title="Find Hidden Risks" description="Automatically detect architectural and security issues." color="#F03E3F"/>
              </div>
              <div className="snap-start h-[420px] flex items-center">
                <FeatureCard title="Plan Fixes Safely" description="Turn intent into clear, approval-ready repair plans." color="#375922"/>
              </div>
              <div className="snap-start h-[420px] flex items-center">
                <FeatureCard title="Apply & Verify" description="Fix code in a sandbox and re-check for risks." color="#736C2E"/>
              </div>
              <div className="snap-start h-[420px] flex items-center">
                <FeatureCard title="Explain the Changes" description="View diffs, graphs, and clear impact summaries." color="#2D4C8F"/>
              </div>
            </div>

            {/* RIGHT: Node graph preview (interactive mock) */}
            <div className="relative bg-[#EFEFEF] rounded-xl border-2 border-dashed border-black/40 overflow-hidden h-[420px]">

              {view !== "project" && (
                <button
                  onClick={() => setView(view === "system" ? "project" : "system")}
                  className="absolute top-3 left-3 z-20 rounded-lg bg-white px-3 py-1 text-sm shadow"
                >
                  ←
                </button>
              )}

              <ReactFlowProvider>
                <ReactFlow
                  nodes={graph.nodes}
                  edges={graph.edges}
                  fitView
                  onNodeClick={(event, node) => {
                    event.stopPropagation();
                    // Drill-down navigation
                    if (view === "project") {
                      setView("system");
                      return;
                    }
                    if (node.id === "frontend") {
                      setView("frontend");
                      return;
                    }
                    if (node.id === "backend") {
                      setView("backend");
                      return;
                    }
                    if (node.id === "database") {
                      setView("database");
                      return;
                    }

                    // Inspector logic: Only open inspector for real files
                    const file = inspectorState[node.id];
                    if (!file) {
                      setSelectedNode(null);
                      setActiveSection(null);
                      return;
                    }

                    setSelectedNode({
                      id: node.id,
                      label: String(node.data?.label ?? node.id),
                    });
                    // auto-select first section
                    setActiveSection(file.sections[0]?.id ?? null);
                  }}
                  onPaneClick={() => setSelectedNode(null)}
                >
                  <AutoFitOnChange view={view} />
                  <Background gap={24} />
                  <Controls />
                </ReactFlow>
              </ReactFlowProvider>

              {selectedNode && (
                <div className="absolute top-0 right-0 h-full w-[260px] bg-white border-l border-black/20 p-4 z-30 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {selectedNode.label}
                      </div>
                      <div className="text-[10px] text-black/60">
                        {inspectorState[selectedNode.id]?.path}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedNode(null);
                        setActiveSection(null);
                      }}
                      className="text-xs text-black/60 hover:text-black"
                    >
                      ✕
                    </button>
                  </div>

                  {/* File Inspector for supported files */}
                  {inspectorState[selectedNode.id] && (
                    <>
                      <div className="mb-3 text-xs font-semibold text-black/70">
                        Sections
                      </div>

                      <div className="space-y-2 mb-4">
                        {inspectorState[selectedNode.id].sections.map((section: any) => (
                          <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full text-left px-2 py-1 rounded text-xs border transition ${
                              activeSection === section.id
                                ? "bg-black text-white"
                                : "bg-white hover:bg-black/10"
                            }`}
                          >
                            {section.label}
                          </button>
                        ))}
                      </div>

                      {activeSection && (
                        <div className="border-t pt-3">
                          <div className="text-xs font-semibold mb-2">
                            {inspectorState[selectedNode.id].sections.find(
                              (s: any) => s.id === activeSection
                            )?.label} Properties
                          </div>

                          <div className="space-y-3 text-[11px]">
                            {Object.entries(
                              inspectorState[selectedNode.id].sections.find(
                                (s: any) => s.id === activeSection
                              )?.props || {}
                            ).map(([key, value]) => {

                              // Background color editor
                              if (key === "backgroundColor") {
                                return (
                                  <div key={key} className="space-y-1">
                                    <label className="text-black/60 text-[11px]">
                                      Background Color
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={String(value)}
                                        onChange={(e) => {
                                          setInspectorState((prev) => ({
                                            ...prev,
                                            [selectedNode.id]: {
                                              ...prev[selectedNode.id],
                                              sections: prev[selectedNode.id].sections.map((s: any) =>
                                                s.id === activeSection
                                                  ? {
                                                      ...s,
                                                      props: {
                                                        ...s.props,
                                                        backgroundColor: e.target.value,
                                                      },
                                                    }
                                                  : s
                                              ),
                                            },
                                          }));
                                        }}
                                        className="h-6 w-6 border rounded"
                                      />
                                      <span className="text-[11px] font-medium">
                                        {String(value)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              // Alignment editor
                              if (key === "alignment") {
                                return (
                                  <div key={key} className="space-y-1">
                                    <label className="text-black/60 text-[11px]">
                                      Alignment
                                    </label>
                                    <select
                                      value={String(value)}
                                      onChange={(e) => {
                                        setInspectorState((prev) => ({
                                          ...prev,
                                          [selectedNode.id]: {
                                            ...prev[selectedNode.id],
                                            sections: prev[selectedNode.id].sections.map((s: any) =>
                                              s.id === activeSection
                                                ? {
                                                    ...s,
                                                    props: {
                                                      ...s.props,
                                                      alignment: e.target.value,
                                                    },
                                                  }
                                                : s
                                            ),
                                          },
                                        }));
                                      }}
                                      className="w-full border rounded px-1 py-[2px] text-[11px]"
                                    >
                                      <option value="left">Left</option>
                                      <option value="center">Center</option>
                                      <option value="right">Right</option>
                                    </select>
                                  </div>
                                );
                              }

                              // Padding editor
                              if (key === "padding") {
                                return (
                                  <div key={key} className="space-y-1">
                                    <label className="text-black/60 text-[11px]">
                                      Padding
                                    </label>
                                    <input
                                      type="text"
                                      value={String(value)}
                                      onChange={(e) => {
                                        setInspectorState((prev) => ({
                                          ...prev,
                                          [selectedNode.id]: {
                                            ...prev[selectedNode.id],
                                            sections: prev[selectedNode.id].sections.map((s: any) =>
                                              s.id === activeSection
                                                ? {
                                                    ...s,
                                                    props: {
                                                      ...s.props,
                                                      padding: e.target.value,
                                                    },
                                                  }
                                                : s
                                            ),
                                          },
                                        }));
                                      }}
                                      className="w-full border rounded px-1 py-[2px] text-[11px]"
                                    />
                                  </div>
                                );
                              }

                              // Default read-only field
                              return (
                                <div key={key} className="flex justify-between">
                                  <span className="text-black/60 text-[11px]">{key}</span>
                                  <span className="font-medium text-[11px]">
                                    {String(value)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            </div>

          </div>
        </div>
      </div>
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
      `}</style>
    </section>
  );
}
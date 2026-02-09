
export enum SnapshotStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

export enum ProjectStatus {
    PENDING = 'PENDING',
    INGESTING = 'INGESTING',
    ANALYZING = 'ANALYZING',
    READY = 'READY',
    FAILED = 'FAILED'
}

export interface Project {
    id: string;
    url: string;
    name: string;
    status: ProjectStatus;
}

export interface RepoSnapshot {
    id: string;
    projectId: string;
    status: SnapshotStatus;
}

export interface GraphSnapshot {
    id: string;
    projectId: string;
    repoSnapshotId: string;
    status: SnapshotStatus;
    nodes: any[];
    edges: any[];
}

export interface ProjectStatusResponse {
    status: ProjectStatus;
    error: string | null;
    details: string | null;
    repoSnapshotId: string | null;
    graphSnapshotId: string | null;
    nodesCount: number;
    edgesCount: number;
    risksCount: number;
}

export interface Risk {
    id: string;
    type: "STRUCTURAL" | "SECURITY" | "REFACTOR" | "UI";
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    title: string;
    description: string;
    ruleId: string;
    nodeIds: string[];
}

export interface NodeAction {
    id: string;
    type: 'REFACTOR' | 'HARDEN' | 'ADD_TESTS' | 'OPTIMIZE' | 'RENAME';
    status: 'QUEUED' | 'PENDING_APPROVAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    planId?: string;
    runId?: string;
    error?: string | null;
}

export interface CreateNodeActionDto {
    type: 'REFACTOR' | 'HARDEN' | 'ADD_TESTS' | 'OPTIMIZE' | 'RENAME';
    projectId: string;
    graphSnapshotId: string;
    selectedNodeIds: string[];
    prompt?: string;
    autoApply?: boolean;
}

export interface NodeActionResponse {
    queued: boolean;
    nodeActionId: string;
    jobId?: string;
    planId?: string;
    traceId?: string;
    requiresApproval?: boolean;
    approvalId?: string;
}

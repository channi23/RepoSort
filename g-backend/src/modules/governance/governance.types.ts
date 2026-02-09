export const ROLES = ['admin', 'developer', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const POLICY_DECISIONS = ['ALLOW', 'REQUIRE_APPROVAL', 'DENY'] as const;
export type PolicyDecision = (typeof POLICY_DECISIONS)[number];

export type PolicyInput = {
  actionType: string;
  projectId: string;
  nodeIds?: string[];
  prompt?: string;
  runId?: string;
  targetNodePaths?: string[];
  command?: string;
};

export type PolicyResult = {
  decision: PolicyDecision;
  reasons: string[];
};

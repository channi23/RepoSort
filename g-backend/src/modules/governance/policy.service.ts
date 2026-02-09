import { Injectable } from '@nestjs/common';
import { SandboxService } from '../../sandbox/sandbox.service';
import type { PolicyInput, PolicyResult } from './governance.types';

const DENY_PROMPT_KEYWORDS = ['delete', 'rm -rf', 'exfiltrate', 'steal', 'backdoor', 'disable auth', 'bypass'];
const SECURITY_PATH_MARKERS = ['auth', 'login', 'jwt', 'guards', 'middleware'];

@Injectable()
export class PolicyService {
  constructor(private readonly sandbox: SandboxService) {}

  evaluateAction(input: PolicyInput): PolicyResult {
    const reasons: string[] = [];
    const prompt = String(input.prompt ?? '').toLowerCase();

    if (DENY_PROMPT_KEYWORDS.some((kw) => prompt.includes(kw))) {
      reasons.push('Prompt contains disallowed destructive/exfiltration/security-bypass keywords');
      return { decision: 'DENY', reasons };
    }

    const paths = (input.targetNodePaths ?? []).map((p) => String(p).toLowerCase());
    const touchesSecurityPaths = paths.some((p) => SECURITY_PATH_MARKERS.some((marker) => p.includes(marker)));

    if (String(input.actionType).toUpperCase() === 'HARDEN' || touchesSecurityPaths) {
      reasons.push('Security-sensitive action requires explicit admin approval');
      return { decision: 'REQUIRE_APPROVAL', reasons };
    }

    if (input.command && !this.sandbox.isCommandAllowed(input.command)) {
      reasons.push(`Sandbox command not allowlisted: ${input.command}`);
      return { decision: 'DENY', reasons };
    }

    return { decision: 'ALLOW', reasons: ['Action matched baseline policy'] };
  }
}

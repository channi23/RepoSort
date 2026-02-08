"use client";
import React from "react";

type FeatureCardProps = {
  title: string;
  description: string;
  color: string;
};

const featureDetails: Record<string, {
  icon: React.ReactNode;
  bullets: string[];
  stats?: string;
}> = {
  "Visualize Your Code": {
    icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
        <line x1="12" y1="9" x2="12" y2="5" />
        <line x1="9" y1="12" x2="6" y2="8" />
        <line x1="15" y1="12" x2="18" y2="8" />
        <line x1="9" y1="12" x2="6" y2="16" />
        <line x1="15" y1="12" x2="18" y2="16" />
      </svg>
    ),
    bullets: [
      "Interactive dependency graphs",
      "Component hierarchy mapping",
      "Real-time architecture view",
      "Cross-module relationships",
      "Visual code structure",
      "System overview at a glance"
    ],
    stats: "Map your entire codebase"
  },
  "Find Hidden Risks": {
    icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    bullets: [
      "Circular dependency detection",
      "Security vulnerability scanning",
      "Anti-pattern identification",
      "Technical debt tracking",
      "Code smell detection",
      "Architecture violations"
    ],
    stats: "Prevent issues before deployment"
  },
  "Plan Fixes Safely": {
    icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="15" x2="15" y2="15" />
        <line x1="9" y1="11" x2="12" y2="11" />
      </svg>
    ),
    bullets: [
      "AI-powered repair suggestions",
      "Impact analysis for changes",
      "Implementation guides",
      "Team collaboration tools",
      "Risk assessment reports",
      "Approval workflows"
    ],
    stats: "Smart refactoring made simple"
  },
  "Apply & Verify": {
    icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
    bullets: [
      "Isolated sandbox testing",
      "Automated code generation",
      "Pre-deployment validation",
      "Rollback safety checks",
      "Quality assurance tests",
      "Continuous verification"
    ],
    stats: "Test safely, deploy confidently"
  },
  "Explain the Changes": {
    icon: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    bullets: [
      "Visual diff comparisons",
      "Architecture impact reports",
      "Auto-generated docs",
      "Performance tracking",
      "Change summaries",
      "Stakeholder insights"
    ],
    stats: "Clear communication for everyone"
  }
};

export default function FeatureCard({
  title,
  description,
  color,
}: FeatureCardProps) {
  const details = featureDetails[title];
  
  return (
    <div 
      style={{ backgroundColor: color }} 
      className="rounded-2xl shadow-[0px_8px_16px_rgba(0,0,0,0.3)] text-white w-full h-full flex flex-col overflow-hidden"
    >
      {/* Header with Icon */}
      <div className="px-8 pt-8 pb-5 flex items-start gap-5">
        <div className="flex-shrink-0 w-16 h-16 text-white/90">
          {details?.icon}
        </div>
        <h3 className="text-4xl font-itim flex-1 leading-tight pt-1">{title}</h3>
      </div>
      
      <div className="mx-8 h-px bg-white/60" />
      
      <div className="px-8 pt-6 pb-5">
        <p className="text-2xl leading-relaxed font-itim opacity-95">{description}</p>
      </div>

      {/* Stats/Tagline */}
      {details?.stats && (
        <div className="mx-8 mb-5 px-5 py-3 bg-white/15 rounded-lg">
          <p className="text-lg font-itim text-center text-white/95">
            {details.stats}
          </p>
        </div>
      )}

      {/* Feature Bullets */}
      {details?.bullets && (
        <div className="px-8 pb-8 space-y-3 flex-1">
          {details.bullets.map((bullet, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-white/90 flex-shrink-0 mt-2" />
              <p className="text-white/95 font-itim leading-relaxed text-lg">
                {bullet}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
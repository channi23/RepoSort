"use client";

import { useState } from "react";

export interface Risk {
    id: string;
    type: "STRUCTURAL" | "SECURITY" | "REFACTOR" | "UI";
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    title: string;
    description: string;
    ruleId: string;
    nodeIds: string[];
}

type RiskPanelProps = {
    risks: Risk[];
    onFix: (risk: Risk) => void;
    onHoverRisk: (nodeIds: string[] | null) => void;
};

export default function RiskPanel({ risks, onFix, onHoverRisk }: RiskPanelProps) {
    const [isOpen, setIsOpen] = useState(true);

    if (risks.length === 0) return null;

    return (
        <div
            className={`absolute top-10 left-10 bg-[#E6E6E6] border-4 border-black shadow-[10px_10px_0px_rgba(0,0,0,1)] transition-all duration-500 overflow-hidden flex flex-col z-30 ${isOpen ? "w-[380px] h-[calc(100vh-160px)] rounded-3xl" : "w-16 h-16 rounded-2xl"
                }`}
        >
            <div
                className={`p-6 flex items-center justify-between border-b-4 border-black bg-white cursor-pointer select-none`}
                onClick={() => !isOpen && setIsOpen(true)}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${risks.length > 0 ? "bg-red-500" : "bg-black"} border-2 border-black rounded flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,1)] transform ${isOpen ? "-rotate-3" : "rotate-0"}`}>
                        <span className="text-white font-bold text-xl">!</span>
                    </div>
                    {isOpen && <h2 className="text-2xl font-black text-black font-epilogue uppercase italic tracking-tighter">Detected Risks</h2>}
                </div>
                {isOpen && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                        }}
                        className="w-8 h-8 flex items-center justify-center hover:bg-black hover:text-white rounded-md transition-all font-black text-lg"
                    >
                        ✕
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {risks.map((risk) => (
                        <div
                            key={risk.id}
                            className="bg-white border-4 border-black p-5 shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all group"
                            onMouseEnter={() => onHoverRisk(risk.nodeIds)}
                            onMouseLeave={() => onHoverRisk(null)}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span
                                    className={`text-[10px] font-black px-3 py-1 border-2 border-black uppercase tracking-widest ${risk.severity === "CRITICAL" || risk.severity === "HIGH"
                                        ? "bg-red-500 text-white"
                                        : "bg-white text-black"
                                        }`}
                                >
                                    {risk.severity}
                                </span>
                                <span className="text-[10px] text-black/40 font-pixelify font-bold">
                                    {risk.ruleId}
                                </span>
                            </div>
                            <h4 className="text-xl font-bold text-black mb-2 leading-tight font-epilogue uppercase">
                                {risk.title}
                            </h4>
                            <p className="text-sm text-black font-itim mb-4 leading-relaxed">
                                {risk.description}
                            </p>
                            <button
                                onClick={() => onFix(risk)}
                                className="w-full py-4 bg-red-500 text-white text-sm font-black rounded-xl border-4 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all duration-200 uppercase font-pixelify tracking-widest"
                            >
                                ✨ FIX WITH AI
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

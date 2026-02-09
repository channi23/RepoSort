import React from 'react';

interface NodeInspectorProps {
    nodeId: string | null;
    nodeData: any;
    onClose: () => void;
    onUpdate: (id: string, updates: { label?: string; description?: string }) => void;
    onFix?: (id: string) => void;
}

const NodeInspector = ({ nodeId, nodeData, onClose, onUpdate, onFix }: NodeInspectorProps) => {
    if (!nodeId || !nodeData) return null;

    return (
        <div className="absolute top-24 right-6 w-[400px] bg-[#E6E6E6] border-4 border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] flex flex-col z-50 rounded-3xl overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-5 bg-white border-b-4 border-black">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-pixelify tracking-widest opacity-60">Inspector</span>
                    <h2 className="text-xl font-black font-epilogue uppercase truncate max-w-[280px]">
                        {nodeData.label}
                    </h2>
                </div>
                <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center hover:bg-black hover:text-white rounded-xl border-2 border-black transition-all font-black text-lg"
                >
                    ✕
                </button>
            </div>

            <div className="flex-1 p-6 space-y-6 overflow-y-auto font-itim">
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider opacity-60">Identifier</label>
                    <div className="bg-white/50 border-2 border-black/10 rounded-xl p-3 text-sm font-mono break-all italic">
                        {nodeId}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider opacity-60">Label</label>
                    <input
                        value={nodeData.label}
                        onChange={(e) => onUpdate(nodeId, { label: e.target.value })}
                        className="w-full bg-white border-2 border-black rounded-xl px-4 py-2 text-base outline-none focus:ring-2 focus:ring-red-500 transition-all font-bold"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider opacity-60">Description / Documentation</label>
                    <textarea
                        value={nodeData.description || ""}
                        onChange={(e) => onUpdate(nodeId, { description: e.target.value })}
                        rows={4}
                        className="w-full bg-white border-2 border-black rounded-xl px-4 py-2 text-base outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none italic"
                        placeholder="No documentation available..."
                    />
                </div>

                {onFix && (
                    <button
                        onClick={() => onFix(nodeId)}
                        className="w-full bg-red-500 text-white font-bold py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all uppercase font-pixelify tracking-tighter"
                    >
                        Refactor with AI
                    </button>
                )}
            </div>

            <div className="p-4 bg-white border-t-4 border-black text-[10px] font-mono text-center opacity-40 uppercase tracking-widest">
                Industrial Diagnostics Tool v2.1.0
            </div>
        </div>
    );
};

export default NodeInspector;

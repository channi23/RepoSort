import React from 'react';

interface NodeInspectorProps {
    nodeId: string | null;
    nodeData: any;
    onClose: () => void;
    onUpdate: (id: string, updates: { label?: string; description?: string }) => void;
    onFix?: (id: string) => void;
    onExplain?: (id: string) => void;
    isExplaining?: boolean;
}

const NodeInspector = ({ nodeId, nodeData, onClose, onUpdate, onExplain, isExplaining }: NodeInspectorProps) => {
    // Auto-trigger explanation if missing
    React.useEffect(() => {
        if (!nodeData.description && onExplain && !isExplaining) {
            onExplain(nodeId!);
        }
    }, [nodeId]);

    if (!nodeId || !nodeData) return null;

    return (
        <div className="absolute top-24 right-6 w-[400px] bg-[#E6E6E6] border-4 border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] flex flex-col z-50 rounded-3xl overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-5 bg-white border-b-4 border-black text-black">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-pixelify tracking-widest opacity-60">Inspector</span>
                    <h2 className="text-xl font-black font-epilogue uppercase truncate max-w-[280px] text-black">
                        {nodeData.label}
                    </h2>
                </div>
                <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center rounded-xl border-2 border-black hover:bg-black hover:text-white transition-all font-black text-lg"
                >
                    ✕
                </button>
            </div>

            <div className="flex-1 p-6 space-y-6 overflow-y-auto font-itim">
                <div className="space-y-2 h-full flex flex-col">
                    <label className="text-xs font-black uppercase tracking-wider opacity-60 text-black">AI Description</label>
                    <div className="relative flex-1">
                        {isExplaining ? (
                            <div className="w-full h-40 bg-white/50 border-2 border-black/10 rounded-xl flex items-center justify-center animate-pulse">
                                <span className="font-pixelify uppercase tracking-widest text-xs">Analyzing...</span>
                            </div>
                        ) : (
                            <textarea
                                value={nodeData.description || ""}
                                onChange={(e) => onUpdate(nodeId, { description: e.target.value })}
                                rows={12}
                                className="w-full h-full min-h-[200px] bg-white border-2 border-black rounded-xl px-4 py-4 text-base outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none italic text-black placeholder:text-black/30"
                                placeholder="Waiting for AI description..."
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 bg-white border-t-4 border-black text-[10px] font-mono text-center opacity-40 uppercase tracking-widest text-black">
                Industrial Diagnostics Tool v2.1.0
            </div>
        </div>
    );
};

export default NodeInspector;

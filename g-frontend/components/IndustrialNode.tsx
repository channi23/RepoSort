import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const IndustrialNode = ({ data, selected, type }: NodeProps) => {
    const nodeType = data.nodeType || type || 'FILE';
    const isProject = nodeType === 'PROJECT';
    const isDir = nodeType === 'DIR' || nodeType === 'MODULE' || nodeType === 'SERVICE';
    const isConfig = nodeType === 'CONFIG';

    let bgColor = 'bg-white';
    let textColor = 'text-black';
    let borderColor = 'border-black';
    let icon = '📄';

    if (isProject) {
        bgColor = 'bg-white';
        borderColor = 'border-black';
        icon = '🏗️';
    } else if (isDir) {
        bgColor = 'bg-[#D1D5DB]';
        borderColor = 'border-black';
        icon = '📁';
    } else if (isConfig) {
        bgColor = 'bg-yellow-400';
        borderColor = 'border-yellow-600';
        icon = '⚙️';
    } else if (nodeType === 'MODULE') {
        borderColor = 'border-blue-500';
    } else if (nodeType === 'SERVICE') {
        borderColor = 'border-purple-500';
    } else if (nodeType === 'LAYER') {
        borderColor = 'border-green-500';
    } else if (nodeType === 'FUNCTION') {
        borderColor = 'border-pink-500';
    }

    const isAiActive = data.isAiActive;

    return (
        <div className={`
      relative px-6 py-4 min-w-[180px]
      border-4 ${isAiActive ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.6)] animate-pulse' : borderColor} rounded-xl
      ${isAiActive ? 'bg-slate-900 text-white' : bgColor} ${!isAiActive ? textColor : ''}
      ${selected && !isAiActive ? 'shadow-[12px_12px_0px_rgba(0,0,0,1)]' : ''}
      transition-all duration-200
      flex flex-col gap-2
    `}>
            {isAiActive && (
                <div className="absolute -top-3 -right-3 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg z-10 animate-bounce">
                    AI ACTIVE
                </div>
            )}

            <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-black !border-2 !border-white" />

            <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div className="flex flex-col">
                    <span className={`text-[10px] uppercase font-pixelify tracking-widest opacity-60 ${isAiActive ? 'text-indigo-300' : ''}`}>
                        {data.nodeType ?? 'Node'}
                    </span>
                    <span className="font-epilogue font-black uppercase text-sm leading-tight">
                        {data.label}
                    </span>
                </div>
            </div>

            {data.description && (
                <div className={`mt-2 text-[10px] font-itim leading-tight border-t-2 pt-2 italic ${isAiActive ? 'border-indigo-500/30 text-indigo-200' : 'border-black/10'}`}>
                    {data.description}
                </div>
            )}

            <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-black !border-2 !border-white" />
        </div>
    );
};

export default memo(IndustrialNode);

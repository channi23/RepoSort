import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const IndustrialNode = ({ data, selected, type }: NodeProps) => {
    const isProject = type === 'PROJECT';
    const isDir = type === 'DIR' || type === 'MODULE' || type === 'SERVICE';
    const isConfig = type === 'CONFIG';

    let bgColor = 'bg-white';
    let textColor = 'text-black';
    let icon = '📄';

    if (isProject) {
        bgColor = 'bg-red-500';
        textColor = 'text-white';
        icon = '🏗️';
    } else if (isDir) {
        bgColor = 'bg-[#D1D5DB]';
        icon = '📁';
    } else if (isConfig) {
        bgColor = 'bg-yellow-400';
        icon = '⚙️';
    }

    return (
        <div className={`
      relative px-6 py-4 min-w-[180px]
      border-4 border-black rounded-xl
      ${bgColor} ${textColor}
      ${selected ? 'shadow-[12px_12px_0px_rgba(0,0,0,1)]' : 'shadow-[6px_6px_0px_rgba(0,0,0,1)]'}
      transition-all duration-200
      flex flex-col gap-2
    `}>
            <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-black !border-2 !border-white" />

            <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-pixelify tracking-widest opacity-60">
                        {type ?? 'Node'}
                    </span>
                    <span className="font-epilogue font-black uppercase text-sm leading-tight">
                        {data.label}
                    </span>
                </div>
            </div>

            {data.description && (
                <div className="mt-2 text-[10px] font-itim leading-tight border-t-2 border-black/10 pt-2 italic">
                    {data.description}
                </div>
            )}

            <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-black !border-2 !border-white" />
        </div>
    );
};

export default memo(IndustrialNode);

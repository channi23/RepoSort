"use client";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import panda from "@/assets/panda.png";

// --- Types ---
type SnapPieceProps = {
  children: React.ReactNode;
  className?: string;
  initialOffset: { x: number; y: number; r: number };
};

// --- Draggable Snap Component ---
function SnapPiece({ children, className = "", initialOffset }: SnapPieceProps) {
  const [position, setPosition] = useState(initialOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapped, setIsSnapped] = useState(false);
  
  // New state: controls the visibility of the success checkmark
  const [showSuccess, setShowSuccess] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  // Threshold to snap (in pixels)
  const SNAP_THRESHOLD = 60;

  // Timer to hide the tick mark after 2 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSnapped) return; // Locked once sorted
    
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPosition({
      x: startPos.current.x + dx,
      y: startPos.current.y + dy,
      r: position.r // Maintain rotation while dragging
    });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Check distance to "Home" (0,0)
    const distance = Math.sqrt(position.x * position.x + position.y * position.y);
    
    if (distance < SNAP_THRESHOLD) {
      // SNAP!
      setPosition({ x: 0, y: 0, r: 0 });
      setIsSnapped(true);
      setShowSuccess(true); // Trigger the tick mark animation
    }
  };

  // Global listeners for dragging outside element bounds
  useEffect(() => {
    if (isDragging) {
      // Cast to 'any' needed because React.MouseEvent isn't perfectly compatible with native MouseEvent types in strict mode
      window.addEventListener("mousemove", handleMouseMove as any);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove as any);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove as any);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className={`relative ${className}`}>
      
      {/* 1. THE GHOST SLOT (Dashed Outline) */}
      <div className={`absolute inset-0 border-4 border-dashed border-black/10 rounded-3xl transition-opacity duration-500 ${isSnapped ? "opacity-0" : "opacity-100"}`}>
        <div className="absolute inset-0 flex items-center justify-center">
           <span className="text-black/10 font-bold font-epilogue text-2xl uppercase tracking-widest">Place Here</span>
        </div>
      </div>

      {/* 2. THE ACTUAL PIECE */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) rotate(${position.r}deg)`,
          zIndex: isDragging ? 50 : (isSnapped ? 1 : 10),
          cursor: isSnapped ? "default" : (isDragging ? "grabbing" : "grab"),
          transition: isDragging ? "none" : "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        className={`relative transition-shadow duration-300 ${isDragging ? "scale-105 shadow-2xl" : ""} ${isSnapped ? "scale-100" : ""}`}
      >
        {children}

        {/* Success Checkmark overlay */}
        <div 
          className={`absolute -top-3 -right-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-500 ${showSuccess ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-0 rotate-180"}`}
        >
          ✓
        </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="relative w-full bg-[#B3BAC9] px-6 py-20 overflow-hidden min-h-[90vh] flex flex-col justify-center">
      
      {/* Background Grid */}
      <div 
        className="absolute inset-0 opacity-[0.05] pointer-events-none" 
        style={{ backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)", backgroundSize: "20px 20px" }} 
      />

      <div className="max-w-[1400px] mx-auto w-full relative z-10 space-y-16">
        
        {/* HEADER AREA */}
        <div className="flex flex-col items-center justify-center space-y-8">
          
          {/* PIECE 1: TITLE (Starts top-left) */}
          <SnapPiece 
            initialOffset={{ x: -150, y: -50, r: -4 }}
            className="w-auto"
          >
            <div className="bg-[#E6E6E6] rounded-xl shadow-[0px_10px_0px_rgba(0,0,0,0.15)] border border-white/40 px-16 py-6 select-none">
              <h1 className="text-7xl md:text-9xl font-bold tracking-[1.31px] text-[#0B0A0C] font-epilogue text-center drop-shadow-sm pointer-events-none">
                RepoSort
              </h1>
            </div>
          </SnapPiece>
          
          {/* PIECE 2: BADGE (Starts bottom-right) */}
          <SnapPiece 
             initialOffset={{ x: 200, y: 100, r: 6 }}
             className="z-20"
          >
            <div className="bg-red-500 px-8 py-3 rounded-lg border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] select-none">
              <span className="text-white text-lg md:text-xl font-bold font-sintony tracking-wide pointer-events-none">
                Understand. Fix. Trust your codebase.
              </span>
            </div>
          </SnapPiece>

        </div>

        {/* CONTENT AREA */}
        <div className="flex flex-col lg:flex-row items-start justify-between gap-8 lg:gap-12">
          
          {/* PIECE 3: FEATURES (Starts bottom-left) */}
          <SnapPiece 
            initialOffset={{ x: -100, y: 150, r: 3 }}
            className="w-full lg:w-1/2"
          >
            <div className="bg-[#E6E6E6] rounded-3xl p-10 shadow-[0px_4px_4px_rgba(46,94,195,1)] border border-white/50 select-none h-full">
              <h2 className="text-3xl md:text-4xl mb-6 text-black font-itim pointer-events-none">
                From Chaos to Clarity:
              </h2>
              <ul className="list-disc list-outside ml-6 space-y-3 text-xl md:text-2xl text-black font-itim leading-relaxed pointer-events-none">
                <li className="pl-2">Auto-detect project structure</li>
                <li className="pl-2">Separate frontend, backend, docs, configs</li>
                <li className="pl-2">Map dependencies & risks</li>
                <li className="pl-2">Give you a clear visual graph</li>
              </ul>
            </div>
          </SnapPiece>

          {/* PIECE 4: PANDA (Starts top-right) */}
          <SnapPiece 
             initialOffset={{ x: 150, y: -100, r: -5 }}
             className="w-full lg:w-1/2 flex justify-center"
          >
             <div className="relative w-full max-w-[500px] h-auto p-4 bg-white rounded-2xl shadow-xl border-4 border-white select-none">
                <Image 
                  src={panda} 
                  alt="RepoSort Mascot" 
                  width={500}
                  height={500}
                  className="object-contain pointer-events-none"
                  priority
                />
             </div>
          </SnapPiece>
        </div>

      </div>
    </section>
  );
}
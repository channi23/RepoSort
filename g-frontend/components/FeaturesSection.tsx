"use client";
import {useRef,useEffect} from 'react';
import FeatureCard from "./FeatureCard";
export default function FeaturesSection(){
  const scrollRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=scrollRef.current;
    if (!el) return;
    const handleWheel=(e:WheelEvent)=>{
      if (e.deltaX!==0) return;
      e.preventDefault(); //code rabbit 
      el.scrollLeft+=e.deltaY;
    };
    el.addEventListener('wheel', handleWheel, {passive:false});
    return ()=>{
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);
  return (
    <section className="relative px-8 py-20 overflow-hidden bg-[#B3BAC9]"> 
      <div className="relative z-10" >
        <h2 className="text-center text-6xl mb-12 text-black font-italiana">Built for students, researchers, and production engineers.</h2>
        <div className="bg-[#D9D9D9] rounded-[15px] border border-black shadow-[0px_4px_4px_rgba(49.60,161.96,196.15,0.66)] p-10">
          {/* before we couldnt easily glide on a desktop now we can work on both trackpad and a mouse too.
            <div className="flex gap-10 overflow-x-auto scroll-smooth no-scrollbar>
          */}
          <div className="flex gap-10 overflow-x-auto scroll-smooth no-scrollbar focus:outline focus:outline-2 focus:outline-offset-2" ref={scrollRef} tabIndex={0} aria-label="Features showcase">
            <FeatureCard title="Visualize Your Code" description="See your entire repository as an interactive system graph." color="#8A38F5"/>
            <FeatureCard title="Find Hidden Risks" description="Automatically detect architectural and security issues." color="#F03E3F"/>
            <FeatureCard title="Plan Fixes Safely" description="Turn intent into clear, approval-ready repair plans." color="#375922"/>
            <FeatureCard title="Apply & Verify" description="Fix code in a sandbox and re-check for risks." color="#736C2E"/>
            <FeatureCard title="Explain the Changes" description="View diffs, graphs, and clear impact summaries." color="#2D4C8F"/>
          </div>
        </div>
      </div>
    </section>
  );
}
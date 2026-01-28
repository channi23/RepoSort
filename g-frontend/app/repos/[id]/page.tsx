"use client";
import Navbar from "@/components/AuthNavbar";
import {useState,use,useEffect} from "react";
export default function RepoSortingPage({
  params,
}: {params:Promise<{id:string}>;
}) {const {id}=use(params);
  const [showChat,setShowChat]=useState(false);
  const hasGraphData=false; // backend will control this later a flag which should return True when data is connected
  const statuses=[
    "1",
    "2",
    "3", //change it later to the needed words for laoding 
    "4",
    "5",
  ];
  const [statusIndex, setStatusIndex] = useState(0);
  useEffect(()=>{
    const id=setInterval(()=>{
      setStatusIndex((i)=>(i+1)%statuses.length); //this interval needed to be rmoved when connecting backend
    },1600);
    return ()=>clearInterval(id);
  },[]);
  return (
    <main className="min-h-screen bg-[#B3BAC9]">
      <Navbar/>
      <div className="relative w-full h-[calc(100vh-96px)] overflow-hidden">
        {!hasGraphData&&(<div className="absolute inset-0" style={{backgroundImage:"radial-gradient(#6B84C6 1px, transparent 1px)",backgroundSize:"24px 24px",}}/>)}
        {hasGraphData&&(<div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[85%] h-[85%] bg-[#E6E6E6] rounded-3xl shadow-[0px_8px_40px_rgba(0,0,0,0.25)] relative overflow-hidden">
              {/* backend-rendered nodes will live here la-la-la-la boom */}
            </div>
          </div>)}
        {/*so here the node backend goes marking for easy implementaion */}
        {!hasGraphData && (<div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin w-6 h-6 border-2 border-black/30 border-t-black rounded-full" />
            <p className="text-black/60 font-itim text-lg">
              {statuses[statusIndex]}
            </p>
          </div>)}
        {showChat && (<div className="absolute bottom-20 left-6 w-[420px] h-[560px] bg-[#5E6B91] rounded-2xl shadow-lg p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3 text-white text-sm">
              <span>Agent</span>
              <button onClick={() => setShowChat(false)}>✕</button>
            </div>
            <div className="flex-1 space-y-3 text-base text-white overflow-hidden"></div>
            <div className="mt-3 bg-[#8E9AD0] rounded-lg px-3 py-2 text-base text-white opacity-80">Ask RepoSort</div>
          </div>)}
        {!showChat && (<button className="absolute bottom-10 left-10 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow text-xl" onClick={() => setShowChat(true)} aria-label="Open chat">✦</button>)}
      </div>
    </main>
  );
}
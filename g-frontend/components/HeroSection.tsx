import Image from "next/image";
import panda from "@/assets/panda.png";
export default function HeroSection() {
  return (
    <section className="relative px-6 py-12 overflow-hidden bg-[#B3BAC9]"> 
      <div className="relative max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center mb-16">
          <div className="relative z-10 bg-[#E6E6E6] rounded-xl shadow-lg px-16 py-4 md:px-24 md:py-6">
            <h1 className="text-7xl md:text-9xl font-bold tracking-wide text-neutral-950 font-epilogue drop-shadow-sm text-center">RepoSort</h1>
          </div>        
          <div className="relative z-10 -mt-5 bg-red-500 rounded-lg px-8 py-2 shadow-md">
            <span className="text-white text-base md:text-xl font-bold tracking-wide font-sintony">Understand. Fix. Trust your codebase.</span>
          </div>
        </div>
        <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="w-full lg:w-1/2 bg-[#E6E6E6] rounded-3xl p-10 shadow-[0px_4px_4px_rgba(46,94,195,1)]">
            <h2 className="text-3xl md:text-4xl mb-6 text-black font-itim">From Chaos to Clarity:</h2>
            <ul className="list-disc list-outside ml-6 space-y-3 text-xl md:text-2xl text-black font-itim leading-relaxed">
              <li className="pl-2">Auto-detect project structure</li>
              <li className="pl-2">Separate frontend, backend, docs, configs</li>
              <li className="pl-2">Map dependencies & risks</li>
              <li className="pl-2">Give you a clean mental model of your codebase</li>
            </ul>
          </div>
         <div className="w-full lg:w-1/2 flex justify-center items-center">
            <Image src={panda} alt="RepoSort mascot" width={450} height={700} className="object-contain drop-shadow-xl" priority/>
          </div>
        </div>
      </div>
    </section>
  );
}
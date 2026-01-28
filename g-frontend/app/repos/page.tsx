"use client";
import Link from "next/link";
import Navbar from "@/components/AuthNavbar";
const repos=[
  {id:"1",name:"One"},
  {id:"2",name:"Two"},
  {id:"3",name:"Three"},
];
export default function ReposPage(){
  return (
    <main className="min-h-screen bg-[#B3BAC9]">
      <Navbar/>
      <div className="w-[90%] max-w-[1400px] mx-auto pt-16">
        <div className="flex items-center justify-between mb-10">
          <div className="relative inline-block">
            <h1 className="text-4xl font-itim text-black">Your Repositories</h1>
            <span className="absolute left-0 -bottom-2 h-[3px] w-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 opacity-80" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repos.map((repo)=>(
            <div key={repo.id} className="bg-[#E6E6E6] rounded-xl shadow-[0px_4px_4px_rgba(46,94,195,1)] p-8 flex items-center justify-between">
              <span className="text-3xl font-itim text-black">{repo.name}</span>
              <Link href={`/repos/${repo.id}`} className="text-2xl font-itim text-black relative group">
                <span className="after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-black after:transition-all after:duration-300 group-hover:after:w-full">get sorting</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
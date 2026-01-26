import Image from "next/image";
import Link from "next/link"; 
import github from "@/assets/github.svg";

export default function Navbar() {
  return (
    <nav className="w-full h-20 bg-neutral-950 flex items-center justify-between px-10">
      <h1 className="text-white text-5xl font-bold tracking-wide font-epilogue">RepoSort</h1>
      <Link href="/repos"> {/* change it to <Link href="/api/auth/github"> later and add redirect to repos in backend */}
        <button className="flex items-center gap-3 bg-red-500 border-2 border-red-500 rounded-xl px-5 py-2.5 hover:bg-transparent hover:border-red-500 transition-all duration-200 group">
          <span className="text-white text-lg font-bold tracking-tight font-pixelify mt-0.5">Get Started with</span>
          <div className="relative w-[70px] h-[30px]">
             <Image src={github} alt="GitHub" fill className="object-contain" priority/>
          </div>
        </button>
      </Link>
    </nav>
  );
}
import Image from "next/image";
import Link from "next/link";
import github from "@/assets/github.svg";

interface NavbarProps {
  showGetStarted?: boolean;
}

export default function Navbar({ showGetStarted = true }: NavbarProps) {
  return (
    <nav className="w-full h-20 bg-neutral-950 flex items-center justify-between px-10 border-b border-white/10">
      <div className="flex items-center gap-4">
        <Link href="/">
          <h1 className="text-white text-4xl font-bold tracking-tight font-epilogue hover:opacity-80 transition-opacity cursor-pointer">
            RepoSort
          </h1>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {showGetStarted && (
          <Link
            href="/enter-repo"
            className="flex items-center gap-3 bg-red-500 border-2 border-black rounded-xl px-5 py-2.5 hover:translate-x-0.5 hover:translate-y-0.5 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all duration-200 group"
          >
            <span className="text-white text-lg font-bold tracking-tight font-pixelify mt-0.5">
              Get Started with
            </span>
            <div className="relative w-[70px] h-[30px] invert">
              <Image src={github} alt="GitHub" fill className="object-contain" priority />
            </div>
          </Link>
        )}
      </div>
    </nav>
  );
}
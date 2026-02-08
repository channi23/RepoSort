"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from 'next/navigation';
import Link from "next/link";
import Image from "next/image";
import profile from "@/assets/profile.svg";
import { useAuth } from "@/components/AuthProvider"; // IMPORT THIS

export default function AuthNavbar() {
  const { logout } = useAuth(); // GET LOGOUT FROM GLOBAL STATE
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null); 
  const buttonRef = useRef<HTMLButtonElement>(null); 

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        open &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      } 
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <>
      <style jsx global>{`
        #dropdown-menu {
          background-color: #262626 !important;
          background-image: none !important;
          opacity: 1 !important; 
          z-index: 9999 !important;
        }
        .menu-item:hover {
          background-color: #404040 !important;
        }
      `}</style>
      
      <nav className="w-full h-20 flex items-center justify-between px-10 relative z-50 shadow-md" style={{ backgroundColor: '#0a0a0a' }}>
        <h1 className="text-white text-5xl font-bold tracking-wide font-epilogue">
          <Link href="/" className="text-white hover:text-red-500 transition-colors" aria-label="RepoSort home">
            RepoSort
          </Link>
        </h1>

        <div className="flex items-center gap-8">
          {pathname !== '/repos' && (
            <Link 
              href="/repos" 
              className="text-white text-lg font-bold font-epilogue hover:text-red-500 transition-colors tracking-wide animate-in fade-in slide-in-from-right-4 duration-500"
            >
              My Repos
            </Link>
          )}

          <div className="relative">
            <button 
              ref={buttonRef} 
              onClick={() => setOpen((prev) => !prev)} 
              className="w-12 h-12 rounded-full bg-zinc-300 flex items-center justify-center hover:bg-zinc-200 transition ring-2 ring-transparent focus:ring-zinc-500 overflow-hidden"
            >
              <Image src={profile} alt="Profile" className="w-6 h-6 object-contain" priority />
            </button>
            
            {open && (
              <div 
                id="dropdown-menu" 
                ref={menuRef} 
                className="absolute top-full mt-3 w-48 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col origin-top-right animate-in fade-in zoom-in-95 duration-100" 
                style={{ right: 0 }}
              >
                <Link href="/profile" className="menu-item block w-full px-5 py-3 text-sm text-zinc-200 transition-colors" onClick={() => setOpen(false)}>
                  Profile
                </Link>
                <Link href="/repos" className="menu-item block w-full px-5 py-3 text-sm text-zinc-200 transition-colors" onClick={() => setOpen(false)}>
                  Repos
                </Link>
                <button 
                  className="menu-item w-full text-left px-5 py-3 text-sm font-semibold transition-colors text-red-400 hover:text-red-300 border-t border-zinc-700"
                  onClick={() => {
                    setOpen(false);
                    logout(); // THIS IS THE FIX: Calling the global logout
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
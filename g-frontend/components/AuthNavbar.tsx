"use client";
import {useState,useEffect,useRef} from "react";
import {useRouter} from 'next/navigation';
import Link from "next/link";
import Image from "next/image";
import profile from "@/assets/profile.svg";
export default function AuthNavbar(){
  const [open,setOpen]=useState(false);
  const router=useRouter();
  const menuRef=useRef<HTMLDivElement>(null); //given by code rabbit
  const buttonRef=useRef<HTMLButtonElement>(null); //given by code rabbit
  useEffect(()=>{
    function handleClickOutside(event:MouseEvent){
      if(open && menuRef.current && !menuRef.current.contains(event.target as Node) && buttonRef.current && !buttonRef.current.contains(event.target as Node)){
        setOpen(false);
      } //code rabbit
    }
    document.addEventListener("mousedown",handleClickOutside);
    return ()=>{
      document.removeEventListener("mousedown",handleClickOutside);
    };
  },[open]);
  return ( //taken from chatgpt
  <><style jsx global>{`
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
      <nav className="w-full h-20 flex items-center justify-between px-10 relative z-50 shadow-md" style={{backgroundColor:'#0a0a0a'}}>
        <h1 className="text-white text-5xl font-bold tracking-wide font-epilogue">RepoSort</h1>
        <div className="relative">
          <button ref={buttonRef} onClick={()=>setOpen((prev)=>!prev)} className="w-12 h-12 rounded-full bg-zinc-300 flex items-center justify-center hover:bg-zinc-200 transition ring-2 ring-transparent focus:ring-zinc-500 overflow-hidden">
            <Image src={profile} alt="Profile" className="w-6 h-6 object-contain" priority />
          </button>
          {open && (
            <div id="dropdown-menu"ref={menuRef} className="absolute top-full mt-3 w-48 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col origin-top-right animate-in fade-in zoom-in-95 duration-100" style={{right:0}}>
              <Link href="/profile" className="menu-item block w-full px-5 py-3 text-sm text-zinc-200 transition-colors" onClick={()=>setOpen(false)}>Profile</Link>
              <Link href="/repos" className="menu-item block w-full px-5 py-3 text-sm text-zinc-200 transition-colors" onClick={()=>setOpen(false)}>Repos</Link>
              <button className="menu-item w-full text-left px-5 py-3 text-sm font-semibold transition-colors" style={{color:'#ef4444'}} onClick={()=>{localStorage.clear(); sessionStorage.clear(); setOpen(false); router.push('/');}}>Logout</button> {/*code rabbit */}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
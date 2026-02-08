import TeamCard from "./TeamCard";

export default function TeamSection() {
  return (
    <section className="relative px-4 md:px-8 py-16 overflow-hidden bg-[#B3BAC9]">
      <div className="relative z-10 bg-[#E6E6E6] rounded-3xl shadow-[0px_8px_16px_rgba(46,94,195,0.2)] p-6 md:p-12 mx-auto max-w-[1432px]">
        
        {/* Header with improved margin */}
        <h2 className="text-4xl md:text-5xl mb-12 font-itim text-black text-center lg:text-left">
          About the team:
        </h2>

        {/* Grid layout for precise spacing */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 justify-items-center">
          <TeamCard 
            name="Hari Haran Sharma" 
            role="Tech Lead & Backend Developer" 
            color="#ef4444" 
            socialsColor="#1d4ed8" 
            quoteColor="#9333ea" 
            quote="Let the buns lead the men" 
            twitterUrl="https://twitter.com/hariharan" 
            instagramUrl="https://instagram.com/hariharan"
          />
          <TeamCard 
            name="Vamshi Thirumal Reddy" 
            role="Design Maestro & Architect" 
            color="#1d4ed8" 
            socialsColor="#fdba74" 
            quoteColor="#1e3a8a" 
            quote="Under Construction." 
            twitterUrl="https://twitter.com/vamshi" 
            instagramUrl="https://instagram.com/vamshi"
          />
          <TeamCard 
            name="Wasif Ahmed" 
            role="Frontend Developer & UI Alchemist" 
            color="#9333ea" 
            socialsColor="#ef4444" 
            quoteColor="#fdba74"  
            quote="But if I've learnt one thing in my life, it is that a particular platitude is a lie. Love doesn't conquer everything." 
            twitterUrl="https://twitter.com/wasif" 
            instagramUrl="https://instagram.com/wasif"
          />
        </div>
      </div>
    </section>
  );
}
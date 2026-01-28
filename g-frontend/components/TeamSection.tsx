import TeamCard from "./TeamCard";
export default function TeamSection(){
  return (
    <section className="relative px-8 py-20 overflow-hidden bg-[#B3BAC9]"> 
      <div className="relative z-10 bg-[#E6E6E6] rounded-2xl shadow-[0px_4px_4px_rgba(46,94,195,1)] p-8 mx-auto max-w-[1432px]">
        <h2 className="text-3xl mb-10 font-itim text-black">About the team:</h2>
        <div className="flex flex-col lg:flex-row gap-10 justify-between items-start">
          <TeamCard name="Hari Haran Sharma" role="Tech Lead & Backend Developer" color="#ef4444" socialsColor="#1d4ed8" quoteColor="#9333ea" quote="Let the buns lead the men" twitterUrl="https://twitter.com/hariharan" instagramUrl="https://instagram.com/hariharan"/>
          <TeamCard name="Vamshi Thirumal Reddy" role="Desige Maestro & Architect" color="#1d4ed8" socialsColor="#fdba74" quoteColor="#1e3a8a" quote="Under Construction." twitterUrl="https://twitter.com/vamshi" instagramUrl="https://instagram.com/vamshi"/>
          <TeamCard name="Wasif Ahmed" role="Frontend Developer & UI Alchemist" color="#9333ea" socialsColor="#ef4444" quoteColor="#fdba74"  quote="But if I've learnt one thing in my life, it is that a particular platitude is a lie. Love doesn't conquer everything. And whoever thinks it does is a fool." twitterUrl="https://twitter.com/wasif" instagramUrl="https://instagram.com/wasif"/>
        </div>
      </div>
    </section>
  );
}
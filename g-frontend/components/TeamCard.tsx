type TeamCardProps = {
  name: string;
  role: string;
  color: string;
  socialsColor: string;
  quoteColor: string;
  quote: string;
  twitterUrl?: string;
  instagramUrl?: string;
};

export default function TeamCard({
  name,
  role,
  color,
  socialsColor,
  quoteColor,
  quote,
  twitterUrl,
  instagramUrl,
}: TeamCardProps) {
  
  const sectionClasses = "w-full h-full flex-shrink-0 snap-start p-8 text-white flex flex-col justify-center transition-colors duration-300";

  return (
    <div 
      className="team-card w-[400px] h-[275px] flex-shrink-0 flex flex-col overflow-y-auto snap-y snap-mandatory scroll-smooth rounded-[12px] shadow-lg hover:shadow-[0px_6px_12px_#F03E3F] transition-shadow duration-300" 
      style={{ 
        scrollbarWidth: 'none', 
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch' // Smoother scrolling on iOS
      }}
    >
      <style>{`.team-card::-webkit-scrollbar { display: none; }`}</style>

      {/* Identity Section */}
      <div style={{ backgroundColor: color }} className={sectionClasses}>
        <h3 className="text-4xl font-itim leading-none tracking-tight">{name}</h3>
        <div className="w-12 h-1 bg-white/30 my-4 rounded-full" /> {/* Subtle visual separator */}
        <p className="text-2xl font-itim opacity-90">{role}</p>
      </div>

      {/* Socials Section */}
      <div style={{ backgroundColor: socialsColor }} className={sectionClasses}>
        <h4 className="text-xl uppercase tracking-widest font-itim mb-4 opacity-80">Socials</h4>
        <div className="flex flex-col gap-3 text-3xl font-itim">
          <a href={twitterUrl || "#"} className={`${!twitterUrl && 'pointer-events-none opacity-50'} hover:translate-x-2 transition-transform duration-200`}>
            Twitter
          </a>
          <a href={instagramUrl || "#"} className={`${!instagramUrl && 'pointer-events-none opacity-50'} hover:translate-x-2 transition-transform duration-200`}>
            Instagram
          </a>
        </div>
      </div>

      {/* Quote Section */}
      <div style={{ backgroundColor: quoteColor }} className={sectionClasses}>
        <h4 className="text-xl uppercase tracking-widest font-itim mb-4 opacity-80">Quote</h4>
        <p className="text-2xl font-itim leading-relaxed italic">
          &ldquo;{quote}&rdquo;
        </p>
      </div>
    </div>
  );
}
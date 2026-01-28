type TeamCardProps = {name:string;role:string;color:string;socialsColor:string;quoteColor:string;quote:string;twitterUrl?:string;instagramUrl?:string;};
export default function TeamCard({name,role,color,socialsColor,quoteColor,quote,twitterUrl,instagramUrl,}:TeamCardProps){
  return (
    <div className="team-card w-[400px] h-[275px] flex-shrink-0 flex flex-col overflow-y-auto snap-y snap-mandatory scroll-smooth rounded-[8px] shadow-[0px_4px_4px_#F03E3F]" style={{scrollbarWidth:'none',msOverflowStyle:'none'}}>
      <style>{`.team-card::-webkit-scrollbar { display: none; }`}</style>
      <div style={{backgroundColor:color}} className="w-full h-full flex-shrink-0 snap-start p-6 text-white flex flex-col justify-center">
        <h3 className="text-3xl font-itim leading-tight">{name}</h3>
        <p className="text-3xl mt-4 font-itim leading-tight">{role}</p>
      </div>
      <div style={{backgroundColor:socialsColor}} className="w-full h-full flex-shrink-0 snap-start p-6 text-white flex flex-col justify-center">
        <h4 className="text-3xl font-itim mb-2"> Socials:</h4>
        <div className="text-3xl font-itim leading-snug">
          {twitterUrl ? (
            <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">Twitter</a>
          ) : (
            <span>Twitter</span>
          )}
          <br />
          {instagramUrl ? (
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">Instagram</a>
          ) : (
            <span>Instagram</span>
          )}
        </div>
      </div>
      <div style={{backgroundColor:quoteColor}} className="w-full h-full flex-shrink-0 snap-start p-6 text-white flex flex-col justify-center">
        <h4 className="text-3xl font-itim mb-2">Quote : </h4>
        <p className="text-3xl font-itim leading-tight">{quote}</p>
      </div>
    </div>
  );
}
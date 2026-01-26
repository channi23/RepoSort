type FeatureCardProps = {
  title:string; description:string; color:string;
};
export default function FeatureCard({
  title,description,color,}:FeatureCardProps) {
  return (
    <div style={{ backgroundColor: color }} className="rounded-xl shadow-[0px_4px_4px_rgba(0,0,0,0.25)] text-white h-[300px] w-[350px] flex-shrink-0 flex flex-col">
      <div className="px-6 pt-6 pb-4">
        <h3 className="text-3xl font-itim">{title}</h3>
      </div>
      <div className="mx-8 h-px bg-white opacity-80" />
      <div className="px-8 pt-8"><p className="text-2xl leading-relaxed font-itim">{description}</p>
      </div>
    </div>
  );
}
import FeatureCard from "./FeatureCard";
export default function FeaturesSection() {
  return (
    <section className="relative px-8 py-20 overflow-hidden bg-[#B3BAC9]"> 
      <div className="relative z-10">
        <h2 className="text-center text-6xl mb-12 text-black font-italiana">Built for students, researchers, and production engineers.</h2>
        <div className="bg-[#E6E6E6] rounded-2xl shadow-[0px_4px_12px_rgba(0,0,0,0.25)] p-10">
          <div className="flex gap-10 overflow-x-auto scroll-smooth no-scrollbar">
            <FeatureCard title="Visualize Your Code" description="See your entire repository as an interactive system graph." color="#a855f7"/>
            <FeatureCard title="Find Hidden Risks" description="Automatically detect architectural and security issues." color="#ef4444"/>
            <FeatureCard title="Plan Fixes Safely" description="Turn intent into clear, approval-ready repair plans." color="#166534"/>
            <FeatureCard title="Apply & Verify" description="Fix code in a sandbox and re-check for risks." color="#92400e"/>
            <FeatureCard title="Explain the Changes" description="View diffs, graphs, and clear impact summaries." color="#1e3a8a"/>
          </div>
        </div>
      </div>
    </section>
  );
}
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import TeamSection from "@/components/TeamSection";
import Footer from "@/components/Footer";
export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar/>
      <HeroSection/>
      <FeaturesSection/>
      <TeamSection/>
      <Footer/>
    </main>
  );
}
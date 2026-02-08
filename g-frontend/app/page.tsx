"use client";
import Navbar from "@/components/Navbar";
import AuthNavbar from "@/components/AuthNavbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import TeamSection from "@/components/TeamSection";
import Footer from "@/components/Footer";
import { useAuth } from "@/components/AuthProvider"; // Import global hook

export default function Home() {
  const { isLoggedIn, login } = useAuth(); // Connect to global state

  return (
    <main className="min-h-screen">
      {/* If global state says logged in, show AuthNavbar, else show standard Navbar */}
      {isLoggedIn ? (
        <AuthNavbar />
      ) : (
        <Navbar onSignIn={login} />
      )}
      
      <HeroSection />
      <FeaturesSection />
      <TeamSection />
      <Footer />
    </main>
  );
}
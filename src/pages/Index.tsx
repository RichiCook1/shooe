import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import BrandBar from "@/components/landing/BrandBar";
import StatsSection from "@/components/landing/StatsSection";
import FeaturedReviews from "@/components/landing/FeaturedReviews";
import Footer from "@/components/landing/Footer";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/feed" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <BrandBar />
        <StatsSection />
        <FeaturedReviews />
      </main>
      <Footer />
    </div>
  );
};

export default Index;

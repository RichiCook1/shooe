import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import BrandBar from "@/components/landing/BrandBar";
import StatsSection from "@/components/landing/StatsSection";
import FeaturedReviews from "@/components/landing/FeaturedReviews";
import Footer from "@/components/landing/Footer";

const Index = () => {
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

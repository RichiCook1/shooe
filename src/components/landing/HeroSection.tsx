import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center">
      <div className="container relative z-10 mx-auto px-4 py-20">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-6 animate-fade-in">
            Running shoe reviews
          </p>

          <h1 className="text-6xl md:text-8xl font-display uppercase tracking-wide leading-[0.9] mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Find Your
            <br />
            Perfect
            <br />
            Shoe
          </h1>

          <p className="text-base text-muted-foreground max-w-md mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            Real reviews from real runners. No fluff, no sponsored content — just honest miles logged.
          </p>

          <div className="flex items-center gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Link to="/review">
              <Button size="lg" className="h-12 px-8 text-sm uppercase tracking-wider font-medium">
                Write a Review
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="h-12 px-8 text-sm uppercase tracking-wider font-medium">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

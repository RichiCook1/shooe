import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { PenSquare } from "lucide-react";

const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold font-display text-gradient">RunReview</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link to="/review">
            <Button size="sm" className="bg-gradient-hero text-primary-foreground hover:opacity-90 gap-1.5">
              <PenSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Leave a Review</span>
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Log In
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

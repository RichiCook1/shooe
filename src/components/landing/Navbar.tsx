import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { PenSquare, LogOut, User, Rss } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to={user ? "/feed" : "/"} className="flex items-center gap-2">
          <span className="text-xl font-bold font-display text-gradient">RunReview</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link to="/review">
            <Button size="sm" className="bg-gradient-hero text-primary-foreground hover:opacity-90 gap-1.5">
              <PenSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Leave a Review</span>
            </Button>
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:ring-2 hover:ring-primary/30 transition-all">
                  <User className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/feed")} className="gap-2 cursor-pointer">
                  <Rss className="w-4 h-4" /> Feed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2 cursor-pointer">
                  <User className="w-4 h-4" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive">
                  <LogOut className="w-4 h-4" /> Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button variant="ghost" size="sm">Log In</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;

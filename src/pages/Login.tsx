import Navbar from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Login = () => {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Auto-redirect when auth state changes
  useEffect(() => {
    if (user) {
      const guestSessionId = localStorage.getItem("guest_session_id");
      if (guestSessionId) {
        supabase.rpc("claim_guest_reviews", { p_user_id: user.id, p_session_id: guestSessionId })
          .then(() => localStorage.removeItem("guest_session_id"));
      }
      navigate("/feed", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-16 max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl font-display uppercase tracking-wider mb-2">
            {isSignUp ? "Join Sherpa" : "Welcome Back"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? "Create your account" : "Sign in to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          {isSignUp && (
            <div>
              <label className="text-sm font-medium mb-2 block">Username</label>
              <Input placeholder="runnerJane" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-2 block">Email</label>
            <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Password</label>
            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          <Button type="submit" disabled={loading} className="w-full h-11 uppercase tracking-wider text-sm font-medium">
            {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Log In"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline font-medium">
              {isSignUp ? "Log In" : "Sign Up"}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
};

export default Login;

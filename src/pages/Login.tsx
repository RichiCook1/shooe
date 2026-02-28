import Navbar from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link } from "react-router-dom";

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-16 max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold font-display mb-2">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-muted-foreground">
            {isSignUp ? "Join the RunReview community" : "Log in to your account"}
          </p>
        </div>

        <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          {isSignUp && (
            <div>
              <label className="text-sm font-medium mb-2 block">Username</label>
              <Input placeholder="runnerJane" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-2 block">Email</label>
            <Input type="email" placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Password</label>
            <Input type="password" placeholder="••••••••" />
          </div>

          <Button className="w-full bg-gradient-hero text-primary-foreground hover:opacity-90 h-11">
            {isSignUp ? "Sign Up" : "Log In"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline font-medium">
              {isSignUp ? "Log In" : "Sign Up"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;

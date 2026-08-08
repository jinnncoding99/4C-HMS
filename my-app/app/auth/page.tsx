"use client";

import { login, signUp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Lock, Building2 } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const { setUsername } = useUser();
  const supabase = createClient();

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    if (isLogin) {
      const result = await login(formData);
      
      if (result !== "success") {
        alert(result);
        setIsLoading(false);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single();

          if (profile?.username) {
            setUsername(profile.username);
          }
        }

        router.refresh();
        router.push("/dashboard");
      }
    } else {
      const usernameInput = formData.get("username") as string;
      const result = await signUp(formData);
      
      if (result !== "success") {
        alert(result);
        setIsLoading(false);
      } else {
        if (usernameInput) setUsername(usernameInput);
        setIsPending(true);
      }
    }
  };

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-zinc-950 px-4 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
        <Card className="w-full max-w-md p-8 text-center border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl z-10">
          <div className="mx-auto w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 text-orange-500">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-white text-xl mb-2">Check your email</CardTitle>
          <p className="text-sm text-zinc-400">
            A verification link has been sent to your email. Please click it to activate your account.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-zinc-950 px-4 relative overflow-hidden">
      {/* Background ambient glow effect */}
      <div className="absolute w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* App Logo & Branding Header */}
      <div className="mb-6 text-center z-10 flex flex-col items-center">
        <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-500 mb-3 shadow-lg shadow-orange-950">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Brd 4C Management System</h1>
        <p className="text-sm text-zinc-400 mt-1">Please sign in to continue</p>
      </div>

      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl z-10">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl text-white font-semibold">
            {isLogin ? "Welcome back" : "Create an account"}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {isLogin ? "Enter your credentials to access your dashboard" : "Fill in the details below to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-zinc-300">Email</Label>
              <Input name="email" type="email" placeholder="name@example.com" required className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-orange-500" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-zinc-300">Password</Label>
              <Input name="password" type="password" placeholder="••••••••" required className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-orange-500" />
            </div>
            
            {!isLogin && (
              <div className="space-y-2">
                <Label className="text-xs text-zinc-300">Username</Label>
                <Input name="username" placeholder="johndoe" required className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-orange-500" />
              </div>
            )}

            {!isLogin && (
              <div className="space-y-2 pt-1">
                <Label className="text-xs text-zinc-300">Select Role</Label>
                <RadioGroup name="role" defaultValue="boarder" className="flex gap-6 pt-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="admin" id="admin" className="border-zinc-700 text-orange-500" />
                    <Label htmlFor="admin" className="text-sm text-zinc-300 cursor-pointer">Admin</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="boarder" id="boarder" className="border-zinc-700 text-orange-500" />
                    <Label htmlFor="boarder" className="text-sm text-zinc-300 cursor-pointer">Boarder</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium mt-2 transition-all">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : (
                isLogin ? "Sign In" : "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button 
              variant="ghost" 
              className="text-xs text-zinc-400 hover:text-white hover:bg-transparent p-0 h-auto" 
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
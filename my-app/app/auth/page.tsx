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
import { Loader2, Lock, Building2, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const { setUsername } = useUser();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

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
      <div className="flex justify-center items-center min-h-screen bg-slate-100 dark:bg-zinc-950 px-4 relative overflow-hidden transition-colors">
        <div className="absolute w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
        <Card className="w-full max-w-md p-8 text-center border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 backdrop-blur-xl shadow-xl z-10">
          <div className="mx-auto w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 text-orange-600 dark:text-orange-500">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-slate-900 dark:text-white text-xl mb-2">Check your email</CardTitle>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            A verification link has been sent to your email. Please click it to activate your account.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-slate-100 dark:bg-zinc-950 px-4 relative overflow-hidden transition-colors">
      {/* Theme Toggle Button in Top Corner */}
      <div className="absolute top-6 right-6 z-20">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 shadow-sm hover:bg-slate-50"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      {/* Background ambient glow effect */}
      <div className="absolute w-[500px] h-[500px] bg-orange-500/10 dark:bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* App Logo & Branding Header */}
      <div className="mb-6 text-center z-10 flex flex-col items-center">
        <div className="w-12 h-12 rounded-xl bg-orange-600/10 dark:bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-500 mb-3 shadow-md">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Brd 4C Management System</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Please sign in to continue</p>
      </div>

      <Card className="w-full max-w-md border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 backdrop-blur-xl shadow-xl z-10">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl text-slate-900 dark:text-white font-semibold">
            {isLogin ? "Welcome back" : "Create an account"}
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-zinc-400">
            {isLogin ? "Enter your credentials to access your dashboard" : "Fill in the details below to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Email</Label>
              <Input name="email" type="email" placeholder="name@example.com" required className="bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus-visible:ring-orange-500" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Password</Label>
              <Input name="password" type="password" placeholder="••••••••" required className="bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus-visible:ring-orange-500" />
            </div>
            
            {!isLogin && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Username</Label>
                <Input name="username" placeholder="johndoe" required className="bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus-visible:ring-orange-500" />
              </div>
            )}

            {!isLogin && (
              <div className="space-y-2 pt-1">
                <Label className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Select Role</Label>
                <RadioGroup name="role" defaultValue="boarder" className="flex gap-6 pt-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="admin" id="admin" className="border-slate-300 dark:border-zinc-700 text-orange-600 dark:text-orange-500" />
                    <Label htmlFor="admin" className="text-sm text-slate-700 dark:text-zinc-300 cursor-pointer">Admin</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="boarder" id="boarder" className="border-slate-300 dark:border-zinc-700 text-orange-600 dark:text-orange-500" />
                    <Label htmlFor="boarder" className="text-sm text-slate-700 dark:text-zinc-300 cursor-pointer">Boarder</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium mt-2 transition-all shadow-md shadow-orange-600/20">
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
              className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-transparent p-0 h-auto" 
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
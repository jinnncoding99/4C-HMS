'use client';

import { login, signUp, forgotPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Lock, Building2, Sun, Moon, ArrowLeft } from "lucide-react";
import { useTheme } from "next-themes";

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const router = useRouter();
  const { setUsername } = useUser();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setForgotSuccess(false);

    if (authMode === "login") {
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
    } else if (authMode === "signup") {
      const usernameInput = formData.get("username") as string;
      const result = await signUp(formData);
      
      if (result !== "success") {
        alert(result);
        setIsLoading(false);
      } else {
        if (usernameInput) setUsername(usernameInput);
        setIsPending(true);
      }
    } else if (authMode === "forgot") {
      const result = await forgotPassword(formData);
      
      if (result !== "success") {
        alert(result);
      } else {
        setForgotSuccess(true);
      }
      setIsLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#F0F2F5] dark:bg-zinc-950 px-4 relative overflow-hidden transition-colors">
        <div className="absolute w-[500px] h-[500px] bg-[#7DA0FA]/10 dark:bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
        <Card className="w-full max-w-md p-8 text-center border-[#98BDFF] dark:border-zinc-800 bg-white dark:bg-zinc-900/50 backdrop-blur-xl shadow-xl z-10">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#4B49AC]/10 dark:bg-orange-500/10 flex items-center justify-center mb-4 text-[#4B49AC] dark:text-orange-500">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-slate-900 dark:text-white text-xl mb-2">Check your email</CardTitle>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            A verification link has been sent to your email. Please click it to activate your account.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-[#F0F2F5] dark:bg-zinc-950 px-4 relative overflow-hidden transition-colors">
      {/* Theme Toggle Button in Top Corner */}
      <div className="absolute top-6 right-6 z-20">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full border-[#98BDFF] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#4B49AC] dark:text-zinc-200 shadow-sm hover:bg-[#F0F2F5]"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      {/* Background ambient glow effect */}
      <div className="absolute w-[500px] h-[500px] bg-[#7DA0FA]/15 dark:bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* App Logo & Branding Header */}
      <div className="mb-6 text-center z-10 flex flex-col items-center">
        <div className="w-12 h-12 rounded-xl bg-[#4B49AC]/10 dark:bg-orange-600/20 border border-[#98BDFF] dark:border-orange-500/30 flex items-center justify-center text-[#4B49AC] dark:text-orange-500 mb-3 shadow-md">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Brd 4C Management System</h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">Please sign in to continue</p>
      </div>

      <Card className="w-full max-w-md border-[#98BDFF] dark:border-zinc-800 bg-white dark:bg-zinc-900/50 backdrop-blur-xl shadow-xl z-10">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl text-slate-900 dark:text-white font-semibold">
            {authMode === "login" && "Welcome back"}
            {authMode === "signup" && "Create an account"}
            {authMode === "forgot" && "Reset your password"}
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-zinc-400">
            {authMode === "login" && "Enter your credentials to access your dashboard"}
            {authMode === "signup" && "Fill in the details below to get started"}
            {authMode === "forgot" && "Enter your email and we'll send you a recovery link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Email</Label>
              <Input 
                name="email" 
                type="email" 
                placeholder="name@example.com" 
                required 
                className="bg-[#F0F2F5]/50 dark:bg-zinc-950 border-[#98BDFF]/60 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B49AC] dark:focus-visible:ring-orange-500" 
              />
            </div>

            {authMode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Password</Label>
                  {authMode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("forgot");
                        setForgotSuccess(false);
                      }}
                      className="text-xs text-[#4B49AC] dark:text-orange-500 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input 
                  name="password" 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  className="bg-[#F0F2F5]/50 dark:bg-zinc-950 border-[#98BDFF]/60 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B49AC] dark:focus-visible:ring-orange-500" 
                />
              </div>
            )}
            
            {authMode === "signup" && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Username</Label>
                <Input 
                  name="username" 
                  placeholder="johndoe" 
                  required 
                  className="bg-[#F0F2F5]/50 dark:bg-zinc-950 border-[#98BDFF]/60 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B49AC] dark:focus-visible:ring-orange-500" 
                />
              </div>
            )}

            {authMode === "signup" && (
              <div className="space-y-2 pt-1">
                <Label className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Select Role</Label>
                <RadioGroup name="role" defaultValue="boarder" className="flex gap-6 pt-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="admin" id="admin" className="border-[#98BDFF] dark:border-zinc-700 text-[#4B49AC] dark:text-orange-500" />
                    <Label htmlFor="admin" className="text-sm text-slate-700 dark:text-zinc-300 cursor-pointer">Admin</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="boarder" id="boarder" className="border-[#98BDFF] dark:border-zinc-700 text-[#4B49AC] dark:text-orange-500" />
                    <Label htmlFor="boarder" className="text-sm text-slate-700 dark:text-zinc-300 cursor-pointer">Boarder</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {forgotSuccess && (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium text-center">
                Password reset link sent! Check your email.
              </p>
            )}

            <Button 
              type="submit" 
              disabled={isLoading} 
              className="w-full bg-[#4B49AC] hover:bg-[#4B49AC]/90 dark:bg-orange-600 dark:hover:bg-orange-600/90 text-white font-medium mt-2 transition-all shadow-md shadow-[#4B49AC]/20 dark:shadow-orange-600/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : (
                <>
                  {authMode === "login" && "Sign In"}
                  {authMode === "signup" && "Create Account"}
                  {authMode === "forgot" && "Send Reset Instructions"}
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            {authMode === "forgot" ? (
              <Button 
                variant="ghost" 
                className="text-xs text-slate-600 dark:text-zinc-400 hover:text-[#4B49AC] dark:hover:text-white hover:bg-transparent p-0 h-auto inline-flex items-center gap-1" 
                onClick={() => {
                  setAuthMode("login");
                  setForgotSuccess(false);
                }}
              >
                <ArrowLeft className="w-3 h-3" /> Back to sign in
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                className="text-xs text-slate-600 dark:text-zinc-400 hover:text-[#4B49AC] dark:hover:text-white hover:bg-transparent p-0 h-auto" 
                onClick={() => {
                  setAuthMode(authMode === "login" ? "signup" : "login");
                  setForgotSuccess(false);
                }}
              >
                {authMode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
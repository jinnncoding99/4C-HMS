'use client';

import { login, signUp, forgotPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Lock, Building2, ArrowLeft, ShieldCheck, Users } from "lucide-react";

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const router = useRouter();
  const { setUsername } = useUser();
  const supabase = createClient();

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

  const getTitle = () => {
    if (authMode === "login") return "Sign in to continue";
    if (authMode === "signup") return "Create an account";
    if (authMode === "forgot") return "Reset your password";
    return "";
  };

  const getSubtitle = () => {
     if (authMode === "login") return "Enter your credentials to access your dashboard";
     if (authMode === "signup") return "Fill in the details below to get started";
     if (authMode === "forgot") return "Enter your email and we'll send you a recovery link";
     return "";
  }

  if (isPending) {
    return (
      <div className="relative flex justify-center items-center min-h-screen bg-slate-50 px-4">
        <Card className="w-full max-w-md p-8 text-center border-slate-200 bg-white shadow-2xl rounded-2xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#4B49AC]/10 flex items-center justify-center mb-4 text-[#4B49AC]">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-slate-900 text-xl mb-2">Check your email</CardTitle>
          <p className="text-sm text-slate-600">
            A verification link has been sent to your email. Please click it to activate your account.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-slate-900 md:bg-slate-50">

      {/* Brand & Visual Panel */}
      <div className="w-full md:w-1/2 lg:w-3/5 relative flex flex-col justify-between p-6 pb-12 md:p-12 bg-slate-900 text-white overflow-hidden" style={{ backgroundImage: "url('/your-background-image.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px]" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white backdrop-blur-md shadow-lg">
            <Building2 className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <span className="font-bold tracking-tight text-base md:text-lg">Brd 4C Management System</span>
        </div>

        <div className="relative z-10 my-6 md:my-auto max-w-lg space-y-2 md:space-y-4">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            Management System Made Simple.
          </h1>
          <p className="hidden md:block text-slate-300 text-base leading-relaxed">
            Streamline boarder administration, track records, and manage daily operations effortlessly in one centralized hub.
          </p>
          <div className="hidden md:pt-2 md:flex flex-wrap items-center gap-6 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#4B49AC]" />
              <span>Secure Role Access</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#4B49AC]" />
              <span>Boarder Portal</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 hidden md:block">
          © {new Date().getFullYear()} Brd 4C Management System. All rights reserved.
        </div>
      </div>

      {/* Authentication Form Container */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 z-10 -mt-6 rounded-t-3xl md:mt-0 md:rounded-none bg-slate-50">
        
        <Card className="w-full max-w-md border-none md:border border-slate-200 bg-transparent md:bg-white shadow-none md:shadow-xl rounded-2xl">
          <CardContent className="pt-4 md:pt-6 px-0 md:px-6">
            
            <div className="mb-4 px-6 md:px-0">
                <h2 className="text-2xl text-slate-900 font-bold tracking-tight">
                    {getTitle()}
                </h2>
                <p className="text-slate-600 mt-1 text-sm">
                    {getSubtitle()}
                </p>
            </div>

            <form action={handleSubmit} className="space-y-3 md:space-y-4 px-6 md:px-0">
              <div className="space-y-1">
                <Label className="text-xs text-slate-700 font-medium">Email</Label>
                <Input 
                  name="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  required 
                  className="bg-white md:bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#4B49AC] h-10 md:h-11" 
                />
              </div>

              {authMode !== "forgot" && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Password</Label>
                  <Input 
                    name="password" 
                    type="password" 
                    placeholder="••••••••" 
                    required 
                    className="bg-white md:bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#4B49AC] h-10 md:h-11" 
                  />
                  {authMode === "login" && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot");
                          setForgotSuccess(false);
                        }}
                        className="text-xs text-[#4B49AC] hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {authMode === "signup" && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-700 font-medium">Username</Label>
                  <Input 
                    name="username" 
                    placeholder="johndoe" 
                    required 
                    className="bg-white md:bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#4B49AC] h-10 md:h-11" 
                  />
                </div>
              )}

              {authMode === "signup" && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs text-slate-700 font-medium">Select Role</Label>
                  <RadioGroup name="role" defaultValue="boarder" className="flex items-center space-x-6 pt-1">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="boarder" id="boarder" />
                      <Label htmlFor="boarder" className="text-xs font-normal text-slate-700 cursor-pointer">
                        Boarder
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="admin" id="admin" />
                      <Label htmlFor="admin" className="text-xs font-normal text-slate-700 cursor-pointer">
                        Admin
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {forgotSuccess && (
                <p className="text-xs text-green-600 font-medium text-center pt-1">
                  Password reset link sent! Check your email.
                </p>
              )}

              <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full bg-[#4B49AC] hover:bg-[#4B49AC]/90 text-white font-medium mt-2 transition-all shadow-md h-10 md:h-11"
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

            <div className="mt-4 text-center px-6 md:px-0 border-t border-slate-100 pt-3 md:border-none md:pt-0 pb-2">
              {authMode === "forgot" ? (
                <Button 
                  variant="ghost" 
                  className="text-xs text-slate-600 hover:text-[#4B49AC] hover:bg-transparent p-0 h-auto inline-flex items-center gap-1.5 font-medium" 
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
                  className="text-xs text-slate-600 hover:text-[#4B49AC] hover:bg-transparent p-0 h-auto font-medium" 
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

    </div>
  );
}
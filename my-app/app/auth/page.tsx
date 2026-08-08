"use client";

import { login, signUp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const { setUsername } = useUser();
  const supabase = createClient();

  const handleSubmit = async (formData: FormData) => {
    if (isLogin) {
      const result = await login(formData);
      
      if (result !== "success") {
        alert(result);
      } else {
        // Fetch the user profile username dynamically
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
        // Route everything to the unified dynamic dashboard router
        router.push("/dashboard");
      }
    } else {
      const usernameInput = formData.get("username") as string;
      const result = await signUp(formData);
      
      if (result !== "success") {
        alert(result);
      } else {
        if (usernameInput) setUsername(usernameInput);
        setIsPending(true);
      }
    }
  };

  if (isPending) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Card className="w-[350px] p-6 text-center border-border">
          <CardTitle className="text-primary mb-4">Check your email</CardTitle>
          <p className="text-sm text-muted-foreground">
            A verification link has been sent to your email. Please click it to activate your account.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <Card className="w-[350px] border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{isLogin ? "Login" : "Sign Up"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <Input name="email" type="email" placeholder="Email" required className="border-input" />
            <Input name="password" type="password" placeholder="Password" required className="border-input" />
            
            {/* Username only shows during Sign Up */}
            {!isLogin && (
              <Input name="username" placeholder="Username" required className="border-input" />
            )}

            {!isLogin && (
              <RadioGroup name="role" defaultValue="boarder" className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="admin" id="admin" />
                  <Label htmlFor="admin" className="text-foreground">Admin</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="boarder" id="boarder" />
                  <Label htmlFor="boarder" className="text-foreground">Boarder</Label>
                </div>
              </RadioGroup>
            )}

            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {isLogin ? "Login" : "Sign Up"}
            </Button>
          </form>
          <Button 
            variant="ghost" 
            className="w-full mt-2 text-muted-foreground hover:text-foreground" 
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Need an account? Sign Up" : "Already have an account? Login"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
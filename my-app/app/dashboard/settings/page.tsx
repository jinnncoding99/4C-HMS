'use client';

import { useState } from "react";
import { useUser } from "@/context/UserContext"; 
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { username, setUsername } = useUser();
  const [newName, setNewName] = useState(username);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSave = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No user logged in");

      const { error } = await supabase
        .from('profiles')
        .update({ username: newName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      setUsername(newName.trim());
      router.push('/dashboard');
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update username in database.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto bg-card rounded-2xl shadow-sm border border-border p-6 text-card-foreground">
        <button 
          onClick={() => router.push('/dashboard')} 
          className="mb-6 flex items-center text-muted-foreground hover:text-foreground transition cursor-pointer"
        >
          <ArrowLeft size={20} className="mr-1" /> Back to Dashboard
        </button>
        
        <h2 className="text-2xl font-bold text-foreground mb-6">Edit Profile</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Username</label>
            <input 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              className="w-full border border-input bg-background text-foreground p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
              placeholder="Enter new username"
            />
          </div>

          <button 
            onClick={handleSave} 
            disabled={isSaving || newName === username || !newName.trim()}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
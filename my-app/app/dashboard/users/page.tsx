'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, ShieldAlert } from "lucide-react";

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoadState] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [userToModify, setUserToModify] = useState<{ id: string; role: string; username: string } | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
      fetchUsers();
    };
    init();
  }, [supabase]);

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setUsers(data);
  };

  const executeRoleUpdate = async () => {
    if (!userToModify) return;
    const { id: userId, role: currentRole } = userToModify;
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    
    setLoadState(userId);
    setUserToModify(null);

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    
    if (error) {
      console.error("Error updating role:", error.message);
      alert("Failed to update role. Please try again.");
    } else {
      fetchUsers();
      router.refresh();

      if (userId === currentUserId) {
        router.push('/dashboard');
      }
    }
    setLoadState(null);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-6 bg-background min-h-screen text-foreground">
      <Button 
        variant="ghost" 
        className="mb-4 text-muted-foreground hover:text-primary flex items-center gap-2 pl-0 cursor-pointer"
        onClick={() => router.push('/dashboard')}
      >
        <ArrowLeft size={18} /> Back to Dashboard
      </Button>

      <h2 className="text-2xl font-bold mb-6 border-b border-primary pb-2">User Management</h2>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-muted-foreground" size={18} />
          <input 
            type="text"
            placeholder="Search users by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-input rounded-xl pl-10 pr-4 py-2.5 text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "admin", "user"] as const).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition cursor-pointer ${
                roleFilter === role 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-card text-muted-foreground border border-border hover:border-primary"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <p className="text-muted-foreground text-center py-10">No users found matching your filters.</p>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} className="p-4 bg-card border border-border flex justify-between items-center rounded-lg">
              <div>
                <p className="font-bold text-foreground flex items-center gap-2">
                  {user.username} 
                  {user.id === currentUserId && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">(You)</span>}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Role: <span className="text-primary font-semibold uppercase">{user.role}</span>
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all font-bold cursor-pointer"
                  disabled={loading === user.id}
                  onClick={() => setUserToModify({ id: user.id, role: user.role, username: user.username })}
                >
                  {loading === user.id 
                    ? "Updating..." 
                    : user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {userToModify && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-card p-6 rounded-2xl border border-primary w-full max-w-sm text-center text-card-foreground shadow-2xl">
            <ShieldAlert className="mx-auto text-primary mb-3" size={40} />
            <h3 className="text-lg font-bold text-foreground mb-2">Confirm Role Change</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to change <strong>{userToModify.username}'s</strong> role to <span className="text-primary uppercase font-bold">{userToModify.role === 'admin' ? 'user' : 'admin'}</span>?
            </p>
            <div className="flex gap-3">
              <Button onClick={executeRoleUpdate} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold cursor-pointer">
                Confirm
              </Button>
              <Button variant="ghost" onClick={() => setUserToModify(null)} className="flex-1 text-muted-foreground hover:text-foreground cursor-pointer">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
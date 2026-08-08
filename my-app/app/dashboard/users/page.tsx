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
    <div className="p-6 bg-[#111111] min-h-screen text-white">
      <Button 
        variant="ghost" 
        className="mb-4 text-gray-400 hover:text-[#ff8c00] flex items-center gap-2 pl-0 cursor-pointer"
        onClick={() => router.push('/dashboard')}
      >
        <ArrowLeft size={18} /> Back to Dashboard
      </Button>

      <h2 className="text-2xl font-bold mb-6 border-b border-[#ff8c00] pb-2">User Management</h2>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-gray-500" size={18} />
          <input 
            type="text"
            placeholder="Search users by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-[#ff8c00]"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "admin", "user"] as const).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition cursor-pointer ${
                roleFilter === role 
                  ? "bg-[#ff8c00] text-black" 
                  : "bg-[#1a1a1a] text-gray-400 border border-[#333] hover:border-[#ff8c00]"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No users found matching your filters.</p>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} className="p-4 bg-[#1a1a1a] border border-[#ff8c00] flex justify-between items-center rounded-lg">
              <div>
                <p className="font-bold text-white flex items-center gap-2">
                  {user.username} 
                  {user.id === currentUserId && <span className="text-xs bg-[#ff8c00]/10 text-[#ff8c00] px-2 py-0.5 rounded-full">(You)</span>}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Role: <span className="text-[#ff8c00] font-semibold uppercase">{user.role}</span>
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-[#ff8c00] text-[#ff8c00] hover:bg-[#ff8c00] hover:text-black transition-all font-bold cursor-pointer"
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-sm text-center">
            <ShieldAlert className="mx-auto text-[#ff8c00] mb-3" size={40} />
            <h3 className="text-lg font-bold text-white mb-2">Confirm Role Change</h3>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to change <strong>{userToModify.username}'s</strong> role to <span className="text-[#ff8c00] uppercase font-bold">{userToModify.role === 'admin' ? 'user' : 'admin'}</span>?
            </p>
            <div className="flex gap-3">
              <Button onClick={executeRoleUpdate} className="flex-1 bg-[#ff8c00] hover:bg-[#e67e00] text-black font-bold cursor-pointer">
                Confirm
              </Button>
              <Button variant="ghost" onClick={() => setUserToModify(null)} className="flex-1 text-gray-400 hover:text-white cursor-pointer">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
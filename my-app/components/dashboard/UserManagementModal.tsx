// components/dashboard/UserManagementModal.tsx
'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Search, ShieldAlert, LayoutGrid, List, Trash2, Shield, User as UserIcon, Users } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserManagementModal({ isOpen = false, onClose }: UserManagementModalProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoadState] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [userToModify, setUserToModify] = useState<{ id: string; role: string; username: string } | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ id: string; username: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) return;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
      fetchUsers();
    };
    init();
  }, [isOpen, supabase]);

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setUsers(data);
  };

  const executeRoleUpdate = async () => {
    if (!userToModify) return;
    const { id: userId, role: currentRole } = userToModify;
    const normalizedCurrent = currentRole?.toLowerCase();
    const newRole = (normalizedCurrent === 'admin') ? 'user' : 'admin';
    
    setLoadState(userId);
    setUserToModify(null);

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    
    if (error) {
      console.error("Error updating role:", error.message);
      toast.error("Failed to update role. Please try again.");
    } else {
      toast.success(`User role updated successfully!`);
      fetchUsers();
    }
    setLoadState(null);
  };

  const executeUserDelete = async () => {
    if (!userToDelete) return;
    const { id: userId, username } = userToDelete;

    setLoadState(userId);
    setUserToDelete(null);

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (error) {
      console.error("Error deleting user:", error.message);
      toast.error("Failed to delete user: " + error.message);
    } else {
      toast.success(`User ${username} successfully deleted.`);
      fetchUsers();
    }
    setLoadState(null);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const userRole = user.role?.toLowerCase() || '';
    
    let matchesRole = true;
    if (roleFilter === 'admin') {
      matchesRole = userRole === 'admin';
    } else if (roleFilter === 'boarder') {
      matchesRole = userRole === 'boarder' || userRole === 'user';
    }

    return matchesSearch && matchesRole;
  });

  const totalCount = users.length;
  const adminCount = users.filter(u => u.role?.toLowerCase() === 'admin').length;
  const boarderCount = users.filter(u => u.role?.toLowerCase() === 'user' || u.role?.toLowerCase() === 'boarder').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-[9999] overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-white dark:bg-[#18181b] w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col h-[90vh] max-h-[850px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">User Management</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Manage permissions, roles, and profiles across your space.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body Scrollable Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Summary Statistics Cards - Responsive 3-Column Layout */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 shrink-0">
            <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-2">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Total</p>
                <h3 className="text-lg sm:text-2xl font-black mt-0.5 text-slate-900 dark:text-white">{totalCount}</h3>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Users size={18} />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-2">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Admins</p>
                <h3 className="text-lg sm:text-2xl font-black mt-0.5 text-amber-600 dark:text-amber-500">{adminCount}</h3>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Shield size={18} />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center sm:justify-between text-center sm:text-left gap-2">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Boarders</p>
                <h3 className="text-lg sm:text-2xl font-black mt-0.5 text-indigo-600 dark:text-indigo-400">{boarderCount}</h3>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <UserIcon size={18} />
              </div>
            </div>
          </div>
          
          {/* Search, Filter Bar, and View Mode Switcher */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Search users by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4B49AC] dark:focus:ring-amber-500 text-sm"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="flex gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
                {(["all", "admin", "boarder"] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                      roleFilter === role 
                        ? "bg-[#4B49AC] dark:bg-amber-500 text-white dark:text-black shadow-xs" 
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg text-xs transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-800 text-[#4B49AC] dark:text-amber-500 shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Grid View"
                >
                  <LayoutGrid size={16} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg text-xs transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-zinc-800 text-[#4B49AC] dark:text-amber-500 shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}
                  title="List View"
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* User Cards / List Display Container with Framer Motion animations */}
          {filteredUsers.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-center py-16 bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800"
            >
              <p className="text-slate-500 dark:text-zinc-400 font-medium text-sm">No users found matching your filters.</p>
            </motion.div>
          ) : (
            <motion.div 
              layout 
              className={
                viewMode === 'grid' 
                  ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" 
                  : "flex flex-col space-y-2 sm:space-y-3"
              }
            >
              <AnimatePresence>
                {filteredUsers.map((user) => {
                  const userRoleLower = user.role?.toLowerCase() || '';
                  const isAdmin = userRoleLower === 'admin';
                  return (
                    <motion.div 
                      key={user.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs hover:shadow-md transition-all ${
                        viewMode === 'grid' 
                          ? 'p-4 rounded-2xl flex flex-col justify-between gap-4 text-center items-center' 
                          : 'p-3 sm:p-4 rounded-2xl flex flex-row items-center justify-between gap-3'
                      }`}
                    >
                      {/* Header/Info: Thumbnail Initials + Username & Role badge */}
                      <div className={`flex ${viewMode === 'grid' ? 'flex-col items-center' : 'flex-row items-center'} gap-3 w-full min-w-0`}>
                        <div className={`${viewMode === 'grid' ? 'w-12 h-12 sm:w-14 sm:h-14 rounded-full text-lg' : 'w-10 h-10 rounded-xl text-sm'} bg-[#4B49AC]/10 dark:bg-amber-500/10 text-[#4B49AC] dark:text-amber-500 flex items-center font-bold justify-center shrink-0`}>
                          {user.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
                        </div>
                        
                        <div className={`min-w-0 flex-1 flex flex-col ${viewMode === 'grid' ? 'items-center' : 'items-start'}`}>
                          <h4 className={`font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5 w-full ${viewMode === 'grid' ? 'justify-center' : 'justify-start'}`}>
                            <span className="truncate">{user.username}</span>
                            {user.id === currentUserId && (
                              <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-md font-medium shrink-0">(You)</span>
                            )}
                          </h4>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                            isAdmin 
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                          }`}>
                            {isAdmin ? <Shield size={10} /> : <UserIcon size={10} />}
                            {isAdmin ? 'Admin' : 'Boarder'}
                          </span>
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className={`flex items-center gap-2 ${
                        viewMode === 'grid' 
                          ? 'w-full pt-4 border-t border-slate-100 dark:border-zinc-800 flex-row justify-center' 
                          : 'shrink-0'
                      }`}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`text-xs border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold cursor-pointer h-8 shadow-none ${viewMode === 'grid' ? 'flex-1 px-0' : 'px-3'}`}
                          disabled={loading === user.id}
                          onClick={() => setUserToModify({ id: user.id, role: user.role, username: user.username })}
                        >
                          {loading === user.id 
                            ? "..." 
                            : isAdmin ? 'Demote' : 'Promote'}
                        </Button>

                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled={loading === user.id}
                          onClick={() => setUserToDelete({ id: user.id, username: user.username })}
                          className="text-xs text-red-500 hover:bg-red-500/10 h-8 w-8 p-0 flex items-center justify-center shrink-0 cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* Confirmation Sub-Modal for Role Change */}
      {userToModify && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-[10000]">
          <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-sm text-center shadow-2xl space-y-4">
            <ShieldAlert className="mx-auto text-[#4B49AC] dark:text-amber-500" size={40} />
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Role Change</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Are you sure you want to change <strong>{userToModify.username}&apos;s</strong> role?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={executeRoleUpdate} className="flex-1 bg-[#4B49AC] dark:bg-amber-500 hover:opacity-90 text-white dark:text-black font-bold cursor-pointer shadow-none text-xs">
                Confirm
              </Button>
              <Button variant="ghost" onClick={() => setUserToModify(null)} className="flex-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer text-xs">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Sub-Modal for User Deletion */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-[10000]">
          <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-red-500/40 w-full max-w-sm text-center shadow-2xl space-y-4">
            <Trash2 className="mx-auto text-red-500" size={40} />
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete User</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Are you sure you want to completely delete <strong>{userToDelete.username}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={executeUserDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer shadow-none text-xs">
                Delete
              </Button>
              <Button variant="ghost" onClick={() => setUserToDelete(null)} className="flex-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer text-xs">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
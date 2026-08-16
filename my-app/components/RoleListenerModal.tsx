// app/components/RoleListenerModal.tsx
'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RoleListenerModal({ currentUserId }: { currentUserId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!currentUserId) return;

    let initialRole: string | null = null;

    // 1. Fetch the baseline role when the component mounts
    const fetchInitialRole = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUserId)
        .single();
      
      if (data) {
        initialRole = data.role;
      }
    };

    fetchInitialRole();

    // 2. Listen for realtime updates
    const channel = supabase
      .channel(`role-changes-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUserId}`,
        },
        (payload: any) => {
          const updatedRole = payload.new?.role;

          // Only trigger if we have a recorded baseline role, 
          // a new role exists, and they are strictly different!
          if (initialRole && updatedRole && initialRole !== updatedRole) {
            setNewRoleName(updatedRole);
            setShowModal(true);
          }

          // Update baseline so subsequent updates compare correctly
          if (updatedRole) {
            initialRole = updatedRole;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase]);

  const handleRefreshAndApply = () => {
    setShowModal(false);
    router.refresh();
    window.location.reload();
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-card p-6 rounded-2xl border border-primary w-full max-w-md shadow-2xl text-center space-y-4 text-card-foreground">
        <h2 className="text-xl font-bold text-foreground">Role Updated!</h2>
        <p className="text-muted-foreground">
          Your account role has been updated to <span className="text-primary font-semibold uppercase">{newRoleName}</span>. 
          Please click below to reload your dashboard.
        </p>
        <button
          onClick={handleRefreshAndApply}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl transition shadow-lg cursor-pointer"
        >
          Refresh & Apply Changes
        </button>
      </div>
    </div>
  );
}
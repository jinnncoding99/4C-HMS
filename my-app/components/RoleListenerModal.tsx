'use client';

import { useEffect, useState } from "react";
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
      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-md shadow-2xl text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Role Updated!</h2>
        <p className="text-gray-300">
          Your account role has been updated to <span className="text-[#ff8c00] font-semibold uppercase">{newRoleName}</span>. 
          Please click below to reload your dashboard.
        </p>
        <button
          onClick={handleRefreshAndApply}
          className="w-full bg-[#ff8c00] hover:bg-[#e07b00] text-black font-bold py-3 rounded-xl transition shadow-lg cursor-pointer"
        >
          Refresh & Apply Changes
        </button>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Dashboard from "@/components/dashboard/MainDashboard"; 
import UserManagementModal from "../../components/dashboard/UserManagementModal";
import { Loader2 } from "lucide-react";

export default function UsersPage() {
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Check if we are actually on the /dashboard/users sub-route
  const isUsersRoute = pathname === '/dashboard/users';

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role) {
        setRole(profile.role);
      } else {
        setRole('Boarder');
      }
      setLoading(false);
    };

    fetchUserRole();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Background Dashboard */}
      <Dashboard 
        userId={userId ?? undefined} 
        role={role ?? undefined} 
        onOpenUserManagement={() => router.push('/dashboard/users')}
      />

      {/* User Management Modal overlaying the dashboard - only opens when URL is /dashboard/users */}
      <UserManagementModal 
        isOpen={isUsersRoute} 
        onClose={() => {
          router.push('/dashboard');
        }} 
      />
    </div>
  );
}
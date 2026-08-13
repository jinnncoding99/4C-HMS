"use client";

import { useState } from "react";
import { User, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import EditProfileModal from "@/components/EditProfileModal"; // Adjust path if needed

export default function UserMenu({ username, role }: { username: string; role: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLogout = async () => {
    // Add your Supabase or custom logout logic here
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(true)}>
        {role === "admin" ? <Shield className="w-6 h-6" /> : <User className="w-6 h-6" />}
      </Button>

      <EditProfileModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onProfileUpdated={() => {
          // Optional: trigger refresh or router.refresh() if needed
        }}
      />
    </>
  );
}
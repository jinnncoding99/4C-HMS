"use client";

import { useState } from "react";
import { User, Shield, LogOut, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function UserMenu({ username, role }: { username: string, role: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
        {role === "admin" ? <Shield className="w-6 h-6" /> : <User className="w-6 h-6" />}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile: {username}</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-32 h-32 border flex items-center justify-center bg-muted">
              <QrCode className="w-16 h-16" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Replace QR</Button>
              <Button variant="destructive">Delete QR</Button>
            </div>
          </div>

          <Button variant="ghost" className="w-full text-red-500">
            <LogOut className="mr-2 w-4 h-4" /> Logout
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
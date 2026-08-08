'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Bell, Plane, CreditCard, UserPlus } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data } = await supabase.from('notifications').select('*');
    const notifs = data || [];
    setNotifications(notifs);
    
    localStorage.setItem('has_unread_notifications', notifs.length > 0 ? 'true' : 'false');
  };

  const parseVacationMessage = (message: string) => {
    if (!message) return null;
    const dateRegex = /\d{4}-\d{2}-\d{2}/g;
    const dates = message.match(dateRegex);
    if (dates && dates.length >= 2) {
      const start = new Date(dates[0]);
      const end = new Date(dates[1]);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return { start: dates[0], end: dates[1], days: diffDays };
    }
    return null;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'vacation': return <Plane size={18} />;
      case 'payment_approval': return <CreditCard size={18} />;
      default: return <UserPlus size={18} />;
    }
  };

  const handleAction = async (approve: boolean) => {
    if (!selectedNotif) return;

    if (approve) {
      if (selectedNotif.type === 'vacation') {
        const details = parseVacationMessage(selectedNotif.message);
        if (details) {
          await supabase.from('vacation_history').insert({
            user_email: selectedNotif.email,
            start_date: details.start,
            end_date: details.end,
            days_requested: details.days,
            reason: selectedNotif.message
          });
        }
      } 
      else if (selectedNotif.type === 'expense_approval') {
        const splitId = selectedNotif.details?.split_id;
        if (splitId) {
          await supabase
            .from('expense_splits')
            .update({ status: 'approved', approved_at: new Date().toISOString() })
            .eq('id', splitId);
        }
      }
      else if (selectedNotif.type === 'payment_approval') {
        const billId = selectedNotif.details?.bill_id;
        const userId = selectedNotif.details?.user_id;
        const paymentAmount = parseFloat(selectedNotif.details?.amount || 0);

        if (billId && userId && paymentAmount > 0) {
          const { data: senderShare, error: fetchError } = await supabase
            .from('bill_shares')
            .select('*')
            .eq('bill_id', billId)
            .eq('boarder_id', userId)
            .single();

          if (fetchError || !senderShare) {
            console.error("Error fetching sender bill share:", fetchError?.message);
            alert("Could not locate sender's share record.");
            return;
          }

          const currentSharedAmount = parseFloat(senderShare.shared_amount || senderShare.share_due || 0);
          const newSharedAmount = Math.max(0, currentSharedAmount - paymentAmount);

          if (newSharedAmount === 0) {
            await supabase
              .from('bill_shares')
              .update({ shared_amount: 0, is_paid: true })
              .eq('id', senderShare.id);
          } else {
            await supabase
              .from('bill_shares')
              .update({ shared_amount: newSharedAmount })
              .eq('id', senderShare.id);
          }

          const { data: billData } = await supabase
            .from('bills')
            .select('payment_receiver_id')
            .eq('id', billId)
            .single();

          const receiverId = billData?.payment_receiver_id || selectedNotif.details?.receiver_id;

          if (receiverId) {
            const { data: receiverShare } = await supabase
              .from('bill_shares')
              .select('*')
              .eq('bill_id', billId)
              .eq('boarder_id', receiverId)
              .single();

            if (receiverShare) {
              const receiverCurrentAmount = parseFloat(receiverShare.shared_amount || receiverShare.share_due || 0);
              await supabase
                .from('bill_shares')
                .update({ shared_amount: receiverCurrentAmount + paymentAmount })
                .eq('id', receiverShare.id);
            }
          }
        }
      }
    }

    await supabase.from('notifications').delete().eq('id', selectedNotif.id);
    setSelectedNotif(null);
    window.location.reload();
  };

  return (
    <div className="p-6 bg-[#111111] min-h-screen text-white">
      <Button variant="ghost" className="mb-4 text-gray-400 hover:text-[#ff8c00] pl-0 cursor-pointer" onClick={() => router.push('/dashboard')}>
        <ArrowLeft size={18} className="mr-2" /> Back to Dashboard
      </Button>

      <h2 className="text-2xl font-bold mb-6 border-b border-[#ff8c00] pb-2 flex items-center gap-3">
        <Bell className="text-[#ff8c00]" /> Notifications
      </h2>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No pending notifications found.</p>
        ) : (
          notifications.map((notif) => (
            <Card key={notif.id} className="p-4 bg-[#1a1a1a] border border-[#ff8c00] flex justify-between items-center cursor-pointer hover:bg-[#222] transition" onClick={() => setSelectedNotif(notif)}>
              <div className="flex items-center gap-4">
                <div className="text-[#ff8c00]">{getIcon(notif.type)}</div>
                <div className="flex flex-col">
                  <span className="text-[#ff8c00] text-[10px] font-bold uppercase tracking-widest">{notif.type?.replace('_', ' ')}</span>
                  <p className="font-bold text-white">{notif.email || "System Notification"}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {selectedNotif && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Process {selectedNotif.type?.replace('_', ' ')}</h3>
            
            <div className="bg-[#111111] p-3 rounded-lg mb-4 border border-[#333]">
              <p className="text-sm font-bold text-[#ff8c00]">{selectedNotif.email || "System"}</p>
              <p className="text-xs text-gray-400 mt-1">{selectedNotif.message}</p>
              {selectedNotif.details?.receipt_url && (
                <a 
                  href={selectedNotif.details.receipt_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-blue-400 underline block mt-2"
                >
                  View Uploaded Receipt Proof
                </a>
              )}
            </div>

            {selectedNotif.type === 'vacation' && parseVacationMessage(selectedNotif.message) && (
              <div className="bg-[#222] p-3 rounded-lg mb-4 border border-[#444]">
                <p className="text-xs text-gray-300">Duration: <strong>{parseVacationMessage(selectedNotif.message)?.days} days</strong></p>
              </div>
            )}

            <div className="flex gap-4">
              <Button onClick={() => handleAction(true)} className="flex-1 bg-[#ff8c00] hover:bg-[#e67e00] text-black font-bold cursor-pointer">Approve</Button>
              <Button onClick={() => handleAction(false)} variant="destructive" className="flex-1 cursor-pointer">Reject</Button>
            </div>
            <Button variant="ghost" onClick={() => setSelectedNotif(null)} className="w-full mt-2 text-gray-500 cursor-pointer">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
// components/dashboard/DashboardHeader.tsx
'use client';

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  Check, 
  X, 
  Plane, 
  CreditCard 
} from "lucide-react";
import { createClient } from "@/lib/supabase/client"; 

interface DashboardHeaderProps {
  title: string;
  role: string;
  username?: string;
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: (isOpen: boolean) => void;
  onOpenVacationModal?: () => void;
}

interface Notification {
  id: string;
  email: string;
  type: string; 
  message: string;
  status: string;
  details?: {
    start_date?: string;
    end_date?: string;
    reason?: string;
    amount?: string | number;
    user_id?: string;
    receiver_id?: string;
    bill_id?: string;
    expense_id?: string;
    receipt_url?: string | null;
    method?: string;
  };
  created_at: string;
}

export default function DashboardHeader({ 
  title, 
  role, 
  username: initialUsername, 
  isMobileNavOpen, 
  setIsMobileNavOpen, 
  onOpenVacationModal 
}: DashboardHeaderProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [username, setUsername] = useState<string>(initialUsername || "Loading...");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const router = useRouter();
  const notifRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (profileData && profileData.username) {
        setUsername(profileData.username);
      } else if (user.email) {
        setUsername(user.email.split('@')[0]);
      }
    }
  };

  const fetchNotifications = async (activeUserId?: string | null) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data) {
      const filtered = data.filter((notif) => {
        if (notif.type === 'payment_approval' || notif.type === 'expense_payment_approval') {
          return activeUserId && notif.details?.receiver_id === activeUserId;
        }
        if (activeUserId && notif.details?.user_id === activeUserId) {
          return false;
        }
        return true;
      });

      setNotifications(filtered);
      if (filtered.length === 0) {
        setIsNotificationsOpen(false);
      }
    }
  };

  useEffect(() => {
    if (!initialUsername) {
      fetchUserData();
    } else {
      setUsername(initialUsername);
      fetchUserData();
    }
  }, [initialUsername]);

  useEffect(() => {
    const initNotificationsSetup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const activeId = user?.id || null;
      if (activeId) setCurrentUserId(activeId);
      fetchNotifications(activeId);
    };

    initNotificationsSetup();

    const channel = supabase
      .channel('public:notifications-header')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
        const { data: { user } } = await supabase.auth.getUser();
        const activeId = user?.id || currentUserId;
        
        if (payload.new && payload.new.type === 'payment_status_update' && activeId) {
          const { data: profileData } = await supabase.from('profiles').select('email').eq('id', activeId).single();
          if (profileData && profileData.email === payload.new.email) {
            window.alert(payload.new.message);
            window.dispatchEvent(new Event('billing-updated'));
            window.dispatchEvent(new Event('expense-updated'));
            router.refresh();
            window.location.reload();
          }
        }

        window.dispatchEvent(new Event('billing-updated'));
        window.dispatchEvent(new Event('expense-updated'));
        fetchNotifications(activeId);
        router.refresh();
      })
      .subscribe();

    const handleGlobalUpdate = () => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        fetchNotifications(user?.id || currentUserId);
      });
    };

    window.addEventListener('notification-updated', handleGlobalUpdate);

    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener('notification-updated', handleGlobalUpdate);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, router, supabase]);

  const handleApprove = async (notif: Notification) => {
    try {
      if ((notif.type === 'payment_approval' || notif.type === 'expense_payment_approval') && notif.details) {
        const targetBillId = notif.details.expense_id || notif.details.bill_id;
        const payerUserId = notif.details.user_id;
        const receiverId = notif.details.receiver_id;
        const paymentAmount = Number(notif.details.amount || 0);

        if (targetBillId && payerUserId) {
          const isExpenseEntry = notif.type === 'expense_payment_approval';
          const tableName = isExpenseEntry ? 'expense_shares' : 'bill_shares';
          const foreignKeyName = isExpenseEntry ? 'expense_id' : 'bill_id';
          const userKeyName = isExpenseEntry ? 'user_id' : 'boarder_id';

          const { error: shareError } = await supabase
            .from(tableName)
            .update({ 
              is_paid: true, 
              status: 'paid',
              paid_amount: paymentAmount,
              shared_amount: 0
            })
            .eq(foreignKeyName, targetBillId)
            .eq(userKeyName, payerUserId);

          if (shareError) throw shareError;

          if (receiverId) {
            const { data: receiverShare } = await supabase
              .from(tableName)
              .select('*')
              .eq(foreignKeyName, targetBillId)
              .eq(userKeyName, receiverId)
              .maybeSingle();

            if (receiverShare) {
              const currentReceiverAmount = Number(receiverShare.shared_amount || 0);
              const updatedReceiverAmount = Math.max(0, currentReceiverAmount - paymentAmount);

              await supabase
                .from(tableName)
                .update({ 
                  shared_amount: updatedReceiverAmount 
                })
                .eq(foreignKeyName, targetBillId)
                .eq(userKeyName, receiverId);
            }
          }
        }
      }

      if (notif.type === 'vacation' && notif.details) {
        await supabase
          .from('vacation_history')
          .update({ status: 'approved' })
          .eq('user_email', notif.email)
          .eq('start_date', notif.details.start_date)
          .eq('end_date', notif.details.end_date);
      }

      const approvalMessage = `Your payment request of ₱${notif.details?.amount || '0'} has been Approved!`;
      await supabase.from('notifications').insert({
        email: notif.email,
        type: 'payment_status_update',
        message: approvalMessage,
        status: 'unread',
        details: notif.details
      });

      await supabase.from('notifications').delete().eq('id', notif.id);

      setNotifications((prev) => prev.filter((item) => item.id !== notif.id));

      window.dispatchEvent(new Event('billing-updated'));
      window.dispatchEvent(new Event('expense-updated'));
      window.dispatchEvent(new Event('notification-updated'));
      
      await fetchNotifications(currentUserId);
      router.refresh();
      window.location.reload();
    } catch (err: any) {
      console.error("Error approving request:", err.message || err);
    }
  };

  const handleReject = async (notif: Notification) => {
    try {
      if ((notif.type === 'payment_approval' || notif.type === 'expense_payment_approval') && notif.details) {
        const targetId = notif.details.expense_id || notif.details.bill_id;
        const payerUserId = notif.details.user_id;
        const isExpenseEntry = notif.type === 'expense_payment_approval';
        const tableName = isExpenseEntry ? 'expense_shares' : 'bill_shares';
        const foreignKeyName = isExpenseEntry ? 'expense_id' : 'bill_id';
        const userKeyName = isExpenseEntry ? 'user_id' : 'boarder_id';

        if (targetId && payerUserId) {
          await supabase
            .from(tableName)
            .update({ 
              status: 'unpaid',
              is_paid: false,
              paid_amount: 0,
              receipt_url: null,
              payment_method: null
            })
            .eq(foreignKeyName, targetId)
            .eq(userKeyName, payerUserId);
        }
      }

      if (notif.type === 'vacation' && notif.details) {
        await supabase
          .from('vacation_history')
          .update({ status: 'rejected' })
          .eq('user_email', notif.email)
          .eq('start_date', notif.details.start_date)
          .eq('end_date', notif.details.end_date);
      }

      const rejectionMessage = `Your payment request of ₱${notif.details?.amount || '0'} was Rejected. Please check and try again.`;
      await supabase.from('notifications').insert({
        email: notif.email,
        type: 'payment_status_update',
        message: rejectionMessage,
        status: 'unread',
        details: notif.details
      });

      await supabase.from('notifications').delete().eq('id', notif.id);

      setNotifications((prev) => prev.filter((item) => item.id !== notif.id));

      window.dispatchEvent(new Event('billing-updated'));
      window.dispatchEvent(new Event('expense-updated'));
      window.dispatchEvent(new Event('notification-updated'));

      await fetchNotifications(currentUserId);
      router.refresh();
      window.location.reload();
    } catch (err: any) {
      console.error("Error rejecting request:", err.message);
    }
  };

  const pendingCount = notifications.length;

  return (
    <header className="flex flex-row justify-between items-center gap-4 px-4 sm:px-6 py-3.5 border-b border-[#98BDFF]/40 dark:border-[#ff8c00]/30 bg-white dark:bg-[#18181b] transition-colors shadow-xs relative z-40">
      
      {/* Title & Role taking full width smoothly */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">{title}</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-[#4B49AC]/15 text-[#4B49AC] dark:bg-[#ff8c00]/15 dark:text-[#ff8c00]">
              {role}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 truncate">
            Welcome back, <span className="font-semibold text-slate-700 dark:text-zinc-200">{username}</span>
          </p>
        </div>
      </div>

      {/* Right action: Only Notification Icon remains on the header */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative" ref={notifRef}>
          <button 
            type="button"
            aria-label="Toggle Notifications"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2.5 rounded-xl text-[#4B49AC] dark:text-[#ff8c00] hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 transition-all cursor-pointer"
          >
            <Bell size={18} />
            {pendingCount > 0 && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4B49AC]/50 dark:bg-[#ff8c00]/50 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4B49AC] dark:bg-[#ff8c00]"></span>
              </span>
            )}
          </button>

          {isNotificationsOpen && pendingCount > 0 && (
            <div className="absolute right-[-20px] sm:right-0 mt-3 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[9999] p-4 text-slate-900 dark:text-white space-y-3 animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-3">
                <h4 className="font-bold text-sm">Pending Approvals</h4>
                <span className="text-xs bg-[#4B49AC]/10 text-[#4B49AC] dark:bg-[#ff8c00]/10 dark:text-[#ff8c00] border border-[#98BDFF]/30 dark:border-[#ff8c00]/30 px-2 py-0.5 rounded-md font-semibold">
                  {pendingCount} New
                </span>
              </div>

              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {notifications.map((notif) => {
                  const isVacation = notif.type === 'vacation';
                  
                  return (
                    <div key={notif.id} className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 p-3 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-[#4B49AC] dark:text-[#ff8c00]">
                        {isVacation ? <Plane size={14} /> : <CreditCard size={14} />}
                        <span className="font-semibold text-slate-900 dark:text-white capitalize truncate">{notif.type.replace('_', ' ')} Request</span>
                        <span className="text-slate-400 dark:text-zinc-500 text-[10px] ml-auto truncate max-w-[120px]">{notif.email}</span>
                      </div>
                      <p className="text-slate-600 dark:text-zinc-300 leading-relaxed">{notif.message}</p>

                      {notif.details?.receipt_url && notif.details.receipt_url !== "not applicable" && (
                        <a 
                          href={notif.details.receipt_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline block"
                        >
                          View Receipt Proof →
                        </a>
                      )}
                      
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                        <button 
                          onClick={() => handleReject(notif)}
                          className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 h-8 sm:h-7 text-xs sm:text-[11px] px-3 rounded-lg flex items-center cursor-pointer font-medium transition"
                        >
                          <X size={12} className="mr-1" /> Reject
                        </button>
                        <button 
                          onClick={() => handleApprove(notif)}
                          className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 h-8 sm:h-7 text-xs sm:text-[11px] px-3 rounded-lg flex items-center cursor-pointer font-medium transition"
                        >
                          <Check size={12} className="mr-1" /> Approve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
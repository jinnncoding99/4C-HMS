// components/dashboard/DashboardHeader.tsx
'use client';

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  Check, 
  X, 
  Plane, 
  CreditCard,
  Info
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
  
  // Ref to track the latest user ID and avoid stale closures in subscriptions
  const userIdRef = useRef<string | null>(null);
  
  const router = useRouter();
  const notifRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    userIdRef.current = currentUserId;
  }, [currentUserId]);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      userIdRef.current = user.id;
      
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
      .in('status', ['pending', 'sent', 'unread'])
      .order('created_at', { ascending: false });

    if (data) {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      const filtered = data.filter((notif) => {
        if (notif.type === 'bill_announcement') {
          return userEmail && notif.email === userEmail;
        }
        if (notif.type === 'payment_status_update') {
          return userEmail && notif.email === userEmail;
        }

        if (notif.type === 'payment_approval' || notif.type === 'expense_approval') {
          return activeUserId && notif.details?.receiver_id === activeUserId;
        }
        if (activeUserId && notif.details?.user_id === activeUserId) {
          return false;
        }
        return true;
      });

      setNotifications(filtered);
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
      if (activeId) {
        setCurrentUserId(activeId);
        userIdRef.current = activeId;
      }
      fetchNotifications(activeId);
    };

    initNotificationsSetup();

    const channel = supabase
      .channel('public:notifications-header')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const activeId = user?.id || userIdRef.current;
        
        window.dispatchEvent(new Event('billing-updated'));
        window.dispatchEvent(new Event('expense-updated'));
        window.dispatchEvent(new Event('vacation-updated'));
        fetchNotifications(activeId);
        router.refresh();
      })
      .subscribe();

    const handleGlobalUpdate = () => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        fetchNotifications(user?.id || userIdRef.current);
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
  }, [router, supabase]);

  const handleDismissOrApprove = async (notif: Notification, action: 'approve' | 'reject' | 'dismiss') => {
    setNotifications((prev) => prev.filter((item) => item.id !== notif.id));

    try {
      if (action === 'dismiss') {
        await supabase.from('notifications').delete().eq('id', notif.id);
        
        window.dispatchEvent(new Event('billing-updated'));
        window.dispatchEvent(new Event('expense-updated'));
        window.dispatchEvent(new Event('vacation-updated'));
        window.dispatchEvent(new Event('notification-updated'));
        router.refresh();
        return;
      }

      const isExpenseEntry = notif.type === 'expense_approval';
      const targetId = isExpenseEntry ? notif.details?.expense_id : notif.details?.bill_id;
      const paymentAmount = Number(notif.details?.amount || 0);
      const payerUserId = notif.details?.user_id;

      const tableName = isExpenseEntry ? 'expense_shares' : 'bill_shares';
      const foreignKeyName = isExpenseEntry ? 'expense_id' : 'bill_id';
      const userKeyName = isExpenseEntry ? 'user_id' : 'boarder_id';

      if (action === 'approve') {
        if ((notif.type === 'payment_approval' || notif.type === 'expense_approval') && notif.details) {
          if (targetId && payerUserId) {
            const { data: memberShare, error: fetchShareError } = await supabase
              .from(tableName)
              .select('*')
              .eq(foreignKeyName, targetId)
              .eq(userKeyName, payerUserId)
              .single();

            if (fetchShareError || !memberShare) {
              throw new Error("Could not find the member's bill share record.");
            }

            const existingPaidAmount = Number(memberShare.paid_amount || 0);
            const totalSharedAmount = Number(memberShare.shared_amount || memberShare.amount || 0);
            
            const newPaidAmount = existingPaidAmount + paymentAmount;
            const isFullyPaid = newPaidAmount >= totalSharedAmount;

            await supabase
              .from(tableName)
              .update({ 
                paid_amount: newPaidAmount,
                status: isFullyPaid ? 'paid' : 'partial',
                is_paid: isFullyPaid
              })
              .eq(foreignKeyName, targetId)
              .eq(userKeyName, payerUserId);
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

        // Fixed payload mapped correctly to match transaction_history columns safely (omitting user_email / status to avoid schema mismatches seen in network tab)
        const { error: transactionError } = await supabase.from('transaction_history').insert({
          original_bill_id: !isExpenseEntry ? targetId : null,
          description: notif.message || `${notif.type} Approved`,
          total_amount: paymentAmount,
          settled_at: new Date().toISOString(),
          url_receipt: notif.details?.receipt_url || null,
          payment_receiver_id: notif.details?.receiver_id || null,
          payer_id: payerUserId || null,
          source_type: notif.type
        });

        if (transactionError) {
          throw new Error(transactionError.message);
        }

        const approvalMessage = notif.type === 'vacation'
          ? `Your vacation request from ${notif.details?.start_date} to ${notif.details?.end_date} has been Approved!`
          : `Your payment request of ₱${paymentAmount} has been Approved!`;

        await supabase.from('notifications').insert({
          email: notif.email,
          type: 'payment_status_update',
          message: approvalMessage,
          status: 'unread',
          details: notif.details
        });
      } else if (action === 'reject') {
        if ((notif.type === 'payment_approval' || notif.type === 'expense_approval') && notif.details) {
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

        // Fixed payload mapped correctly for rejected status
        const { error: transactionError } = await supabase.from('transaction_history').insert({
          original_bill_id: !isExpenseEntry ? targetId : null,
          description: notif.message || `${notif.type} Rejected`,
          total_amount: paymentAmount,
          settled_at: new Date().toISOString(),
          url_receipt: notif.details?.receipt_url || null,
          payment_receiver_id: notif.details?.receiver_id || null,
          payer_id: payerUserId || null,
          source_type: `${notif.type}_rejected`
        });

        if (transactionError) {
          throw new Error(transactionError.message);
        }

        const rejectionMessage = notif.type === 'vacation'
          ? `Your vacation request from ${notif.details?.start_date} to ${notif.details?.end_date} was Rejected.`
          : `Your payment request of ₱${paymentAmount} was Rejected. Please check and try again.`;

        await supabase.from('notifications').insert({
          email: notif.email,
          type: 'payment_status_update',
          message: rejectionMessage,
          status: 'unread',
          details: notif.details
        });
      }

      await supabase.from('notifications').delete().eq('id', notif.id);

      window.dispatchEvent(new Event('billing-updated'));
      window.dispatchEvent(new Event('expense-updated'));
      window.dispatchEvent(new Event('vacation-updated'));
      window.dispatchEvent(new Event('notification-updated'));
      
      await fetchNotifications(currentUserId);
      router.refresh();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error processing notification action:", errorMessage);
      fetchNotifications(currentUserId);
    }
  };

  const pendingCount = notifications.length;

  return (
    <header className="flex flex-row justify-between items-center gap-4 px-4 sm:px-6 py-3.5 border-b border-[#98BDFF]/40 dark:border-[#ff8c00]/30 bg-white dark:bg-[#18181b] transition-colors shadow-xs relative z-40">
      
      {/* Title & Role */}
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

      {/* Right action: Notification Icon & Responsive View */}
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

          {isNotificationsOpen && (
            <>
              {/* Mobile View: Full-Screen Page/Modal overlay list */}
              <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#18181b] flex flex-col sm:hidden animate-in fade-in duration-200">
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">Notifications</h3>
                    <span className="text-xs bg-[#4B49AC]/10 text-[#4B49AC] dark:bg-[#ff8c00]/10 dark:text-[#ff8c00] border border-[#98BDFF]/30 dark:border-[#ff8c00]/30 px-2 py-0.5 rounded-md font-semibold">
                      {pendingCount} New
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {pendingCount === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12">
                      <div className="p-4 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500">
                        <Bell size={32} />
                      </div>
                      <h4 className="font-semibold text-slate-800 dark:text-zinc-200 text-base">No notifications</h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs">
                        You&apos;re all caught up! New alerts will show up here.
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const isVacation = notif.type === 'vacation';
                      const isAnnouncement = notif.type === 'bill_announcement' || notif.type === 'payment_status_update';
                      return (
                        <div key={notif.id} className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl space-y-3 text-xs shadow-xs">
                          <div className="flex items-center gap-2 text-[#4B49AC] dark:text-[#ff8c00]">
                            {isVacation ? <Plane size={16} /> : isAnnouncement ? <Info size={16} /> : <CreditCard size={16} />}
                            <span className="font-semibold text-slate-900 dark:text-white capitalize text-sm">{notif.type.replace('_', ' ')}</span>
                          </div>
                          <p className="text-slate-600 dark:text-zinc-300 leading-relaxed text-sm">{notif.message}</p>

                          {isAnnouncement ? (
                            <div className="flex justify-end pt-3 border-t border-slate-200/60 dark:border-zinc-800">
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'dismiss')}
                                className="w-full bg-slate-200/60 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 h-10 text-xs font-semibold rounded-xl flex items-center justify-center cursor-pointer transition"
                              >
                                Got it / Dismiss
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/60 dark:border-zinc-800">
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'reject')}
                                className="flex-1 bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 h-10 text-xs font-semibold rounded-xl flex items-center justify-center cursor-pointer transition"
                              >
                                <X size={14} className="mr-1.5" /> Reject
                              </button>
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'approve')}
                                className="flex-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 h-10 text-xs font-semibold rounded-xl flex items-center justify-center cursor-pointer transition"
                              >
                                <Check size={14} className="mr-1.5" /> Approve
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Desktop View: Dropdown panel */}
              <div className="hidden sm:block absolute right-0 mt-3 w-96 bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-[9999] p-4 text-slate-900 dark:text-white space-y-3 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <h4 className="font-bold text-sm">Notifications</h4>
                  <span className="text-xs bg-[#4B49AC]/10 text-[#4B49AC] dark:bg-[#ff8c00]/10 dark:text-[#ff8c00] border border-[#98BDFF]/30 dark:border-[#ff8c00]/30 px-2 py-0.5 rounded-md font-semibold">
                    {pendingCount} New
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {pendingCount === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <p className="text-xs text-slate-500 dark:text-zinc-400">No notifications at the moment.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const isVacation = notif.type === 'vacation';
                      const isAnnouncement = notif.type === 'bill_announcement' || notif.type === 'payment_status_update';
                      return (
                        <div key={notif.id} className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 p-3 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-[#4B49AC] dark:text-[#ff8c00]">
                            {isVacation ? <Plane size={14} /> : isAnnouncement ? <Info size={14} /> : <CreditCard size={14} />}
                            <span className="font-semibold text-slate-900 dark:text-white capitalize truncate">{notif.type.replace('_', ' ')}</span>
                          </div>
                          <p className="text-slate-600 dark:text-zinc-300 leading-relaxed">{notif.message}</p>

                          {isAnnouncement ? (
                            <div className="flex justify-end pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'dismiss')}
                                className="w-full bg-slate-200/60 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 h-7 text-[11px] px-3 rounded-lg flex items-center justify-center cursor-pointer font-medium transition"
                              >
                                Dismiss
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'reject')}
                                className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 h-7 text-[11px] px-3 rounded-lg flex items-center cursor-pointer font-medium transition"
                              >
                                <X size={12} className="mr-1" /> Reject
                              </button>
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'approve')}
                                className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 h-7 text-[11px] px-3 rounded-lg flex items-center cursor-pointer font-medium transition"
                              >
                                <Check size={12} className="mr-1" /> Approve
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
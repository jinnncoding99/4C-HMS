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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
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
        .select('username, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileData) {
        if (profileData.username) setUsername(profileData.username);
        if (profileData.avatar_url) setAvatarUrl(profileData.avatar_url);
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
        if (notif.type === 'bill_announcement' || notif.type === 'payment_status_update') {
          return userEmail && notif.email === userEmail;
        }
        // Updated to include 'expense_payment_approval'
        if (notif.type === 'payment_approval' || notif.type === 'expense_approval' || notif.type === 'expense_payment_approval') {
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

      // Updated to recognize both expense approval variants
      const isExpenseEntry = notif.type === 'expense_approval' || notif.type === 'expense_payment_approval';
      const targetId = isExpenseEntry ? notif.details?.expense_id : notif.details?.bill_id;
      const paymentAmount = Number(notif.details?.amount || 0);
      const payerUserId = notif.details?.user_id;

      const tableName = isExpenseEntry ? 'expense_shares' : 'bill_shares';
      const foreignKeyName = isExpenseEntry ? 'expense_id' : 'bill_id';
      const userKeyName = isExpenseEntry ? 'user_id' : 'boarder_id';

      if (action === 'approve') {
        if ((notif.type === 'payment_approval' || notif.type === 'expense_approval' || notif.type === 'expense_payment_approval') && notif.details) {
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

        await supabase.from('transaction_history').insert({
          original_bill_id: !isExpenseEntry ? targetId : null,
          description: notif.message || `${notif.type} Approved`,
          total_amount: paymentAmount,
          settled_at: new Date().toISOString(),
          url_receipt: notif.details?.receipt_url || null,
          payment_receiver_id: notif.details?.receiver_id || null,
          payer_id: payerUserId || null,
          source_type: notif.type
        });

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
        if ((notif.type === 'payment_approval' || notif.type === 'expense_approval' || notif.type === 'expense_payment_approval') && notif.details) {
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

        await supabase.from('transaction_history').insert({
          original_bill_id: !isExpenseEntry ? targetId : null,
          description: notif.message || `${notif.type} Rejected`,
          total_amount: paymentAmount,
          settled_at: new Date().toISOString(),
          url_receipt: notif.details?.receipt_url || null,
          payment_receiver_id: notif.details?.receiver_id || null,
          payer_id: payerUserId || null,
          source_type: `${notif.type}_rejected`
        });

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
    <header 
      className="flex flex-row justify-between items-center gap-4 px-4 sm:px-6 py-4 bg-transparent relative z-40 shadow-none rounded-none w-full border-b border-[#4B49AC]"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-[#4B49AC] text-white font-bold text-sm shrink-0 overflow-hidden shadow-sm cursor-pointer"
          style={{ border: 'none', outline: 'none' }}
          aria-label="Open profile menu"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
          ) : (
            <span>{username?.[0]?.toUpperCase() || "U"}</span>
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-2xl font-bold tracking-tight text-slate-900 truncate">{title}</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-[#4B49AC]/15 text-[#4B49AC]">
              {role}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 truncate">
            Welcome back, <span className="font-semibold text-slate-700">{username}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative" ref={notifRef}>
          <button 
            type="button"
            aria-label="Toggle Notifications"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2.5 rounded-xl text-[#4B49AC] hover:bg-slate-100/60 transition-all cursor-pointer"
            style={{ border: 'none', outline: 'none' }}
          >
            <Bell size={18} />
            {pendingCount > 0 && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4B49AC]/50 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4B49AC]"></span>
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <>
              {/* Mobile View */}
              <div className="fixed inset-0 z-[9999] bg-white flex flex-col sm:hidden animate-in fade-in duration-200">
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900">Notifications</h3>
                    <span className="text-xs bg-[#4B49AC]/10 text-[#4B49AC] px-2 py-0.5 rounded-md font-semibold">
                      {pendingCount} New
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="p-2 rounded-xl bg-slate-100 text-slate-600"
                    style={{ border: 'none', outline: 'none' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {pendingCount === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12">
                      <div className="p-4 rounded-full bg-slate-100 text-slate-400">
                        <Bell size={32} />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-base">No notifications</h4>
                      <p className="text-xs text-slate-500 max-w-xs">
                        You&apos;re all caught up! New alerts will show up here.
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const isVacation = notif.type === 'vacation';
                      const isAnnouncement = notif.type === 'bill_announcement' || notif.type === 'payment_status_update';
                      return (
                        <div key={notif.id} className="bg-slate-50 p-4 rounded-xl space-y-3 text-xs shadow-xs">
                          <div className="flex items-center gap-2 text-[#4B49AC]">
                            {isVacation ? <Plane size={16} /> : isAnnouncement ? <Info size={16} /> : <CreditCard size={16} />}
                            <span className="font-semibold text-slate-900 capitalize text-sm">{notif.type.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-slate-600 leading-relaxed text-sm">{notif.message}</p>

                          {isAnnouncement ? (
                            <div className="flex justify-end pt-3">
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'dismiss')}
                                className="w-full bg-slate-200/60 text-slate-700 h-10 text-xs font-semibold rounded-xl flex items-center justify-center cursor-pointer transition"
                                style={{ border: 'none', outline: 'none' }}
                              >
                                Got it / Dismiss
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-3 pt-3">
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'reject')}
                                className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 h-10 text-xs font-semibold rounded-xl flex items-center justify-center cursor-pointer transition"
                                style={{ border: 'none', outline: 'none' }}
                              >
                                <X size={14} className="mr-1.5" /> Reject
                              </button>
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'approve')}
                                className="flex-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 h-10 text-xs font-semibold rounded-xl flex items-center justify-center cursor-pointer transition"
                                style={{ border: 'none', outline: 'none' }}
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

              {/* Desktop View */}
              <div className="hidden sm:block absolute right-0 mt-3 w-96 bg-white shadow-2xl rounded-2xl z-[9999] p-4 text-slate-900 space-y-3 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center pb-3">
                  <h4 className="font-bold text-sm">Notifications</h4>
                  <span className="text-xs bg-[#4B49AC]/10 text-[#4B49AC] px-2 py-0.5 rounded-md font-semibold">
                    {pendingCount} New
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {pendingCount === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <p className="text-xs text-slate-500">No notifications at the moment.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const isVacation = notif.type === 'vacation';
                      const isAnnouncement = notif.type === 'bill_announcement' || notif.type === 'payment_status_update';
                      return (
                        <div key={notif.id} className="bg-slate-50 p-3 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-[#4B49AC]">
                            {isVacation ? <Plane size={14} /> : isAnnouncement ? <Info size={14} /> : <CreditCard size={14} />}
                            <span className="font-semibold text-slate-900 capitalize truncate">{notif.type.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-slate-600 leading-relaxed">{notif.message}</p>

                          {isAnnouncement ? (
                            <div className="flex justify-end pt-2">
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'dismiss')}
                                className="w-full bg-slate-200/60 text-slate-700 h-7 text-[11px] px-3 rounded-lg flex items-center justify-center cursor-pointer font-medium transition"
                                style={{ border: 'none', outline: 'none' }}
                              >
                                Dismiss
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2 pt-2">
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'reject')}
                                className="bg-red-50 text-red-600 hover:bg-red-100 h-7 text-[11px] px-3 rounded-lg flex items-center cursor-pointer font-medium transition"
                                style={{ border: 'none', outline: 'none' }}
                              >
                                <X size={12} className="mr-1" /> Reject
                              </button>
                              <button 
                                onClick={() => handleDismissOrApprove(notif, 'approve')}
                                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 h-7 text-[11px] px-3 rounded-lg flex items-center cursor-pointer font-medium transition"
                                style={{ border: 'none', outline: 'none' }}
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
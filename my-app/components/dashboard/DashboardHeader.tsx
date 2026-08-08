'use client';

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, User as UserIcon, LogOut, QrCode, Edit2, Users, Bell, Check, X, Plane, CreditCard, Sun, Moon } from "lucide-react";
import { createClient } from "@/lib/supabase/client"; 
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  title: string;
  role: string;
  username?: string;
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

export default function DashboardHeader({ title, role, username: initialUsername }: DashboardHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [username, setUsername] = useState<string>(initialUsername || "Loading...");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  // Robust case-insensitive check for Admin role
  const isAdmin = role?.trim().toLowerCase() === 'admin';

  useEffect(() => {
    // If username wasn't passed via props immediately, fetch it
    if (!initialUsername) {
      const fetchUserData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();

          if (profileData?.username) {
            setUsername(profileData.username);
          } else {
            setUsername(user.email?.split('@')[0] || "User");
          }
        }
      };
      fetchUserData();
    } else {
      setUsername(initialUsername);
    }
  }, [initialUsername, supabase]);

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
        const newNotif = payload.new as Notification;

        const isPaymentApprovalForMe = (newNotif.type === 'payment_approval' || newNotif.type === 'expense_payment_approval') && newNotif.details?.receiver_id === activeId;
        const isOtherApprovalForMe = newNotif.type !== 'payment_approval' && newNotif.type !== 'expense_payment_approval' && newNotif.details?.user_id !== activeId;

        if (isPaymentApprovalForMe || isOtherApprovalForMe) {
          window.alert("New approval request received! Click OK to refresh your dashboard.");
          window.dispatchEvent(new Event('billing-updated'));
          fetchNotifications(activeId);
          router.refresh();
        } else {
          fetchNotifications(activeId);
        }
      })
      .subscribe();

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, router, supabase]);

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

          // 1. Fetch the payer's existing share row using shared_amount
          const { data: payerShare } = await supabase
            .from(tableName)
            .select('*')
            .eq(foreignKeyName, targetBillId)
            .eq(userKeyName, payerUserId)
            .maybeSingle();

          if (payerShare) {
            const currentSharedAmount = Number(payerShare.shared_amount || 0);
            const currentPaidAmount = Number(payerShare.paid_amount || 0);

            // Deduct payment from the payer's shared_amount, making it approach 0, and add to paid_amount
            const newSharedAmount = Math.max(0, currentSharedAmount - paymentAmount);
            const newPaidAmount = currentPaidAmount + paymentAmount;
            const isFullyPaidForUser = newSharedAmount === 0;

            const { error: shareError } = await supabase
              .from(tableName)
              .update({ 
                is_paid: isFullyPaidForUser, 
                status: isFullyPaidForUser ? 'paid' : 'pending_approval',
                shared_amount: newSharedAmount,
                paid_amount: newPaidAmount 
              })
              .eq(foreignKeyName, targetBillId)
              .eq(userKeyName, payerUserId);

            if (shareError) throw shareError;
          }

          // 2. Add the payment amount to the receiver's shared_amount so total liability remains conserved
          if (receiverId) {
            const { data: receiverShare } = await supabase
              .from(tableName)
              .select('*')
              .eq(foreignKeyName, targetBillId)
              .eq(userKeyName, receiverId)
              .maybeSingle();

            if (receiverShare) {
              const currentReceiverAmount = Number(receiverShare.shared_amount || 0);
              const updatedReceiverAmount = currentReceiverAmount + paymentAmount;

              await supabase
                .from(tableName)
                .update({ 
                  shared_amount: updatedReceiverAmount 
                })
                .eq(foreignKeyName, targetBillId)
                .eq(userKeyName, receiverId);
            }
          }

          // 3. Check if all individual shares are settled completely
          const { data: allShares, error: fetchSharesError } = await supabase
            .from(tableName)
            .select('*')
            .eq(foreignKeyName, targetBillId);

          const parentTable = isExpenseEntry ? 'expenses' : 'bills';
          const { data: parentData, error: fetchParentError } = await supabase
            .from(parentTable)
            .select('*')
            .eq('id', targetBillId)
            .single();

          if (!fetchSharesError && !fetchParentError && allShares && parentData) {
            const allSharesPaid = allShares.length > 0 && allShares.every(s => (s.is_paid || s.status === 'paid' || Number(s.shared_amount || 0) === 0));
            const totalPaidSum = allShares.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
            const parentTotal = Number(parentData.total_amount || 0);

            const isFullySettled = allSharesPaid || totalPaidSum >= parentTotal;

            if (isFullySettled) {
              if (!isExpenseEntry) {
                const { error: historyError } = await supabase
                  .from('transaction_history')
                  .insert({
                    original_bill_id: parentData.id,
                    description: parentData.description,
                    total_amount: parentData.total_amount,
                    billing_period_start: parentData.billing_period_start,
                    billing_period_end: parentData.billing_period_end,
                    calculation_type: parentData.calculation_type,
                    settled_at: new Date().toISOString()
                  });

                if (historyError) throw new Error(`Transaction History Insert Failed: ${historyError.message}`);

                const { error: deleteSharesError } = await supabase
                  .from(tableName)
                  .delete()
                  .eq(foreignKeyName, targetBillId);

                if (deleteSharesError) throw new Error(`Shares Cleanup Failed: ${deleteSharesError.message}`);

                const { error: parentDeleteError } = await supabase
                  .from(parentTable)
                  .delete()
                  .eq('id', targetBillId);

                if (parentDeleteError) throw new Error(`Parent Deletion Failed: ${parentDeleteError.message}`);
              } else {
                await supabase
                  .from(parentTable)
                  .update({ status: 'paid', is_paid: true })
                  .eq('id', targetBillId);
              }
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

      const { error: notifDeleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notif.id);

      if (notifDeleteError) throw notifDeleteError;

      alert("Request approved successfully!");
      window.dispatchEvent(new Event('billing-updated'));
      window.dispatchEvent(new Event('expense-updated'));
      fetchNotifications(currentUserId);
      router.refresh();
    } catch (err: any) {
      console.error("Error approving request:", err.message || err);
      alert("Failed to approve request: " + (err.message || JSON.stringify(err)));
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

      await supabase
        .from('notifications')
        .delete()
        .eq('id', notif.id);

      alert("Request rejected.");
      window.dispatchEvent(new Event('billing-updated'));
      window.dispatchEvent(new Event('expense-updated'));
      fetchNotifications(currentUserId);
      router.refresh();
    } catch (err: any) {
      console.error("Error rejecting request:", err.message);
    }
  };

  const handleEditUsername = () => { setIsMenuOpen(false); router.push('/dashboard/settings'); };
  const handleManageQR = () => { router.push('/dashboard/qr'); setIsMenuOpen(false); };
  const handleUserManagement = () => { router.push('/dashboard/users'); setIsMenuOpen(false); };
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/auth'); router.refresh(); };

  const pendingCount = notifications.length;

  return (
    <div className="flex flex-row justify-between items-center gap-2 p-4 sm:p-6 border-b border-slate-200 dark:border-[#ff8c00] bg-white dark:bg-[#111111] transition-colors">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{title}</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 font-medium tracking-wide uppercase truncate">
          {role} • <span className="text-orange-600 dark:text-[#ff8c00]">{username}</span>
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Theme Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-xl border-slate-200 dark:border-[#ff8c00]/30 bg-slate-50 dark:bg-[#222] text-orange-600 dark:text-[#ff8c00] hover:bg-orange-600 hover:text-white dark:hover:bg-[#ff8c00] dark:hover:text-black transition h-10 w-10 p-0 flex items-center justify-center cursor-pointer shadow-sm"
          title="Toggle Theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 text-slate-600 dark:text-white hover:text-orange-600 dark:hover:text-[#ff8c00] transition cursor-pointer"
          >
            <Bell size={22} />
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
            )}
          </button>

          {isNotificationsOpen && pendingCount > 0 && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#ff8c00] rounded-2xl shadow-xl z-[9999] p-4 text-slate-900 dark:text-white space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-[#ff8c00]/30 pb-3">
                <h4 className="font-bold text-sm">Pending Approvals</h4>
                <span className="text-xs bg-orange-500/10 text-orange-600 dark:bg-[#ff8c00]/10 dark:text-[#ff8c00] border border-orange-500/30 dark:border-[#ff8c00]/30 px-2 py-0.5 rounded-md font-semibold">
                  {pendingCount} New
                </span>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {notifications.map((notif) => {
                  const isVacation = notif.type === 'vacation';
                  
                  return (
                    <div key={notif.id} className="bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-[#333] p-3 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-orange-600 dark:text-[#ff8c00]">
                        {isVacation ? <Plane size={14} /> : <CreditCard size={14} />}
                        <span className="font-semibold text-slate-900 dark:text-white capitalize">{notif.type.replace('_', ' ')} Request</span>
                        <span className="text-slate-400 dark:text-gray-500 text-[10px] ml-auto">{notif.email}</span>
                      </div>
                      <p className="text-slate-600 dark:text-gray-300">{notif.message}</p>

                      {notif.details?.receipt_url && notif.details.receipt_url !== "not applicable" && (
                        <a 
                          href={notif.details.receipt_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[10px] text-blue-500 dark:text-blue-400 underline block"
                        >
                          View Receipt Proof
                        </a>
                      )}
                      
                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-200 dark:border-[#222]">
                        <button 
                          onClick={() => handleReject(notif)}
                          className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 h-7 text-[11px] px-3 rounded-lg flex items-center cursor-pointer font-medium transition"
                        >
                          <X size={12} className="mr-1" /> Reject
                        </button>
                        <button 
                          onClick={() => handleApprove(notif)}
                          className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/30 h-7 text-[11px] px-3 rounded-lg flex items-center cursor-pointer font-medium transition"
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

        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a1a1a] dark:hover:bg-[#333333] rounded-xl transition-all border border-slate-200 dark:border-[#ff8c00] cursor-pointer flex items-center justify-center shadow-sm"
          >
            {isAdmin ? (
              <ShieldCheck className="text-orange-600 dark:text-[#ff8c00]" size={22} />
            ) : (
              <UserIcon className="text-slate-500 dark:text-gray-400" size={22} />
            )}
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#ff8c00] rounded-2xl shadow-xl z-[9999] p-2 animate-in fade-in zoom-in duration-200">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-[#ff8c00]">
                <p className="font-semibold text-slate-900 dark:text-white truncate">{username}</p>
                <button onClick={handleEditUsername} className="text-xs text-orange-600 dark:text-[#ff8c00] flex items-center gap-1.5 hover:underline mt-1 cursor-pointer">
                  <Edit2 size={12} /> Edit Profile
                </button>
              </div>
              
              <nav className="flex flex-col gap-1 mt-1">
                {isAdmin && (
                  <button onClick={handleUserManagement} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-[#333333] rounded-xl transition cursor-pointer">
                    <Users size={18} className="text-orange-600 dark:text-[#ff8c00]" /> User Management
                  </button>
                )}
                
                <button onClick={handleManageQR} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-[#333333] rounded-xl transition cursor-pointer">
                  <QrCode size={18} className="text-orange-600 dark:text-[#ff8c00]" /> Manage QR Code
                </button>
                <div className="h-px bg-slate-200 dark:bg-[#ff8c00]/20 mx-4 my-1" />
                <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 rounded-xl transition cursor-pointer">
                  <LogOut size={18} /> Logout
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
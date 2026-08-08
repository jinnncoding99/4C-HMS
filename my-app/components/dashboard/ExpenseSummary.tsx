'use client';

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import ExpenseForm from "./ExpenseForm";
import { createClient } from "@/lib/supabase/client";
import { QrCode, ChevronDown, ChevronUp, Edit, Trash2, PlusCircle, CheckCircle, FileText, Clock } from "lucide-react";

interface Profile {
  id: string;
  username?: string;
  full_name?: string;
  role: string;
  qr_code_url?: string | null;
  email?: string;
}

interface ExpenseShare {
  id: string;
  username: string;
  role: string;
  shareDue: number;
  isPaid?: boolean;
  status?: string;
  paid_amount?: number;
}

interface Expense {
  id: string;
  description: string;
  total_amount: number;
  expense_date?: string | null;
  payment_receiver_id?: string;
  is_paid?: boolean;
  status?: string;
  created_at?: string;
  created_by?: string;
}

interface PaymentRequestDetail {
  expense_id: string;
  user_id: string;
  receiver_id?: string;
  amount: string;
  method: string;
  receipt_url?: string | null;
}

interface NotificationItem {
  id: string;
  type: string;
  email: string;
  message: string;
  status?: string;
  details?: PaymentRequestDetail;
}

export default function ExpenseSummary({ userId }: { userId?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseSharesMap, setExpenseSharesMap] = useState<{ [key: string]: ExpenseShare[] }>({});
  const [userRole, setUserRole] = useState<string>("User");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userPaymentRequests, setUserPaymentRequests] = useState<NotificationItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [expandedExpenses, setExpandedExpenses] = useState<{ [key: string]: boolean }>({});
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [selectedExpenseForPay, setSelectedExpenseForPay] = useState<Expense | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('online');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [receiverProfile, setReceiverProfile] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [settlingExpense, setSettlingExpense] = useState<Expense | null>(null);
  const [settleMethod, setSettleMethod] = useState<'cash' | 'online'>('cash');
  const [settleReceiptFile, setSettleReceiptFile] = useState<File | null>(null);
  const [settlingSubmitting, setSettlingSubmitting] = useState(false);

  // Profile map helper for receiver lookups
  const [profileMap, setProfileMap] = useState<Map<string, Profile>>(new Map());

  const supabase = createClient();

  useEffect(() => {
    setIsMounted(true);
    fetchData();

    const handleExpenseUpdate = () => {
      fetchData();
    };

    window.addEventListener('expense-updated', handleExpenseUpdate);

    const channel = supabase
      .channel('expense-realtime-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_shares' },
        () => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => { fetchData(); }
      )
      .subscribe();

    return () => {
      window.removeEventListener('expense-updated', handleExpenseUpdate);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    let activeId = user?.id || userId;
    
    if (activeId) {
      setCurrentUserId(activeId);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', activeId)
        .maybeSingle();
      
      if (profile) {
        setUserRole(profile.role || 'User');
      }
    }

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, full_name, role, qr_code_url, email');
    setProfiles(profilesData || []);
    const newProfileMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    setProfileMap(newProfileMap);

    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: true });

    if (!expensesError && expensesData) {
      const { data: sharesData } = await supabase
        .from("expense_shares")
        .select("*")
        .in("expense_id", expensesData.map(e => e.id).filter(Boolean));

      const expenseMap = new Map(expensesData.map(e => [e.id, e]));

      if (sharesData) {
        const map: { [key: string]: ExpenseShare[] } = {};

        for (const expense of expensesData) {
          const expenseShares = sharesData.filter((s: any) => s.expense_id === expense.id);
          const parentExpense: any = expenseMap.get(expense.id);
          const totalAmount = Number(parentExpense?.total_amount || 0);

          const tempShares: ExpenseShare[] = [];

          expenseShares.forEach((share: any) => {
            const memberId = share.user_id;
            if (!memberId) return;
            const prof: any = newProfileMap.get(memberId);

            const isSharePaid = Boolean(share.is_paid ?? share.isPaid ?? (share.status === 'paid'));
            const shareStatus = share.status || (isSharePaid ? 'paid' : 'unpaid');
            let shareAmount = Number(share.shared_amount ?? 0);

            if (share.shared_amount === null || share.shared_amount === undefined || share.shared_amount === 0) {
              if (expenseShares.length > 0) {
                shareAmount = totalAmount / expenseShares.length;
              }
            }

            tempShares.push({
              id: memberId,
              username: prof?.username || prof?.full_name || 'Unknown Member',
              role: prof?.role || 'User',
              shareDue: shareAmount,
              isPaid: isSharePaid,
              status: shareStatus,
              paid_amount: Number(share.paid_amount || 0)
            });
          });

          const receiverId = parentExpense?.payment_receiver_id;
          
          const nonReceiverShares = tempShares.filter(s => s.id !== receiverId);
          const allNonReceiversPaid = nonReceiverShares.length > 0 && nonReceiverShares.every(s => s.isPaid || s.status === 'paid');

          if (receiverId && allNonReceiversPaid) {
            const receiverShareObj = tempShares.find(s => s.id === receiverId);
            if (receiverShareObj && !receiverShareObj.isPaid && receiverShareObj.status !== 'paid') {
              receiverShareObj.isPaid = true;
              receiverShareObj.status = 'paid';
              receiverShareObj.paid_amount = receiverShareObj.shareDue;

              await supabase
                .from("expense_shares")
                .update({ is_paid: true, status: 'paid', paid_amount: receiverShareObj.shareDue })
                .eq("expense_id", expense.id)
                .eq("user_id", receiverId);
            }
          }

          const allPaid = tempShares.length > 0 && tempShares.every(s => s.isPaid || s.status === 'paid');
          if (allPaid && parentExpense && parentExpense.status !== 'paid') {
            await supabase.from("expenses").update({ status: 'paid', is_paid: true }).eq("id", expense.id);
          }

          map[expense.id] = tempShares;
        }
        setExpenseSharesMap(map);
      }

      setExpenses(expensesData.reverse());
    }

    const { data: notifsData } = await supabase
      .from("notifications")
      .select("*")
      .eq("type", "expense_payment_approval");
      
    setUserPaymentRequests(notifsData || []);
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense entry?")) return;
    await supabase.from("expense_shares").delete().eq("expense_id", id);
    await supabase.from("expenses").delete().eq("id", id);
    fetchData();
  };

  const toggleExpand = (id: string) => {
    setExpandedExpenses(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenPayModal = async (expense: Expense, calculatedShare: number, currentPaidAmount: number = 0) => {
    setSelectedExpenseForPay(expense);
    const remainingDue = Math.max(0, calculatedShare - currentPaidAmount);
    setPaymentAmount(remainingDue.toFixed(2));
    setPaymentMethod('online');
    setReceiptFile(null);
    
    if (expense?.payment_receiver_id) {
      const receiver = profileMap.get(expense.payment_receiver_id);
      setReceiverProfile(receiver || { id: '', username: 'Payment Receiver', qr_code_url: null, role: 'User' });
    } else {
      setReceiverProfile({ id: '', username: 'Payment Receiver', qr_code_url: null, role: 'User' });
    }
  };

  const submitPaymentRequest = async () => {
    if (!selectedExpenseForPay) return;

    if (paymentMethod === 'online' && !receiptFile) {
      alert("Please upload receipt proof to validate your online payment.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentAuthId = user?.id || activeUserId;
      let receiptUrl: string | null = null;

      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile);

        if (!uploadError) {
          const { data: publicURLData } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);
          receiptUrl = publicURLData.publicUrl;
        }
      }

      const { data: existingShare } = await supabase
        .from('expense_shares')
        .select('paid_amount, shared_amount')
        .eq('expense_id', selectedExpenseForPay.id)
        .eq('user_id', currentAuthId)
        .maybeSingle();

      const previousPaid = Number(existingShare?.paid_amount || 0);
      const newlyAddedAmount = Number(paymentAmount);
      const totalAccumulatedPaid = previousPaid + newlyAddedAmount;
      const totalShareDue = Number(existingShare?.shared_amount || newlyAddedAmount);

      const isNowFullyPaid = totalAccumulatedPaid >= totalShareDue;

      const notificationPayload = {
        type: 'expense_payment_approval',
        email: user?.email || 'User',
        message: `Payment submitted for expense: ${selectedExpenseForPay.description} via ${paymentMethod.toUpperCase()} amount: ₱${newlyAddedAmount.toFixed(2)}`,
        status: 'pending',
        details: {
          expense_id: selectedExpenseForPay.id,
          user_id: currentAuthId || '',
          receiver_id: selectedExpenseForPay.payment_receiver_id || null,
          amount: newlyAddedAmount.toString(),
          method: paymentMethod,
          receipt_url: receiptUrl
        }
      };

      const { error: notifError } = await supabase.from('notifications').insert([notificationPayload]);
      if (notifError) throw notifError;

      await supabase
        .from('expense_shares')
        .update({ 
          status: isNowFullyPaid ? 'paid' : 'pending_approval',
          is_paid: isNowFullyPaid,
          payment_method: paymentMethod,
          paid_amount: totalAccumulatedPaid,
          receipt_url: receiptUrl
        })
        .eq('expense_id', selectedExpenseForPay.id)
        .eq('user_id', currentAuthId);

      alert("Payment submitted successfully and recorded against your share due!");
      setSelectedExpenseForPay(null);
      setReceiptFile(null);
      await fetchData();
    } catch (err: any) {
      console.error("Error submitting payment:", err.message);
      alert("Failed to submit payment request. Please check console.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettleExpenseAsReceiver = async () => {
    if (!settlingExpense) return;

    if (settleMethod === 'online' && !settleReceiptFile) {
      alert("Please upload receipt screenshot/proof for online settlement.");
      return;
    }

    setSettlingSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let receiptUrl: string | null = null;

      if (settleReceiptFile) {
        const fileExt = settleReceiptFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, settleReceiptFile);

        if (!uploadError) {
          const { data: publicURLData } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);
          receiptUrl = publicURLData.publicUrl;
        }
      }

      const { data: currentShares } = await supabase
        .from('expense_shares')
        .select('*')
        .eq('expense_id', settlingExpense.id);

      if (currentShares) {
        for (const s of currentShares) {
          const fullDue = Number(s.shared_amount || 0);
          await supabase
            .from('expense_shares')
            .update({
              status: 'paid',
              is_paid: true,
              paid_amount: fullDue,
              payment_method: settleMethod,
              receipt_url: receiptUrl
            })
            .eq('expense_id', settlingExpense.id)
            .eq('user_id', s.user_id);
        }
      }

      await supabase
        .from('expenses')
        .update({
          status: 'paid',
          is_paid: true
        })
        .eq('id', settlingExpense.id);

      alert("Expense fully settled successfully and all share balances updated!");
      setSettlingExpense(null);
      setSettleReceiptFile(null);
      await fetchData();
    } catch (err: any) {
      console.error("Error settling expense:", err.message);
      alert("Failed to settle expense. Please check console.");
    } finally {
      setSettlingSubmitting(false);
    }
  };

  const isAdmin = userRole.toLowerCase() === 'admin';
  const activeUserId = currentUserId || userId || (profiles.length > 0 ? profiles[0]?.id : null);

  const displayExpenses = expenses.filter(expense => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every(b => b.isPaid || b.status === 'paid');
    const isExpensePaid = expense.is_paid || expense.status === 'paid' || allSharesPaid;
    return !isExpensePaid;
  });

  const totalDue = expenses.reduce((acc, expense) => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every(b => b.isPaid || b.status === 'paid');
    if (expense.is_paid || expense.status === 'paid' || allSharesPaid) return acc;

    const myBreakdown = breakdown.find(item => item.id === activeUserId);
    if (expense.payment_receiver_id === activeUserId) return acc;

    const netDue = myBreakdown ? Math.max(0, Number(myBreakdown.shareDue) - Number(myBreakdown.paid_amount || 0)) : 0;
    return acc + (myBreakdown && !myBreakdown.isPaid && myBreakdown.status !== 'paid' ? netDue : 0);
  }, 0);

  if (!isMounted) return null;

  return (
    <div className="w-full space-y-6">
      <Card className="bg-[#18181b] border-zinc-800 text-zinc-100 shadow-xl overflow-hidden rounded-xl">
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800/80 pb-5">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" />
                Expense Summary & Settlements
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                Track shared miscellaneous entries, validate partial/full payments, and automatically credit receiver balances upon full collection.
              </p>
            </div>
            
            {isAdmin && (
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold transition-all shadow-sm">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Expense Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#18181b] border-zinc-800 text-zinc-100 sm:max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-white">Create New Expense Entry</DialogTitle>
                  </DialogHeader>
                  <div className="py-2">
                    <ExpenseForm 
                      onSuccess={() => { setIsOpen(false); fetchData(); }} 
                      onCancel={() => setIsOpen(false)} 
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="space-y-4">
            {displayExpenses.length === 0 ? (
              <div className="text-center py-12 bg-zinc-900/40 rounded-xl border border-dashed border-zinc-800">
                <FileText className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-300">No active expense entries found.</p>
                <p className="text-xs text-zinc-500 mt-1">All shared entries have been completely settled.</p>
              </div>
            ) : (
              displayExpenses.map((expense) => {
                const isExpanded = !!expandedExpenses[expense.id];
                const breakdown = expenseSharesMap[expense.id] || [];
                
                const myBreakdown = breakdown.find(b => b.id === activeUserId);
                const userShareDue = myBreakdown ? myBreakdown.shareDue : 0; 
                const userPaidAmount = myBreakdown ? Number(myBreakdown.paid_amount || 0) : 0;
                const netUserShareDue = Math.max(0, userShareDue - userPaidAmount);
                const isMySharePaid = myBreakdown?.isPaid || myBreakdown?.status === 'paid' || netUserShareDue === 0;

                const hasPendingSubmission = userPaymentRequests.some(req => 
                  req.details?.expense_id === expense.id && req.details?.user_id === activeUserId
                ) || myBreakdown?.status === 'pending_approval';

                const hasAnyActivity = breakdown.some(b => b.status === 'pending_approval' || b.status === 'paid' || b.isPaid) ||
                  userPaymentRequests.some(req => req.details?.expense_id === expense.id);

                const allSharesArePaid = breakdown.length > 0 && breakdown.every(b => b.isPaid || b.status === 'paid');
                const isReceiver = expense.payment_receiver_id === activeUserId;

                const receiverProfileObj = expense.payment_receiver_id ? profileMap.get(expense.payment_receiver_id) : null;
                const receiverName = receiverProfileObj?.username || receiverProfileObj?.full_name || 'N/A';

                return (
                  <div key={expense.id} className="p-5 border border-zinc-800/80 rounded-xl bg-zinc-900/60 hover:border-zinc-700 transition-all space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-semibold text-base text-white">{expense.description}</h4>
                          {(allSharesArePaid || expense.status === 'paid' || expense.is_paid) && (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium px-2.5 py-0.5 rounded-full">
                              <CheckCircle className="h-3 w-3" /> Settled
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                          <span>Date: <span className="text-zinc-300">{expense.expense_date || 'N/A'}</span></span>
                          <span>•</span>
                          <span>Payment Receiver: <span className="text-amber-400 font-medium">{receiverName}</span></span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right mt-2 sm:mt-0">
                        <span className="text-xs text-zinc-400 block">Total Amount</span>
                        <span className="font-bold text-lg text-amber-500">₱{Number(expense.total_amount).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-3 border-t border-zinc-800/60 gap-3">
                      <div>
                        <span className="text-xs text-zinc-400 block">{isReceiver ? "Role Status" : "Your Net Share Due"}</span>
                        <div className="text-sm font-semibold mt-0.5">
                          {isReceiver ? (
                            <span className="text-amber-400 text-xs font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              Payment Receiver (Auto-credited upon collection)
                            </span>
                          ) : myBreakdown ? (
                            isMySharePaid ? (
                              <span className="text-emerald-400 flex items-center gap-1 text-xs">
                                <CheckCircle className="h-3.5 w-3.5" /> ₱0.00 (Fully Paid)
                              </span>
                            ) : (
                              <div>
                                <span className="text-zinc-100 font-bold">₱{netUserShareDue.toFixed(2)}</span>
                                {userPaidAmount > 0 && (
                                  <span className="text-[11px] text-zinc-400 ml-2">(Paid: ₱{userPaidAmount.toFixed(2)} of ₱{userShareDue.toFixed(2)})</span>
                                )}
                              </div>
                            )
                          ) : (
                            <span className="text-zinc-500 italic text-xs">Not included in this breakdown</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
                        {!isReceiver && myBreakdown && netUserShareDue > 0 && !allSharesArePaid && (
                          hasPendingSubmission ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg">
                              <Clock className="h-3.5 w-3.5 animate-pulse" /> Pending Approval
                            </span>
                          ) : (
                            <Button 
                              onClick={() => handleOpenPayModal(expense, userShareDue, userPaidAmount)}
                              className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-xs h-9 px-4 shadow-sm"
                            >
                              Pay Share
                            </Button>
                          )
                        )}

                        {isReceiver && !allSharesArePaid && (
                          <Button
                            type="button"
                            onClick={() => {
                              setSettlingExpense(expense);
                              setSettleMethod('cash');
                              setSettleReceiptFile(null);
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-xs h-9 px-4 shadow-sm"
                          >
                            Settle Bill Payment
                          </Button>
                        )}

                        {isReceiver && (
                          <div className="flex items-center gap-2">
                            {(allSharesArePaid || expense.status === 'paid' || expense.is_paid) && (
                              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                                <CheckCircle className="h-3.5 w-3.5" /> Completed
                              </span>
                            )}
                            
                            {!hasAnyActivity && (
                              <div className="flex items-center gap-1.5">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingExpense(expense);
                                  }} 
                                  className="border-zinc-700 bg-zinc-900 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 text-xs h-8 px-2.5"
                                  title="Edit Expense"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                                </Button>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteExpense(expense.id);
                                  }} 
                                  className="border-zinc-700 bg-zinc-900 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs h-8 px-2.5"
                                  title="Delete Expense"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button 
                        onClick={() => toggleExpand(expense.id)}
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium focus:outline-none transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {isExpanded ? "Hide Member Breakdown" : `View Member Breakdown (${breakdown.length} Participants)`}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 p-3.5 bg-zinc-950/70 rounded-lg border border-zinc-800/80 space-y-2">
                          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Participant Share Status & Deductions</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {breakdown.map((member) => {
                              const remainingDue = Math.max(0, Number(member.shareDue) - Number(member.paid_amount || 0));
                              const isReceiverMember = member.id === expense.payment_receiver_id;
                              return (
                                <div key={member.id} className="flex justify-between items-center bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 text-xs">
                                  <div>
                                    <span className="font-medium text-zinc-200 block">
                                      {member.username} {isReceiverMember ? <span className="text-amber-500 text-[10px] ml-1">(Receiver)</span> : ""}
                                    </span>
                                    {Number(member.paid_amount || 0) > 0 && (
                                      <span className="text-[10px] text-zinc-400 block mt-0.5">Paid: ₱{Number(member.paid_amount).toFixed(2)}</span>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-amber-400 block">
                                      ₱{member.status === 'paid' || member.isPaid || remainingDue === 0 ? '0.00' : remainingDue.toFixed(2)}
                                    </span>
                                    <span className={`text-[10px] font-semibold uppercase tracking-tight block mt-0.5 ${
                                      member.status === 'paid' || member.isPaid || remainingDue === 0 ? 'text-emerald-400' :
                                      member.status === 'pending_approval' ? 'text-amber-400' :
                                      'text-zinc-500'
                                    }`}>
                                      {member.isPaid || remainingDue === 0 ? 'paid' : (member.status || 'unpaid')}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
            <span className="text-sm sm:text-base font-semibold text-zinc-300">Total Outstanding Due:</span>
            <span className="text-xl sm:text-2xl font-bold text-amber-500">₱{totalDue.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Settle Bill Modal */}
      {settlingExpense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-[#18181b] p-6 rounded-xl border border-zinc-800 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 text-zinc-100 shadow-2xl">
            <h3 className="text-lg font-semibold text-white border-b border-zinc-800 pb-3">Settle Bill Payment</h3>
            <p className="text-xs text-zinc-400">Choose how you handled the final payment for <span className="text-white font-semibold">{settlingExpense.description}</span>. This will fully clear all participant dues and update records.</p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Settlement Method</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setSettleMethod('cash');
                    setSettleReceiptFile(null);
                  }}
                  className={`flex-1 ${settleMethod === 'cash' ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold' : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
                >
                  Cash Settlement
                </Button>
                <Button
                  type="button"
                  onClick={() => setSettleMethod('online')}
                  className={`flex-1 ${settleMethod === 'online' ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold' : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
                >
                  Online Settlement (QR)
                </Button>
              </div>
            </div>

            {settleMethod === 'online' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 flex justify-between">
                  <span>Upload Receipt Screenshot / Proof</span>
                  <span className="text-amber-400 text-[10px] font-semibold">*Mandatory</span>
                </label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSettleReceiptFile(e.target.files[0]);
                    }
                  }}
                  className="bg-zinc-900 border-zinc-700 text-xs text-zinc-400 file:bg-amber-500 file:text-zinc-950 file:font-semibold file:border-0 file:rounded-md cursor-pointer h-10"
                />
              </div>
            )}

            <div className="flex gap-3 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                disabled={settlingSubmitting}
                onClick={handleSettleExpenseAsReceiver}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold"
              >
                {settlingSubmitting ? "Processing..." : "Confirm Settlement"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setSettlingExpense(null);
                  setSettleReceiptFile(null);
                }}
                variant="outline"
                className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-[#18181b] p-6 rounded-xl border border-zinc-800 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 text-zinc-100 shadow-2xl">
            <h3 className="text-lg font-semibold text-white border-b border-zinc-800 pb-3">Edit Expense Form</h3>
            <ExpenseForm 
              initialData={editingExpense} 
              onSuccess={() => { setEditingExpense(null); fetchData(); }} 
              onCancel={() => setEditingExpense(null)} 
            />
          </div>
        </div>
      )}

      {/* Pay Share Modal */}
      {selectedExpenseForPay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-[#18181b] p-6 rounded-xl border border-zinc-800 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 text-zinc-100 shadow-2xl">
            <h3 className="text-lg font-semibold text-white border-b border-zinc-800 pb-3">Submit Payment & Receipt</h3>
            
            <div className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 text-center space-y-2">
              <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Payment Receiver</span>
              <p className="font-bold text-amber-400 text-base">{receiverProfile?.username || receiverProfile?.full_name || "Assigned Receiver"}</p>
              
              {receiverProfile?.qr_code_url ? (
                <img src={receiverProfile.qr_code_url} alt="Receiver QR Code" className="w-32 h-32 mx-auto rounded-lg border border-amber-500/40 object-contain bg-white p-1.5" />
              ) : (
                <div className="w-32 h-32 mx-auto bg-zinc-950 flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 text-zinc-500">
                  <QrCode className="h-8 w-8 text-amber-500 mb-1" />
                  <span className="text-[10px]">No QR Available</span>
                </div>
              )}
            </div>

            <div>
              <span className="text-xs text-zinc-400">Remaining Share Due to Pay:</span>
              <p className="text-lg font-bold text-white">₱{Number(paymentAmount).toFixed(2)}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Payment Method</label>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  onClick={() => setPaymentMethod('online')} 
                  className={`flex-1 ${paymentMethod === 'online' ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold' : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
                >
                  Online Transaction
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    setPaymentMethod('cash');
                    setReceiptFile(null);
                  }} 
                  className={`flex-1 ${paymentMethod === 'cash' ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold' : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
                >
                  Cash
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Amount to Pay</label>
              <Input 
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white focus-visible:ring-amber-500"
              />
            </div>

            {paymentMethod === 'online' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 flex justify-between">
                  <span>Upload Receipt Proof</span>
                  <span className="text-amber-400 text-[10px] font-semibold">*Mandatory for Online validation</span>
                </label>
                <Input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="bg-zinc-900 border-zinc-700 text-xs text-zinc-400 file:bg-amber-500 file:text-zinc-950 file:font-semibold file:border-0 file:rounded-md cursor-pointer h-10"
                />
              </div>
            )}

            <div className="flex gap-3 pt-3 border-t border-zinc-800">
              <Button 
                onClick={submitPaymentRequest} 
                disabled={submitting} 
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold"
              >
                {submitting ? "Submitting..." : "Submit Payment"}
              </Button>
              <Button 
                onClick={() => {
                  setSelectedExpenseForPay(null);
                  setReceiptFile(null);
                }} 
                variant="outline" 
                className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
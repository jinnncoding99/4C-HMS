'use client';

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import BillForm from "../billing/BillForm";
import { createClient } from "@/lib/supabase/client";
import { QrCode, ChevronDown, ChevronUp, Edit, Trash2, PlusCircle, CheckCircle } from "lucide-react";

interface Profile {
  id: string;
  username: string;
  role: string;
  qr_code_url?: string | null;
  email?: string;
}

interface BillShare {
  id: string;
  username: string;
  role: string;
  daysPresent: number;
  shareDue: number;
  isPaid?: boolean;
  status?: string;
  paid_amount?: number;
}

interface Bill {
  id: string;
  description: string;
  total_amount: number;
  total_members: number;
  share_due: number;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  calculation_type?: string;
  payment_receiver_id?: string;
  is_paid?: boolean;
  status?: string;
  created_at?: string;
  url_receipt?: string | null;
  payment_receiver?: string | null;
}

interface PaymentRequestDetail {
  bill_id: string;
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

export default function BillingSummary({ userId }: { userId?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billSharesMap, setBillSharesMap] = useState<{ [key: string]: BillShare[] }>({});
  const [userRole, setUserRole] = useState<string>("User");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userPaymentRequests, setUserPaymentRequests] = useState<NotificationItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [expandedBills, setExpandedBills] = useState<{ [key: string]: boolean }>({});
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  const [selectedBillForPay, setSelectedBillForPay] = useState<Bill | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('online');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [receiverProfile, setReceiverProfile] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // State for Receiver Final Settlement Modal
  const [settlingBill, setSettlingBill] = useState<Bill | null>(null);
  const [settleMethod, setSettleMethod] = useState<'cash' | 'online'>('cash');
  const [settleReceiptFile, setSettleReceiptFile] = useState<File | null>(null);
  const [settlingSubmitting, setSettlingSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    setIsMounted(true);
    fetchData();

    const handleBillingUpdate = () => {
      fetchData();
    };

    window.addEventListener('billing-updated', handleBillingUpdate);

    const channel = supabase
      .channel('billing-realtime-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bill_shares' },
        () => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        () => { fetchData(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => { fetchData(); }
      )
      .subscribe();

    return () => {
      window.removeEventListener('billing-updated', handleBillingUpdate);
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
      .select('id, username, role, qr_code_url, email');
    setProfiles(profilesData || []);

    const { data: billsData, error: billsError } = await supabase
      .from("bills")
      .select("*")
      .order("created_at", { ascending: true });

    if (!billsError && billsData) {
      const { data: sharesData } = await supabase
        .from("bill_shares")
        .select("*")
        .in("bill_id", billsData.map(b => b.id).filter(Boolean));

      const { data: allProfiles } = await supabase.from("profiles").select("id, username, role, email");
      const profileMap = new Map(allProfiles?.map(p => [p.id, p]) || []);
      const billMap = new Map(billsData.map(b => [b.id, b]));

      let vacationsData: any[] = [];
      try {
        const { data } = await supabase
          .from("vacation_history")
          .select("*")
          .eq("status", "approved");
        if (data) vacationsData = data;
      } catch {
        vacationsData = [];
      }

      if (sharesData) {
        const map: { [key: string]: BillShare[] } = {};
        const userConsumedVacations: { [userId: string]: { [vacationId: string]: number } } = {};

        for (const bill of billsData) {
          const billShares = sharesData.filter((s: any) => s.bill_id === bill.id);
          const parentBill: any = billMap.get(bill.id);

          let cycleTotalDays = 30;
          let cycleStart: Date | null = null;
          let cycleEnd: Date | null = null;

          if (parentBill?.billing_period_start && parentBill?.billing_period_end) {
            cycleStart = new Date(parentBill.billing_period_start);
            cycleEnd = new Date(parentBill.billing_period_end);
            const diffTime = Math.abs(cycleEnd.getTime() - cycleStart.getTime());
            cycleTotalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }

          const calcType = (parentBill?.calculation_type || 'prorated').toLowerCase();
          const totalAmount = Number(parentBill?.total_amount || 0);
          const receiverId = parentBill?.payment_receiver_id;

          let userWeights: { [id: string]: number } = {};
          let totalWeightSum = 0;

          billShares.forEach((share: any) => {
            const memberId = share.boarder_id || share.user_id;
            if (!memberId) return;

            if (!userConsumedVacations[memberId]) {
              userConsumedVacations[memberId] = {};
            }

            let rawDays = cycleTotalDays;

            if (vacationsData && cycleStart && cycleEnd) {
              const memberProf: any = profileMap.get(memberId);
              const memberEmail = memberProf?.email || share.user_email;

              const memberVacations = vacationsData.filter((v: any) => 
                (v.user_id === memberId || (memberEmail && v.user_email === memberEmail)) &&
                v.status === 'approved'
              );

              let billDeductedVacationDays = 0;

              for (const vacation of memberVacations) {
                if (!vacation.start_date || !vacation.end_date) continue;
                const vacStart = new Date(vacation.start_date);
                const vacEnd = new Date(vacation.end_date);
                
                const totalVacationDays = Math.ceil(Math.abs(vacEnd.getTime() - vacStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                const alreadyConsumed = userConsumedVacations[memberId][vacation.id] || 0;
                const remainingVacationDays = Math.max(0, totalVacationDays - alreadyConsumed);

                if (remainingVacationDays <= 0) continue;

                const overlapStart = vacStart > cycleStart ? vacStart : cycleStart;
                const overlapEnd = vacEnd < cycleEnd ? vacEnd : cycleEnd;

                if (overlapStart <= overlapEnd) {
                  const overlapDays = Math.ceil(Math.abs(overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  const daysToApplyInThisBill = Math.min(remainingVacationDays, overlapDays);

                  billDeductedVacationDays += daysToApplyInThisBill;
                  userConsumedVacations[memberId][vacation.id] = alreadyConsumed + daysToApplyInThisBill;
                }
              }

              rawDays = Math.max(0, cycleTotalDays - billDeductedVacationDays);
            }

            userWeights[memberId] = rawDays;
            totalWeightSum += rawDays;
          });

          const preliminaryShares: { memberId: string; shareAmount: number; finalDays: number; shareObj: any }[] = [];
          
          billShares.forEach((share: any) => {
            const memberId = share.boarder_id || share.user_id;
            if (!memberId) return;
            const finalDays = userWeights[memberId] ?? cycleTotalDays;
            let shareAmount = Number(share.shared_amount ?? share.share_due ?? 0);

            if (share.shared_amount === null || share.shared_amount === undefined || share.shared_amount === 0) {
              if (calcType === 'prorated' && totalWeightSum > 0) {
                shareAmount = (finalDays / totalWeightSum) * totalAmount;
              } else if (calcType === 'equal' && billShares.length > 0) {
                shareAmount = totalAmount / billShares.length;
              }
            }

            preliminaryShares.push({ memberId, shareAmount, finalDays, shareObj: share });
          });

          let sumOfOthersBaseShares = 0;
          let sumOfOthersPaidOrSettled = 0;

          preliminaryShares.forEach(item => {
            if (item.memberId !== receiverId) {
              sumOfOthersBaseShares += Number(item.shareAmount.toFixed(2));
              const isPaid = Boolean(item.shareObj.is_paid || item.shareObj.isPaid || item.shareObj.status === 'paid');
              if (isPaid) {
                sumOfOthersPaidOrSettled += Number(item.shareAmount.toFixed(2));
              }
            }
          });

          const tempShares: BillShare[] = [];

          preliminaryShares.forEach(item => {
            const memberId = item.memberId;
            const prof: any = profileMap.get(memberId);
            const isSharePaid = Boolean(item.shareObj.is_paid ?? item.shareObj.isPaid ?? (item.shareObj.status === 'paid'));
            const shareStatus = item.shareObj.status || (isSharePaid ? 'paid' : 'unpaid');
            
            let finalShareAmount = item.shareAmount;

            if (memberId === receiverId && receiverId) {
              const receiverBaseShare = Math.max(0, totalAmount - sumOfOthersBaseShares);
              finalShareAmount = Number((receiverBaseShare + sumOfOthersPaidOrSettled).toFixed(2));
            } else {
              finalShareAmount = Number(item.shareAmount.toFixed(2));
            }

            tempShares.push({
              id: memberId,
              username: prof?.username || 'Unknown Member',
              role: prof?.role || 'User',
              daysPresent: item.finalDays,
              shareDue: finalShareAmount,
              isPaid: isSharePaid,
              status: shareStatus,
              paid_amount: Number(item.shareObj.paid_amount || 0)
            });
          });

          map[bill.id] = tempShares;
        }
        setBillSharesMap(map);
      }

      setBills(billsData.reverse());
    }

    const { data: notifsData } = await supabase
      .from("notifications")
      .select("*")
      .eq("type", "payment_approval");
      
    setUserPaymentRequests(notifsData || []);
  };

  const deleteBill = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bill?")) return;
    await supabase.from("bill_shares").delete().eq("bill_id", id);
    await supabase.from("bills").delete().eq("id", id);
    fetchData();
  };

  const toggleExpand = (id: string) => {
    setExpandedBills(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenPayModal = async (bill: Bill, calculatedShare: number) => {
    setSelectedBillForPay(bill);
    setPaymentAmount(calculatedShare.toFixed(2));
    setReceiptFile(null);
    
    if (bill?.payment_receiver_id) {
      const { data: receiver } = await supabase
        .from('profiles')
        .select('username, qr_code_url, id, role')
        .eq('id', bill.payment_receiver_id)
        .maybeSingle();
      setReceiverProfile(receiver || { id: '', username: 'Payment Receiver', qr_code_url: null, role: 'User' });
    } else {
      setReceiverProfile({ id: '', username: 'Payment Receiver', qr_code_url: null, role: 'User' });
    }
  };

  const submitPaymentRequest = async () => {
    if (!selectedBillForPay) return;

    if (paymentMethod === 'online') {
      if (!receiptFile) {
        alert("Please upload a receipt screenshot for online payments.");
        return;
      }
      if (!receiptFile.type.startsWith('image/')) {
        alert("Invalid file type. Please upload a valid image file (PNG, JPG, JPEG) for the receipt.");
        return;
      }
      if (receiptFile.size > 5 * 1024 * 1024) {
        alert("File size is too large. Please upload an image smaller than 5MB.");
        return;
      }
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentAuthId = user?.id || activeUserId;
      let receiptUrl: string | null = null;

      if (paymentMethod === 'online' && receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile);

        if (uploadError) throw uploadError;

        const { data: publicURLData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);
        receiptUrl = publicURLData.publicUrl;
      }

      const notificationPayload = {
        type: 'payment_approval',
        email: user?.email || 'User',
        message: `Payment submitted for bill: ${selectedBillForPay.description} via ${paymentMethod.toUpperCase()} amount: ₱${Number(paymentAmount).toFixed(2)}`,
        status: 'pending',
        details: {
          bill_id: selectedBillForPay.id,
          user_id: currentAuthId || '',
          receiver_id: selectedBillForPay.payment_receiver_id || null,
          amount: paymentAmount,
          method: paymentMethod,
          receipt_url: receiptUrl
        }
      };

      const { error: notifError } = await supabase.from('notifications').insert([notificationPayload]);
      if (notifError) throw notifError;

      await supabase
        .from('bill_shares')
        .update({ 
          status: 'pending_approval',
          payment_method: paymentMethod,
          paid_amount: Number(paymentAmount),
          receipt_url: receiptUrl
        })
        .eq('bill_id', selectedBillForPay.id)
        .eq('boarder_id', currentAuthId);

      alert("Payment request successfully submitted for approval!");
      setSelectedBillForPay(null);
      setReceiptFile(null);
      await fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error submitting payment:", errorMessage);
      alert("Failed to submit payment request: " + errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettleBillAsReceiver = async () => {
    if (!settlingBill) return;

    if (settleMethod === 'online') {
      if (!settleReceiptFile) {
        alert("Please upload a receipt screenshot for online utility settlement.");
        return;
      }
      if (!settleReceiptFile.type.startsWith('image/')) {
        alert("Invalid file type. Please upload a valid image file (PNG, JPG, JPEG) for the settlement receipt.");
        return;
      }
      if (settleReceiptFile.size > 5 * 1024 * 1024) {
        alert("File size is too large. Please upload an image smaller than 5MB.");
        return;
      }
    }

    setSettlingSubmitting(true);

    try {
      let receiptUrl: string | null = null;

      if (settleMethod === 'online' && settleReceiptFile) {
        const fileExt = settleReceiptFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `receipts/settlements_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, settleReceiptFile);

        if (uploadError) throw uploadError;

        const { data: publicURLData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);
        receiptUrl = publicURLData.publicUrl;
      }

      const receiverProf = profiles.find(p => p.id === settlingBill.payment_receiver_id);
      const receiverName = receiverProf?.username || 'Payment Receiver';

      const { error: historyError } = await supabase
        .from('transaction_history')
        .insert({
          original_bill_id: settlingBill.id,
          description: settlingBill.description,
          total_amount: settlingBill.total_amount,
          billing_period_start: settlingBill.billing_period_start,
          billing_period_end: settlingBill.billing_period_end,
          calculation_type: settlingBill.calculation_type,
          payment_receiver: receiverName,
          payment_receiver_id: settlingBill.payment_receiver_id,
          url_receipt: receiptUrl,
          settled_at: new Date().toISOString()
        });

      if (historyError) throw historyError;

      await supabase.from('bill_shares').delete().eq('bill_id', settlingBill.id);
      await supabase.from('bills').delete().eq('id', settlingBill.id);

      alert("Bill successfully marked as settled and recorded into history!");
      setSettlingBill(null);
      setSettleReceiptFile(null);
      await fetchData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error settling bill:", errorMessage);
      alert("Failed to settle bill: " + errorMessage);
    } finally {
      setSettlingSubmitting(false);
    }
  };

  const isAdmin = userRole.toLowerCase() === 'admin';
  const activeUserId = currentUserId || userId || (profiles.length > 0 ? profiles[0]?.id : null);

  const currentProfile = profiles.find(p => p.id === activeUserId);
  const isDanz = currentProfile?.username?.toLowerCase() === 'danz';

  const displayBills = bills.filter(bill => {
    const breakdown = billSharesMap[bill.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every(b => b.isPaid || b.status === 'paid');
    const isBillPaid = bill.is_paid || bill.status === 'paid' || allSharesPaid;
    return !isBillPaid;
  });

  const totalDue = bills.reduce((acc, bill) => {
    const breakdown = billSharesMap[bill.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every(b => b.isPaid || b.status === 'paid');
    if (bill.is_paid || bill.status === 'paid' || allSharesPaid) return acc;

    const myBreakdown = breakdown.find(item => item.id === activeUserId);
    return acc + (myBreakdown && !myBreakdown.isPaid && myBreakdown.status !== 'paid' ? Number(myBreakdown.shareDue) || 0 : 0);
  }, 0);

  if (!isMounted) return null;

  return (
    <div className="w-full space-y-4">
      <Card className="w-full bg-[#1a1a1a] border border-[#ff8c00] text-white">
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">Monthly Billing</h3>
              <p className="text-sm text-gray-400">Track and manage utility bills with manual settlement clearance.</p>
            </div>
            
            {isAdmin && (
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <span className="inline-flex items-center justify-center bg-[#ff8c00] hover:bg-[#e67e00] text-black font-bold p-2 sm:px-4 sm:py-2 rounded-md cursor-pointer text-sm">
                    <span className="sm:hidden flex items-center justify-center">
                      <PlusCircle size={18} />
                    </span>
                    <span className="hidden sm:inline">Add New Bill</span>
                  </span>
                </DialogTrigger>
                <DialogContent className="bg-[#1a1a1a] border border-[#ff8c00] text-white w-[95%] max-w-2xl max-h-[85vh] overflow-y-auto p-6 pb-12 rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Post New Bill Entry</DialogTitle>
                  </DialogHeader>
                  <div className="mt-2 pb-6">
                    <BillForm 
                      onSuccess={() => { setIsOpen(false); fetchData(); }} 
                      onCancel={() => setIsOpen(false)} 
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="space-y-4">
            {displayBills.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No active bills found.</p>
            ) : (
              displayBills.map((bill) => {
                const isExpanded = !!expandedBills[bill.id];
                const breakdown = billSharesMap[bill.id] || [];
                
                const validDays = breakdown.map(b => Number(b.daysPresent)).filter(d => !isNaN(d) && d > 0);
                const totalDays = validDays.length > 0 ? Math.max(...validDays) : (Number(bill.total_members) > 0 ? 30 : 31);

                const myBreakdown = breakdown.find(b => b.id === activeUserId);
                const userShareDue = myBreakdown ? myBreakdown.shareDue : 0; 
                const isMySharePaid = myBreakdown?.isPaid || myBreakdown?.status === 'paid';

                const hasPendingSubmission = userPaymentRequests.some(req => 
                  req.details?.bill_id === bill.id && req.details?.user_id === activeUserId
                ) || myBreakdown?.status === 'pending_approval';

                const hasAnyActivity = breakdown.some(b => b.status === 'pending_approval' || b.status === 'paid' || b.isPaid) ||
                  userPaymentRequests.some(req => req.details?.bill_id === bill.id);

                const isPaymentReceiver = bill.payment_receiver_id === activeUserId;
                
                const nonReceiverShares = breakdown.filter(b => b.id !== bill.payment_receiver_id);
                const allOthersPaid = nonReceiverShares.length > 0 && nonReceiverShares.every(b => b.isPaid || b.status === 'paid');

                return (
                  <div key={bill.id} className="p-4 border border-[#333] rounded-lg bg-[#111111] space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg text-white">{bill.description}</p>
                          {allOthersPaid && (
                            <span className="text-[10px] bg-green-500/20 border border-green-500 text-green-400 font-semibold px-2 py-0.5 rounded-full">
                              All Shares Collected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          Billing Period: {bill.billing_period_start || 'N/A'} to {bill.billing_period_end || 'N/A'} ({totalDays} Days) • Type: <span className="capitalize">{bill.calculation_type || 'prorated'}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Total Bill Due</p>
                        <p className="font-bold text-xl text-[#ff8c00]">₱{Number(bill.total_amount).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-[#222]">
                      <div>
                        <p className="text-xs text-gray-400">Your Share Due:</p>
                        <p className="text-md font-bold text-white">
                          {myBreakdown ? (
                            isMySharePaid ? (
                              <span className="text-green-500 font-semibold">₱0.00 (Paid)</span>
                            ) : (
                              `₱${userShareDue.toFixed(2)}`
                            )
                          ) : (
                            <span className="text-gray-500 italic text-xs">Not included in this bill</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPaymentReceiver && allOthersPaid && (
                          <Button
                            onClick={() => {
                              setSettlingBill(bill);
                              setSettleMethod('cash');
                              setSettleReceiptFile(null);
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-9 px-4 cursor-pointer"
                          >
                            Mark as Settled
                          </Button>
                        )}

                        {myBreakdown && userShareDue > 0 && !isMySharePaid && !isDanz && !isPaymentReceiver && (
                          hasPendingSubmission ? (
                            <span className="text-xs text-yellow-500 font-semibold bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-md">
                              Pending Approval
                            </span>
                          ) : (
                            <Button 
                              onClick={() => handleOpenPayModal(bill, userShareDue)}
                              className="bg-[#ff8c00] hover:bg-[#e67e00] text-black font-bold text-xs h-9 px-4 cursor-pointer"
                            >
                              Pay Now
                            </Button>
                          )
                        )}

                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            {!hasAnyActivity && (
                              <>
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBill(bill);
                                  }} 
                                  className="text-blue-400 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-500/10"
                                  title="Edit Bill"
                                >
                                  <Edit size={16} />
                                  <span className="hidden sm:inline">Edit</span>
                                </Button>
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteBill(bill.id);
                                  }} 
                                  className="text-red-400 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-red-500/10"
                                  title="Delete Bill"
                                >
                                  <Trash2 size={16} />
                                  <span className="hidden sm:inline">Delete</span>
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button 
                        onClick={() => toggleExpand(bill.id)}
                        className="text-xs text-[#ff8c00] flex items-center gap-1 hover:underline font-semibold focus:outline-none cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? "Hide Member Breakdown & Days" : "See More Info (Member Shares & Prorated Days)"}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 p-3 bg-[#181818] rounded-md border border-[#333] space-y-2">
                          <p className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Member Share Breakdown ({breakdown.length} Participants)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {breakdown.map((member) => (
                              <div key={member.id} className="flex justify-between items-center bg-[#111] p-2 rounded border border-[#222] text-xs">
                                <div>
                                  <p className="font-semibold text-white">
                                    {member.username} {member.id === bill.payment_receiver_id ? "(Receiver)" : ""}
                                  </p>
                                  <p className="text-[10px] text-gray-400">Present in House: {member.daysPresent} / {totalDays} days</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-[#ff8c00]">
                                    ₱{member.status === 'paid' || member.isPaid 
                                      ? '0.00' 
                                      : (Math.max(0, Number(member.shareDue) - Number(member.paid_amount || 0))).toFixed(2)}
                                  </p>
                                  <span className={`text-[10px] font-semibold uppercase block ${
                                    member.status === 'paid' || member.isPaid ? 'text-green-500' :
                                    member.status === 'pending_approval' ? 'text-yellow-500' :
                                    'text-gray-400'
                                  }`}>
                                    {member.isPaid ? 'paid' : (member.status || 'unpaid')}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 border-t border-[#ff8c00] flex justify-between items-center">
            <span className="text-lg font-bold">Total Outstanding Due:</span>
            <span className="text-2xl font-bold text-[#ff8c00]">₱{totalDue.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Receiver Settling Modal */}
      {settlingBill && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 text-white shadow-2xl pb-12">
            <h3 className="text-lg font-bold">Settle Bill Payment</h3>
            <p className="text-xs text-gray-400">Choose how you handled the final payment for <span className="text-white font-semibold">{settlingBill.description}</span>.</p>

            <div className="space-y-2">
              <label className="text-xs text-gray-400">Settlement Method</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSettleMethod('cash');
                    setSettleReceiptFile(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    settleMethod === 'cash'
                      ? 'bg-[#ff8c00] text-black border-[#ff8c00]'
                      : 'bg-[#111] text-white border-[#333] hover:border-[#ff8c00]'
                  }`}
                >
                  Cash Settlement
                </button>
                <button
                  type="button"
                  onClick={() => setSettleMethod('online')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    settleMethod === 'online'
                      ? 'bg-[#ff8c00] text-black border-[#ff8c00]'
                      : 'bg-[#111] text-white border-[#333] hover:border-[#ff8c00]'
                  }`}
                >
                  Online Settlement (QR)
                </button>
              </div>
            </div>

            {settleMethod === 'online' && (
              <div className="space-y-2">
                <label className="text-xs text-gray-400">
                  Upload Receipt Screenshot / Proof <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSettleReceiptFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#ff8c00] file:text-black hover:file:bg-[#e67e00] file:cursor-pointer bg-[#111] border border-[#333] rounded-lg p-2 cursor-pointer"
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                onClick={() => {
                  setSettlingBill(null);
                  setSettleReceiptFile(null);
                }}
                variant="ghost"
                className="flex-1 bg-[#222] hover:bg-[#333] text-white font-bold text-xs h-10 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={settlingSubmitting}
                onClick={handleSettleBillAsReceiver}
                className="flex-1 bg-[#ff8c00] hover:bg-[#e67e00] text-black font-bold text-xs h-10 cursor-pointer"
              >
                {settlingSubmitting ? "Processing..." : "Confirm Settlement"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editingBill && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4 text-white shadow-2xl pb-12">
            <h3 className="text-lg font-bold">Edit Bill Entry</h3>
            <BillForm 
              initialData={editingBill} 
              onSuccess={() => { setEditingBill(null); fetchData(); }} 
              onCancel={() => setEditingBill(null)} 
            />
          </div>
        </div>
      )}

      {selectedBillForPay && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 text-white shadow-2xl pb-12">
            <h3 className="text-lg font-bold">Submit Payment</h3>
            
            <div className="bg-[#111] p-3 rounded-xl border border-[#333] text-center space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Payment Receiver</p>
              <p className="font-bold text-[#ff8c00] text-base">{receiverProfile?.username}</p>
              
              {receiverProfile?.qr_code_url ? (
                <img src={receiverProfile.qr_code_url} alt="QR Code" className="w-32 h-32 mx-auto rounded-lg border border-[#ff8c00]" />
              ) : (
                <div className="w-32 h-32 mx-auto bg-[#222] flex flex-col items-center justify-center rounded-lg border border-dashed border-[#555] text-gray-500">
                  <QrCode size={36} className="text-[#ff8c00] mb-1" />
                  <span className="text-[10px]">No QR Uploaded</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400">Your Share Due Amount:</p>
              <p className="text-xl font-bold text-white">₱{Number(paymentAmount).toFixed(2)}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400">Payment Method</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('online')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    paymentMethod === 'online'
                      ? 'bg-[#ff8c00] text-black border-[#ff8c00]'
                      : 'bg-[#111] text-white border-[#333] hover:border-[#ff8c00]'
                  }`}
                >
                  Online Payment (QR)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('cash');
                    setReceiptFile(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-[#ff8c00] text-black border-[#ff8c00]'
                      : 'bg-[#111] text-white border-[#333] hover:border-[#ff8c00]'
                  }`}
                >
                  Cash Payment
                </button>
              </div>
            </div>

            {paymentMethod === 'online' && (
              <div className="space-y-2">
                <label className="text-xs text-gray-400">
                  Upload Receipt Screenshot <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setReceiptFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#ff8c00] file:text-black hover:file:bg-[#e67e00] file:cursor-pointer bg-[#111] border border-[#333] rounded-lg p-2 cursor-pointer"
                />
                <p className="text-[10px] text-gray-500">
                  Please provide proof of payment via QR transfer to complete verification.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                onClick={() => {
                  setSelectedBillForPay(null);
                  setReceiptFile(null);
                }}
                variant="ghost"
                className="flex-1 bg-[#222] hover:bg-[#333] text-white font-bold text-xs h-10 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={submitPaymentRequest}
                className="flex-1 bg-[#ff8c00] hover:bg-[#e67e00] text-black font-bold text-xs h-10 cursor-pointer"
              >
                {submitting ? "Submitting..." : "Submit Payment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
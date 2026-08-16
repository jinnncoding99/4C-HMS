// components/billing/BillSummary.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileText, Clock, Wallet, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

import { UnifiedDashboardCard } from '@/components/dashboard/UnifiedDashboardCard';
import { AddBillDialog, EditBillModal } from './BillModals';
import PaymentModal from '@/components/dashboard/PaymentModal';

export const BillSummary = ({
  userRole,
  currentUserId,
  userId,
  profiles,
  bills,
  billSharesMap,
  userPaymentRequests,
  isMounted,
  fetchData,
  deleteBill,
}: {
  userRole?: string;
  currentUserId?: string;
  userId?: string;
  profiles: any[];
  bills: any[];
  billSharesMap: Record<string, any[]>;
  userPaymentRequests: any[];
  isMounted: boolean;
  fetchData: () => void;
  deleteBill: (id: string) => void;
}) => {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedBills, setExpandedBills] = useState<Record<string, boolean>>({});

  // Payment Modal States
  const [selectedBillForPay, setSelectedBillForPay] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isDirectSettlement, setIsDirectSettlement] = useState<boolean>(false);

  const [editingBill, setEditingBill] = useState<any>(null);

  const isAdmin = userRole?.toLowerCase() === 'admin';
  const activeUserId = currentUserId || userId || (profiles.length > 0 ? profiles[0]?.id : null);
  const currentProfile = profiles.find((p: any) => p.id === activeUserId);
  const isDanz = currentProfile?.username?.toLowerCase() === 'danz';
  
  // Find receiver profile for the selected bill (with admin fallback)
  const receiverProfile = profiles.find((p: any) => p.id === selectedBillForPay?.payment_receiver_id) ||
                        profiles.find((p: any) => p.role?.toLowerCase() === 'admin') ||
                        null;

  const toggleExpand = (id: string) => {
    setExpandedBills((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Standard member share payment flow (Requires approval)
  const handleOpenPayModal = (bill: any, amount: number) => {
    setSelectedBillForPay(bill);
    setPaymentAmount(amount);
    setIsDirectSettlement(false);
  };

  // Direct settlement bill flow (Bypasses approval, instant clearance)
  const handleOpenSettleModal = (bill: any, amount: number) => {
    setSelectedBillForPay(bill);
    setPaymentAmount(amount);
    setIsDirectSettlement(true);
  };

  // Handler to mark an entire bill as settled from the breakdown view
  const handleMarkAsSettled = async (billId: string) => {
    try {
      const { error } = await supabase
        .from('bills')
        .update({ status: 'settled', is_paid: true })
        .eq('id', billId);

      if (error) {
        console.error('Error marking bill as settled:', error);
        return;
      }

      window.dispatchEvent(new Event('billing-updated'));
      if (fetchData) fetchData();
    } catch (err) {
      console.error('Unexpected error marking bill as settled:', err);
    }
  };

  const hasBills = Array.isArray(bills) && bills.length > 0;

  const displayBills = (!hasBills ? [] : bills).filter((bill: any) => {
    const breakdown = billSharesMap[bill.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.status === 'paid');
    const isBillPaid = bill.is_paid || bill.status === 'paid' || allSharesPaid;
    return !isBillPaid;
  });

  // If there are no active display bills, reset collections and metrics to 0
  const hasActiveBills = displayBills.length > 0;

  const activeBillsCount = displayBills.length;

  const totalPendingCollection = !hasActiveBills ? 0 : displayBills.reduce((acc, bill) => {
    const breakdown = billSharesMap[bill.id] || [];
    const totalAmount = Number(bill.total_amount || bill.amount || 0);
    const collected = breakdown.reduce((sum: number, b: any) => sum + (b.status === 'paid' ? Number(b.paid_amount || b.shared_amount || 0) : 0), 0);
    return acc + Math.max(0, totalAmount - collected);
  }, 0);

  const totalCollected = !hasActiveBills ? 0 : bills.reduce((acc, bill) => {
    const breakdown = billSharesMap[bill.id] || [];
    const collected = breakdown.reduce((sum: number, b: any) => sum + (b.status === 'paid' ? Number(b.paid_amount || b.shared_amount || 0) : 0), 0);
    return acc + collected;
  }, 0);

  const totalDue = !hasActiveBills ? 0 : bills.reduce((acc: number, bill: any) => {
    const breakdown = billSharesMap[bill.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.status === 'paid');
    if (bill.is_paid || bill.status === 'paid' || allSharesPaid) return acc;

    const myBreakdown = breakdown.find((item: any) => item.id === activeUserId || item.boarder_id === activeUserId);
    const isPaymentReceiver = bill.payment_receiver_id === activeUserId;
    
    if (!myBreakdown) return acc;

    const baseShare = Number(myBreakdown.shared_amount ?? myBreakdown.shareDue ?? 0);
    const myPaidAmount = Number(myBreakdown.paid_amount ?? 0);
    
    // FIXED: Receiver's individual share due should simply track their personal share minus what they've paid, 
    // without inflating their own share balance by adding other people's collected shares.
    const userShareDue = Math.max(0, baseShare - myPaidAmount);

    const isMySharePaid = myBreakdown.status === 'paid' || (isPaymentReceiver ? false : userShareDue <= 0);

    return acc + (!isMySharePaid ? userShareDue : 0);
  }, 0);

  if (!isMounted) return null;

  return (
    <div className="w-full space-y-6 text-slate-900 dark:text-zinc-100">
      <Card className="bg-white dark:bg-[#18181b] border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 shadow-xl overflow-hidden rounded-xl transition-colors">
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-zinc-800/80 pb-5">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#4B49AC] dark:text-amber-500" />
                Monthly Bills
              </h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                Track recurring monthly entries, validate partial or full payments, and automatically manage shared boarder balances.
              </p>
            </div>
            
            <div className="w-full sm:w-auto flex justify-end">
              {isAdmin && (
                <AddBillDialog 
                  isOpen={isOpen}
                  setIsOpen={setIsOpen}
                  profiles={profiles}
                  onSuccess={fetchData}
                />
              )}
            </div>
          </div>

          {/* Top Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-lg bg-[#4B49AC]/10 dark:bg-amber-500/10 text-[#4B49AC] dark:text-amber-500 shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium truncate">Active Bills</p>
                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{activeBillsCount}</p>
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-lg bg-[#4B49AC]/10 dark:bg-amber-500/10 text-[#4B49AC] dark:text-amber-400 shrink-0">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium truncate">Pending Collection</p>
                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">₱{totalPendingCollection.toFixed(2)}</p>
              </div>
            </div>

            <div className="col-span-2 lg:col-span-1 p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-green-400 shrink-0">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium truncate">Total Collected</p>
                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">₱{totalCollected.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {displayBills.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                <FileText className="h-10 w-10 text-slate-400 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">No active monthly bills found.</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">All shared monthly bills have been completely settled.</p>
              </div>
            ) : (
              displayBills.map((bill: any) => {
                const rawBreakdown = billSharesMap[bill.id] || [];
                const formattedBreakdown = rawBreakdown.map((b: any) => {
                  const targetUserId = b.boarder_id || b.user_id || b.id;
                  const matchedProfile = profiles.find((p: any) => p.id === targetUserId);
                  
                  const baseShare = Number(b.shared_amount ?? b.shareDue ?? 0);
                  const paidVal = Number(b.paid_amount ?? 0);

                  return {
                    ...b,
                    shareDue: baseShare,
                    paidAmount: paidVal,
                    isPaid: b.status === 'paid',
                    username: b.username || matchedProfile?.username || 'Unknown Member',
                    name: b.name || matchedProfile?.username || 'Unknown Member',
                  };
                });

                return (
                  <UnifiedDashboardCard
                    key={bill.id}
                    item={bill}
                    breakdown={formattedBreakdown}
                    activeUserId={activeUserId}
                    isAdmin={isAdmin}
                    isDanz={isDanz}
                    isExpanded={!!expandedBills[bill.id]}
                    onToggleExpand={toggleExpand}
                    onPayNow={(b, amt) => handleOpenPayModal(b, amt)}
                    onSettleItem={(b) => {
                      const myShare = formattedBreakdown.find((item: any) => item.boarder_id === activeUserId || item.id === activeUserId);
                      const baseShareAmt = Number(myShare?.shareDue || b.amount || 0);
                      const paidAmt = Number(myShare?.paidAmount || 0);
                      handleOpenSettleModal(b, Math.max(0, baseShareAmt - paidAmt));
                    }}
                    onEditItem={(b) => setEditingBill(b)}
                    onDeleteItem={deleteBill}
                    onMarkAsSettled={() => handleMarkAsSettled(bill.id)}
                    isBillSettled={bill.is_paid || bill.status === 'settled'}
                    userPaymentRequests={userPaymentRequests}
                    type="bill"
                  />
                );
              })
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
            <span className="text-sm sm:text-base font-semibold text-slate-600 dark:text-zinc-300">Total Outstanding Due:</span>
            <span className="text-xl sm:text-2xl font-bold text-[#4B49AC] dark:text-amber-500">₱{totalDue.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Re-integrated Payment Modal with isDirectSettlement mode */}
      {selectedBillForPay && (
        <PaymentModal
          bill={selectedBillForPay}
          shareDue={paymentAmount}
          receiverProfile={receiverProfile || null}
          isDirectSettlement={isDirectSettlement}
          onClose={() => setSelectedBillForPay(null)}
          onSuccess={() => {
            setSelectedBillForPay(null);
            if (fetchData) fetchData();
          }}
        />
      )}

      <EditBillModal
        editingBill={editingBill}
        onClose={() => setEditingBill(null)}
        onSuccess={fetchData}
      />
    </div>
  );
};
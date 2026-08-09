// components/billing/BillSummary.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileText } from 'lucide-react';

import { BillCard } from './BillCard';
import { AddBillDialog, EditBillModal, ReceiverSettleModal } from './BillModals';
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
  const [isOpen, setIsOpen] = useState(false);
  const [expandedBills, setExpandedBills] = useState<Record<string, boolean>>({});
  
  const [selectedBillForPay, setSelectedBillForPay] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const [editingBill, setEditingBill] = useState<any>(null);
  const [settlingBill, setSettlingBill] = useState<any>(null);
  const [settleMethod, setSettleMethod] = useState<'cash' | 'online'>('cash');
  const [settleReceiptFile, setSettleReceiptFile] = useState<File | null>(null);
  const [settlingSubmitting, setSettlingSubmitting] = useState(false);

  const isAdmin = userRole?.toLowerCase() === 'admin';
  const activeUserId = currentUserId || userId || (profiles.length > 0 ? profiles[0]?.id : null);
  const currentProfile = profiles.find((p: any) => p.id === activeUserId);
  const isDanz = currentProfile?.username?.toLowerCase() === 'danz';
  const receiverProfile = profiles.find((p: any) => p.id === selectedBillForPay?.payment_receiver_id);

  const toggleExpand = (id: string) => {
    setExpandedBills((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenPayModal = (bill: any, amount: number) => {
    setSelectedBillForPay(bill);
    setPaymentAmount(amount);
  };

  const handleReceiverSettleSubmit = async () => {
    setSettlingSubmitting(true);
    setTimeout(() => {
      setSettlingSubmitting(false);
      setSettlingBill(null);
      if (fetchData) fetchData();
    }, 500);
  };

  const displayBills = (bills || []).filter((bill: any) => {
    const breakdown = billSharesMap[bill.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.isPaid || b.status === 'paid');
    const isBillPaid = bill.is_paid || bill.status === 'paid' || allSharesPaid;
    return !isBillPaid;
  });

  const totalDue = (bills || []).reduce((acc: number, bill: any) => {
    const breakdown = billSharesMap[bill.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.isPaid || b.status === 'paid');
    if (bill.is_paid || bill.status === 'paid' || allSharesPaid) return acc;

    const myBreakdown = breakdown.find((item: any) => item.id === activeUserId);
    return acc + (myBreakdown && !myBreakdown.isPaid && myBreakdown.status !== 'paid' ? Number(myBreakdown.shareDue) || 0 : 0);
  }, 0);

  if (!isMounted) return null;

  return (
    <div className="w-full space-y-6 text-slate-900 dark:text-zinc-100">
      <Card className="bg-white dark:bg-[#18181b] border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 shadow-xl overflow-hidden rounded-xl transition-colors">
        <div className="p-6 space-y-6">
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
            
            {isAdmin && (
              <AddBillDialog 
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                onSuccess={fetchData}
              />
            )}
          </div>

          <div className="space-y-4">
            {displayBills.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                <FileText className="h-10 w-10 text-slate-400 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">No active monthly bills found.</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">All shared monthly bills have been completely settled.</p>
              </div>
            ) : (
              displayBills.map((bill: any) => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  breakdown={billSharesMap[bill.id] || []}
                  activeUserId={activeUserId}
                  isAdmin={isAdmin}
                  isDanz={isDanz}
                  isExpanded={!!expandedBills[bill.id]}
                  onToggleExpand={toggleExpand}
                  onPayNow={handleOpenPayModal}
                  onSettleBill={(b) => setSettlingBill(b)}
                  onEditBill={(b) => setEditingBill(b)}
                  onDeleteBill={deleteBill}
                  userPaymentRequests={userPaymentRequests}
                />
              ))
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
            <span className="text-sm sm:text-base font-semibold text-slate-600 dark:text-zinc-300">Total Outstanding Due:</span>
            <span className="text-xl sm:text-2xl font-bold text-[#4B49AC] dark:text-amber-500">₱{totalDue.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {selectedBillForPay && (
        <PaymentModal
          bill={selectedBillForPay}
          shareDue={paymentAmount}
          receiverProfile={receiverProfile || null}
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

      <ReceiverSettleModal
        settlingBill={settlingBill}
        settleMethod={settleMethod}
        setSettleMethod={setSettleMethod}
        setSettleReceiptFile={setSettleReceiptFile}
        settlingSubmitting={settlingSubmitting}
        onClose={() => setSettlingBill(null)}
        onSubmit={handleReceiverSettleSubmit}
      />
    </div>
  );
};
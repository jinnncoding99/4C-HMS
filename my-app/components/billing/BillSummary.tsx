// components/billing/BillSummary.tsx
// components/billing/BillSummary.tsx
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';

import { BillCard } from './BillCard';
import { AddBillDialog, EditBillModal } from './BillModals';

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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedBills, setExpandedBills] = useState<Record<string, boolean>>({});
  
  const [selectedBillForPay, setSelectedBillForPay] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    setPaymentMethod('online');
    setReceiptFile(null);
  };

  const submitPaymentRequest = async () => {
    // your submit logic here...
  };

  const handleReceiverSettleSubmit = async () => {
    // your receiver settlement submit logic here...
  };

  const displayBills = bills.filter((bill: any) => {
    const breakdown = billSharesMap[bill.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.isPaid || b.status === 'paid');
    const isBillPaid = bill.is_paid || bill.status === 'paid' || allSharesPaid;
    return !isBillPaid;
  });

  const totalDue = bills.reduce((acc: number, bill: any) => {
    const breakdown = billSharesMap[bill.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.isPaid || b.status === 'paid');
    if (bill.is_paid || bill.status === 'paid' || allSharesPaid) return acc;

    const myBreakdown = breakdown.find((item: any) => item.id === activeUserId);
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
              <AddBillDialog 
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                onSuccess={fetchData}
              />
            )}
          </div>

          <div className="space-y-4">
            {displayBills.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No active bills found.</p>
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

          <div className="pt-4 border-t border-[#ff8c00] flex justify-between items-center">
            <span className="text-lg font-bold">Total Outstanding Due:</span>
            <span className="text-2xl font-bold text-[#ff8c00]">₱{totalDue.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      <PayModal
        isOpen={!!selectedBillForPay}
        onClose={() => setSelectedBillForPay(null)}
        receiverProfile={receiverProfile}
        paymentAmount={paymentAmount}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        setReceiptFile={setReceiptFile}
        submitting={submitting}
        onSubmit={submitPaymentRequest}
      />

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
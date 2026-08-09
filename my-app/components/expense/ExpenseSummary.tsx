// components/expense/ExpenseSummary.tsx
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus } from "lucide-react";
import ExpenseForm from "./ExpenseForm";
import ExpenseCard from "./ExpenseCard";
import { SettleModal, EditExpenseModal, PayShareModal } from "./ExpenseModals";

interface ExpenseSummaryProps {
  userRole?: string;
  currentUserId?: string;
  userId?: string;
  profiles?: any[];
  profileMap?: Map<string, any>;
  expenses?: any[];
  expenseSharesMap?: Record<string, any[]>;
  userPaymentRequests?: any[];
  isMounted?: boolean;
  fetchData?: () => void;
  deleteExpense?: (id: string) => void;
}

export default function ExpenseSummary({
  userRole,
  currentUserId,
  userId,
  profiles = [],
  profileMap = new Map(),
  expenses = [],
  expenseSharesMap = {},
  userPaymentRequests = [],
  isMounted = true,
  fetchData = () => {},
  deleteExpense = () => {},
}: ExpenseSummaryProps) {
  // States
  const [isOpen, setIsOpen] = useState(false);
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({});
  
  // Modals state
  const [settlingExpense, setSettlingExpense] = useState<any | null>(null);
  const [settleMethod, setSettleMethod] = useState<'cash' | 'online'>('cash');
  const [settleReceiptFile, setSettleReceiptFile] = useState<File | null>(null);
  const [settlingSubmitting, setSettlingSubmitting] = useState(false);

  const [editingExpense, setEditingExpense] = useState<any | null>(null);

  const [selectedExpenseForPay, setSelectedExpenseForPay] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeUserId = currentUserId || userId || (profiles.length > 0 ? profiles[0]?.id : null);

  const toggleExpand = (id: string) => {
    setExpandedExpenses(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const displayExpenses = (expenses || []).filter(expense => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.isPaid || b.status === 'paid');
    const isExpensePaid = expense.is_paid || expense.status === 'paid' || allSharesPaid;
    return !isExpensePaid;
  });

  const totalDue = (expenses || []).reduce((acc, expense) => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.isPaid || b.status === 'paid');
    if (expense.is_paid || expense.status === 'paid' || allSharesPaid) return acc;

    const myBreakdown = breakdown.find((item: any) => item.id === activeUserId);
    if (expense.payment_receiver_id === activeUserId) return acc;

    const netDue = myBreakdown ? Math.max(0, Number(myBreakdown.shareDue) - Number(myBreakdown.paid_amount || 0)) : 0;
    return acc + (myBreakdown && !myBreakdown.isPaid && myBreakdown.status !== 'paid' ? netDue : 0);
  }, 0);

  const receiverProfile = selectedExpenseForPay?.payment_receiver_id 
    ? profileMap.get(selectedExpenseForPay.payment_receiver_id) 
    : null;

  const handleOpenPayModal = (expense: any, shareDue: number, paidAmount: number) => {
    setSelectedExpenseForPay(expense);
    setPaymentAmount(Math.max(0, shareDue - paidAmount).toString());
    setPaymentMethod('online');
    setReceiptFile(null);
  };

  const handleSettleExpenseAsReceiver = async () => {
    setSettlingSubmitting(true);
    setTimeout(() => {
      setSettlingSubmitting(false);
      setSettlingExpense(null);
      fetchData();
    }, 500);
  };

  const submitPaymentRequest = async () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSelectedExpenseForPay(null);
      fetchData();
    }, 500);
  };

  if (!isMounted) return null;

  return (
    <div className="w-full space-y-6">
      <Card className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xl overflow-hidden rounded-xl">
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-zinc-800/80 pb-5">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#4B49AC] dark:text-amber-500" />
                Expense Summary & Settlements
              </h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                Track shared miscellaneous entries, validate partial/full payments, and automatically credit receiver balances upon full collection.
              </p>
            </div>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#4B49AC] hover:bg-[#3f3de9] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-zinc-950 font-semibold transition-all shadow-sm rounded-full px-4 h-9">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">Create New Expense Entry</DialogTitle>
                </DialogHeader>
                <div className="py-2">
                  <ExpenseForm 
                    onSuccess={() => { setIsOpen(false); fetchData(); }} 
                    onCancel={() => setIsOpen(false)} 
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {displayExpenses.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                <FileText className="h-10 w-10 text-slate-400 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">No active expense entries found.</p>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">All shared entries have been completely settled.</p>
              </div>
            ) : (
              displayExpenses.map((expense) => {
                const isExpanded = !!expandedExpenses[expense.id];
                const breakdown = expenseSharesMap[expense.id] || [];
                
                const myBreakdown = breakdown.find((b: any) => b.id === activeUserId);
                const userShareDue = myBreakdown ? myBreakdown.shareDue : 0; 
                const userPaidAmount = myBreakdown ? Number(myBreakdown.paid_amount || 0) : 0;
                const netUserShareDue = Math.max(0, userShareDue - userPaidAmount);
                const isMySharePaid = myBreakdown?.isPaid || myBreakdown?.status === 'paid' || netUserShareDue === 0;

                const hasPendingSubmission = userPaymentRequests.some((req: any) => 
                  req.details?.expense_id === expense.id && req.details?.user_id === activeUserId
                ) || myBreakdown?.status === 'pending_approval';

                const hasAnyActivity = breakdown.some((b: any) => b.status === 'pending_approval' || b.status === 'paid' || b.isPaid) ||
                  userPaymentRequests.some((req: any) => req.details?.expense_id === expense.id);

                const allSharesArePaid = breakdown.length > 0 && breakdown.every((b: any) => b.isPaid || b.status === 'paid');
                const isReceiver = expense.payment_receiver_id === activeUserId;

                const receiverProfileObj = expense.payment_receiver_id ? profileMap.get(expense.payment_receiver_id) : null;
                const receiverName = receiverProfileObj?.username || receiverProfileObj?.full_name || 'N/A';

                return (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    breakdown={breakdown}
                    activeUserId={activeUserId}
                    isExpanded={isExpanded}
                    hasPendingSubmission={hasPendingSubmission}
                    hasAnyActivity={hasAnyActivity}
                    allSharesArePaid={allSharesArePaid}
                    isReceiver={isReceiver}
                    receiverName={receiverName}
                    myBreakdown={myBreakdown}
                    userShareDue={userShareDue}
                    userPaidAmount={userPaidAmount}
                    netUserShareDue={netUserShareDue}
                    isMySharePaid={isMySharePaid}
                    onToggleExpand={toggleExpand}
                    onOpenPayModal={handleOpenPayModal}
                    onOpenSettleModal={(exp) => {
                      setSettlingExpense(exp);
                      setSettleMethod('cash');
                      setSettleReceiptFile(null);
                    }}
                    onEdit={(exp) => setEditingExpense(exp)}
                    onDelete={deleteExpense}
                  />
                );
              })
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
            <span className="text-sm sm:text-base font-semibold text-slate-700 dark:text-zinc-300">Total Outstanding Due:</span>
            <span className="text-xl sm:text-2xl font-bold text-[#4B49AC] dark:text-amber-500">₱{totalDue.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      <SettleModal
        settlingExpense={settlingExpense}
        settleMethod={settleMethod}
        setSettleMethod={setSettleMethod}
        setSettleReceiptFile={setSettleReceiptFile}
        settlingSubmitting={settlingSubmitting}
        handleSettleExpenseAsReceiver={handleSettleExpenseAsReceiver}
        onClose={() => { setSettlingExpense(null); setSettleReceiptFile(null); }}
      />

      <EditExpenseModal
        editingExpense={editingExpense}
        onSuccess={() => { setEditingExpense(null); fetchData(); }}
        onCancel={() => setEditingExpense(null)}
      />

      <PayShareModal
        selectedExpenseForPay={selectedExpenseForPay}
        receiverProfile={receiverProfile}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        setReceiptFile={setReceiptFile}
        submitting={submitting}
        submitPaymentRequest={submitPaymentRequest}
        onClose={() => { setSelectedExpenseForPay(null); setReceiptFile(null); }}
      />
    </div>
  );
}
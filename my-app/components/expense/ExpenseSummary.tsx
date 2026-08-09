// components/expense/ExpenseSummary.tsx
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Clock, Wallet, CheckCircle2 } from "lucide-react";
import ExpenseForm from "./ExpenseForm";
import { UnifiedDashboardCard } from '@/components/dashboard/UnifiedDashboardCard';
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

  const isAdmin = userRole?.toLowerCase() === 'admin';
  const activeUserId = currentUserId || userId || (profiles.length > 0 ? profiles[0]?.id : null);
  const currentProfile = profiles.find((p: any) => p.id === activeUserId);
  const isDanz = currentProfile?.username?.toLowerCase() === 'danz';

  const toggleExpand = (id: string) => {
    setExpandedExpenses(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const displayExpenses = (expenses || []).filter(expense => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.isPaid || b.status === 'paid');
    const isExpensePaid = expense.is_paid || expense.status === 'paid' || allSharesPaid;
    return !isExpensePaid;
  });

  // Calculate metrics for Top Summary Cards
  const activeExpensesCount = displayExpenses.length;

  const totalPendingCollection = (expenses || []).reduce((acc, expense) => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.isPaid || b.status === 'paid');
    if (expense.is_paid || expense.status === 'paid' || allSharesPaid) return acc;
    const totalAmount = Number(expense.total_amount || expense.amount || 0);
    const collected = breakdown.reduce((sum: number, b: any) => sum + Number(b.paidAmount || b.paid_amount || (b.isPaid ? b.shareDue : 0)), 0);
    return acc + Math.max(0, totalAmount - collected);
  }, 0);

  const totalCollected = (expenses || []).reduce((acc, expense) => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const collected = breakdown.reduce((sum: number, b: any) => sum + Number(b.paidAmount || b.paid_amount || (b.isPaid ? b.shareDue : 0)), 0);
    return acc + collected;
  }, 0);

  const totalDue = (expenses || []).reduce((acc, expense) => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b: any) => b.isPaid || b.status === 'paid');
    if (expense.is_paid || expense.status === 'paid' || allSharesPaid) return acc;

    const myBreakdown = breakdown.find((item: any) => item.id === activeUserId || item.boarder_id === activeUserId);
    const isPaymentReceiver = expense.payment_receiver_id === activeUserId || expense.paid_by === activeUserId;
    
    if (!myBreakdown) return acc;

    const nonReceiverShares = breakdown.filter((b: any) => (b.id || b.boarder_id) !== (expense.payment_receiver_id || expense.paid_by));
    const totalCollectedFromOthers = nonReceiverShares.reduce((sum: number, b: any) => sum + Number(b.paidAmount || b.paid_amount || 0), 0);
    const receiverBaseShare = Number(myBreakdown.shareDue ?? myBreakdown.shared_amount ?? 0);

    const userShareDue = isPaymentReceiver 
      ? receiverBaseShare + totalCollectedFromOthers
      : Math.max(0, receiverBaseShare - Number(myBreakdown.paidAmount || myBreakdown.paid_amount || 0));

    const isMySharePaid = myBreakdown.isPaid || myBreakdown.is_paid || myBreakdown.status === 'paid';

    return acc + (!isMySharePaid ? userShareDue : 0);
  }, 0);

  const receiverProfile = selectedExpenseForPay?.payment_receiver_id 
    ? profileMap.get(selectedExpenseForPay.payment_receiver_id) 
    : null;

  const handleOpenPayModal = (expense: any, shareDue: number) => {
    setSelectedExpenseForPay(expense);
    setPaymentAmount(shareDue.toString());
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
        <div className="p-4 sm:p-6 space-y-6">
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

          {/* Top Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-lg bg-[#4B49AC]/10 dark:bg-amber-500/10 text-[#4B49AC] dark:text-amber-500 shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium truncate">Active Expenses</p>
                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{activeExpensesCount}</p>
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
            {displayExpenses.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                <FileText className="h-10 w-10 text-slate-400 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">No active expense entries found.</p>
                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">All shared entries have been completely settled.</p>
              </div>
            ) : (
              displayExpenses.map((expense) => (
                <UnifiedDashboardCard
                  key={expense.id}
                  item={expense}
                  breakdown={expenseSharesMap[expense.id] || []}
                  activeUserId={activeUserId}
                  isAdmin={isAdmin}
                  isDanz={isDanz}
                  isExpanded={!!expandedExpenses[expense.id]}
                  onToggleExpand={toggleExpand}
                  onPayNow={(exp, amt) => handleOpenPayModal(exp, amt)}
                  onSettleItem={(exp) => {
                    setSettlingExpense(exp);
                    setSettleMethod('cash');
                    setSettleReceiptFile(null);
                  }}
                  onEditItem={(exp) => setEditingExpense(exp)}
                  onDeleteItem={deleteExpense}
                  userPaymentRequests={userPaymentRequests}
                  type="expense"
                />
              ))
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
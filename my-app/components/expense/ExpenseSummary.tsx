// components/expense/ExpenseSummary.tsx
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { FileText, Clock, Wallet, CheckCircle2 } from 'lucide-react';

import { UnifiedDashboardCard } from '@/components/dashboard/UnifiedDashboardCard';
import { AddExpenseDialog, EditExpenseModal, ReceiverSettleExpenseModal } from './ExpenseModals';
import ExpensePaymentModal from '@/components/dashboard/ExpensePaymentModal';

interface Profile {
  id: string;
  username?: string;
  role?: string;
  [key: string]: any;
}

interface Expense {
  id: string;
  description: string;
  total_amount?: number;
  amount?: number;
  is_paid?: boolean;
  status?: string;
  payment_receiver_id?: string;
  [key: string]: any;
}

interface ExpenseShare {
  boarder_id?: string;
  user_id?: string;
  shareDue?: number;
  shared_amount?: number;
  paidAmount?: number;
  paid_amount?: number;
  isPaid?: boolean;
  is_paid?: boolean;
  status?: string;
  username?: string;
  name?: string;
  [key: string]: any;
}

interface ExpenseSummaryProps {
  userRole?: string;
  currentUserId?: string;
  userId?: string;
  profiles: Profile[];
  expenses: Expense[];
  expenseSharesMap: Record<string, ExpenseShare[]>;
  userPaymentRequests: any[];
  isMounted: boolean;
  fetchData: () => void;
  deleteExpense: (id: string) => void;
}

export default function ExpenseSummary({
  userRole,
  currentUserId,
  userId,
  profiles,
  expenses,
  expenseSharesMap,
  userPaymentRequests,
  isMounted,
  fetchData,
  deleteExpense,
}: ExpenseSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({});
  
  // Payment Modal States mapped for Expense workflow
  const [selectedExpenseForPay, setSelectedExpenseForPay] = useState<Expense | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isDirectSettlement, setIsDirectSettlement] = useState<boolean>(false);

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [settlingExpense, setSettlingExpense] = useState<Expense | null>(null);
  const [settleMethod, setSettleMethod] = useState<'cash' | 'online'>('cash');
  const [settleReceiptFile, setSettleReceiptFile] = useState<File | null>(null);
  const [settlingSubmitting, setSettlingSubmitting] = useState(false);

  const isAdmin = userRole?.toLowerCase() === 'admin';
  const activeUserId = currentUserId || userId || (profiles.length > 0 ? profiles[0]?.id : null);
  const currentProfile = profiles.find((p) => p.id === activeUserId);
  const isDanz = currentProfile?.username?.toLowerCase() === 'danz';
  
  // Find receiver profile for the selected expense (with admin fallback)
  const receiverProfile = profiles.find((p) => p.id === selectedExpenseForPay?.payment_receiver_id) ||
                        profiles.find((p) => p.role?.toLowerCase() === 'admin') ||
                        null;

  const toggleExpand = (id: string) => {
    setExpandedExpenses((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Standard member share payment flow (Requires approval)
  const handleOpenPayModal = (expense: Expense, amount: number) => {
    setSelectedExpenseForPay(expense);
    setPaymentAmount(amount);
    setIsDirectSettlement(false);
  };

  // Direct settlement expense flow (Bypasses approval, instant clearance)
  const handleOpenSettleModal = (expense: Expense, amount: number) => {
    setSelectedExpenseForPay(expense);
    setPaymentAmount(amount);
    setIsDirectSettlement(true);
  };

  const handleReceiverSettleSubmit = async () => {
    setSettlingSubmitting(true);
    setTimeout(() => {
      setSettlingSubmitting(false);
      setSettlingExpense(null);
      if (fetchData) fetchData();
    }, 500);
  };

  const hasExpenses = Array.isArray(expenses) && expenses.length > 0;

  const displayExpenses = (!hasExpenses ? [] : expenses).filter((expense) => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b) => b.isPaid || b.status === 'paid' || b.is_paid);
    const isExpensePaid = expense.is_paid || expense.status === 'paid' || allSharesPaid;
    return !isExpensePaid;
  });

  const hasActiveExpenses = displayExpenses.length > 0;
  const activeExpensesCount = displayExpenses.length;

  const totalPendingCollection = !hasActiveExpenses ? 0 : displayExpenses.reduce((acc, expense) => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const totalAmount = Number(expense.total_amount || expense.amount || 0);
    const collected = breakdown.reduce((sum: number, b) => sum + Number(b.paidAmount || b.paid_amount || (b.isPaid || b.is_paid ? (b.shareDue ?? b.shared_amount) : 0)), 0);
    return acc + Math.max(0, totalAmount - collected);
  }, 0);

  const totalCollected = !hasActiveExpenses ? 0 : expenses.reduce((acc, expense) => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const collected = breakdown.reduce((sum: number, b) => sum + Number(b.paidAmount || b.paid_amount || (b.isPaid || b.is_paid ? (b.shareDue ?? b.shared_amount) : 0)), 0);
    return acc + collected;
  }, 0);

  const totalDue = !hasActiveExpenses ? 0 : expenses.reduce((acc: number, expense) => {
    const breakdown = expenseSharesMap[expense.id] || [];
    const allSharesPaid = breakdown.length > 0 && breakdown.every((b) => b.isPaid || b.status === 'paid' || b.is_paid);
    if (expense.is_paid || expense.status === 'paid' || allSharesPaid) return acc;

    const myBreakdown = breakdown.find((item) => item.boarder_id === activeUserId || item.user_id === activeUserId);
    const isPaymentReceiver = expense.payment_receiver_id === activeUserId;
    
    if (!myBreakdown) return acc;

    const nonReceiverShares = breakdown.filter((b) => b.boarder_id !== expense.payment_receiver_id && b.user_id !== expense.payment_receiver_id);
    const totalCollectedFromOthers = nonReceiverShares.reduce((sum: number, b) => sum + Number(b.paidAmount || b.paid_amount || 0), 0);
    const receiverBaseShare = Number(myBreakdown.shareDue ?? myBreakdown.shared_amount ?? 0);

    const userShareDue = isPaymentReceiver 
      ? receiverBaseShare + totalCollectedFromOthers
      : Math.max(0, receiverBaseShare - Number(myBreakdown.paidAmount || myBreakdown.paid_amount || 0));

    const isMySharePaid = myBreakdown.isPaid || myBreakdown.is_paid || myBreakdown.status === 'paid';

    return acc + (!isMySharePaid ? userShareDue : 0);
  }, 0);

  if (!isMounted) return null;

  return (
    <div className="w-full space-y-6 text-slate-900">
      <Card className="bg-white border-slate-200 text-slate-800 shadow-xl overflow-hidden rounded-xl transition-colors">
        <div className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#4B49AC]" />
                Expenses & Misc
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Track shared miscellaneous entries, validate partial/full payments, and automatically credit receiver balances.
              </p>
            </div>
            
            <div className="w-full sm:w-auto flex justify-end">
              <AddExpenseDialog 
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                profiles={profiles}
                onSuccess={fetchData}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-lg bg-[#4B49AC]/10 text-[#4B49AC] shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Active Expenses</p>
                <p className="text-base sm:text-lg font-bold text-slate-900">{activeExpensesCount}</p>
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-lg bg-[#4B49AC]/10 text-[#4B49AC] shrink-0">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Pending Collection</p>
                <p className="text-base sm:text-lg font-bold text-slate-900 truncate">₱{totalPendingCollection.toFixed(2)}</p>
              </div>
            </div>

            <div className="col-span-2 lg:col-span-1 p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">Total Collected</p>
                <p className="text-base sm:text-lg font-bold text-slate-900 truncate">₱{totalCollected.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {displayExpenses.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <FileText className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">No active shared expenses found.</p>
                <p className="text-xs text-slate-400 mt-1">All shared miscellaneous expenses have been completely settled.</p>
              </div>
            ) : (
              displayExpenses.map((expense) => {
                const rawBreakdown = expenseSharesMap[expense.id] || [];
                
                const formattedBreakdown = rawBreakdown.map((b) => {
                  const targetUserId = b.boarder_id || b.user_id;
                  const matchedProfile = profiles.find((p) => p.id === targetUserId);
                  
                  return {
                    ...b,
                    shareDue: b.shareDue ?? b.shared_amount ?? 0,
                    isPaid: b.isPaid ?? b.is_paid ?? (b.status === 'paid'),
                    username: b.username || matchedProfile?.username || 'Unknown Member',
                    name: b.name || matchedProfile?.username || 'Unknown Member',
                  };
                });

                return (
                  <UnifiedDashboardCard
                    key={expense.id}
                    item={expense}
                    breakdown={formattedBreakdown}
                    activeUserId={activeUserId}
                    isAdmin={isAdmin}
                    isDanz={isDanz}
                    isExpanded={!!expandedExpenses[expense.id]}
                    onToggleExpand={toggleExpand}
                    onPayNow={(e, amt) => handleOpenPayModal(e, amt)}
                    onSettleItem={(e) => {
                      const myShare = formattedBreakdown.find((item) => item.boarder_id === activeUserId || item.user_id === activeUserId);
                      handleOpenSettleModal(e, Number(myShare?.shareDue || e.amount || 0));
                    }}
                    onEditItem={(e) => setEditingExpense(e)}
                    onDeleteItem={deleteExpense}
                    userPaymentRequests={userPaymentRequests}
                    type="expense"
                  />
                );
              })
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm sm:text-base font-semibold text-slate-600">Total Outstanding Due:</span>
            <span className="text-xl sm:text-2xl font-bold text-[#4B49AC]">₱{totalDue.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {selectedExpenseForPay && (
        <ExpensePaymentModal
          expense={selectedExpenseForPay}
          shareDue={paymentAmount}
          receiverProfile={receiverProfile || null}
          isDirectSettlement={isDirectSettlement}
          onClose={() => setSelectedExpenseForPay(null)}
          onSuccess={() => {
            setSelectedExpenseForPay(null);
            if (fetchData) fetchData();
          }}
        />
      )}

      <EditExpenseModal
        editingExpense={editingExpense}
        onClose={() => setEditingExpense(null)}
        onSuccess={fetchData}
      />

      <ReceiverSettleExpenseModal
        settlingExpense={settlingExpense}
        settleMethod={settleMethod}
        setSettleMethod={setSettleMethod}
        setSettleReceiptFile={setSettleReceiptFile}
        settlingSubmitting={settlingSubmitting}
        onClose={() => setSettlingExpense(null)}
        onSubmit={handleReceiverSettleSubmit}
      />
    </div>
  );
}
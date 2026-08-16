// components/expense/ExpenseCard.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Edit, Trash2 } from 'lucide-react';
import { ExpenseBreakdown } from './ExpenseBreakdown';

interface ExpenseCardProps {
  expense: any;
  breakdown: any[];
  activeUserId: string;
  isAdmin: boolean;
  isDanz: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onPayNow: (expense: any, amount: number) => void;
  onSettleExpense: (expense: any) => void;
  onEditExpense: (expense: any) => void;
  onDeleteExpense: (id: string) => void;
  userPaymentRequests: any[];
}

export const ExpenseCard = ({
  expense,
  breakdown,
  activeUserId,
  isAdmin,
  isDanz,
  isExpanded,
  onToggleExpand,
  onPayNow,
  onSettleExpense,
  onEditExpense,
  onDeleteExpense,
  userPaymentRequests,
}: ExpenseCardProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const normalizedBreakdown = (breakdown || []).map((b) => ({
    ...b,
    id: b.id || b.boarder_id,
    shareDue: b.shareDue ?? b.shared_amount ?? 0,
    paidAmount: b.paidAmount ?? b.paid_amount ?? 0,
    daysPresent: b.daysPresent ?? b.days_present ?? 0,
    isPaid: b.isPaid ?? b.is_paid ?? false,
  }));

  const myBreakdown = normalizedBreakdown.find((b) => b.boarder_id === activeUserId);
  const totalExpenseAmount = Number(expense.total_amount || expense.amount) || 0;

  const isPaymentReceiver = expense.payment_receiver_id === activeUserId;
  const nonReceiverShares = normalizedBreakdown.filter((b) => b.boarder_id !== expense.payment_receiver_id);
  const allOthersPaid = nonReceiverShares.length > 0 && nonReceiverShares.every((b) => b.isPaid || b.status === 'paid');

  const totalCollectedFromOthers = nonReceiverShares.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0);
  const receiverBaseShare = myBreakdown ? Number(myBreakdown.shareDue) : 0;

  const userShareDue = isPaymentReceiver 
    ? receiverBaseShare + totalCollectedFromOthers
    : (myBreakdown ? Math.max(0, Number(myBreakdown.shareDue) - Number(myBreakdown.paidAmount || 0)) : 0);

  const isReceiverFullyAccumulated = isPaymentReceiver && Math.abs(userShareDue - totalExpenseAmount) < 0.01;
  const isMySharePaid = myBreakdown?.isPaid || myBreakdown?.status === 'paid';

  const hasPendingSubmission =
    userPaymentRequests.some((req) => req.details?.expense_id === expense.id && req.details?.user_id === activeUserId) ||
    myBreakdown?.status === 'pending_approval';

  const hasAnyActivity =
    normalizedBreakdown.some((b) => b.status === 'pending_approval' || b.status === 'paid' || b.isPaid) ||
    userPaymentRequests.some((req) => req.details?.expense_id === expense.id);

  return (
    <div className="p-4 border border-slate-200 dark:border-[#333] rounded-lg bg-white dark:bg-[#111111] space-y-3 shadow-sm transition-colors relative">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-lg text-slate-900 dark:text-white">{expense.description || expense.title}</p>
            {allOthersPaid && (
              <span className="text-[10px] bg-emerald-500/10 dark:bg-green-500/20 border border-emerald-500 dark:border-green-500 text-emerald-600 dark:text-green-400 font-semibold px-2 py-0.5 rounded-full">
                All Shares Collected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
            Expense Date: {expense.expense_date || expense.date || 'N/A'} • Category:{' '}
            <span className="capitalize font-medium text-slate-700 dark:text-gray-300">{expense.category || 'Food'}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500 dark:text-gray-400">Total Expense Amount</p>
          <p className="font-bold text-xl text-[#4B49AC] dark:text-[#ff8c00]">₱{totalExpenseAmount.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-2 border-t border-slate-100 dark:border-[#222]">
        <div>
          <p className="text-xs text-slate-500 dark:text-gray-400">Your Share Due:</p>
          <p className="text-md font-bold text-slate-900 dark:text-white">
            {isPaymentReceiver ? (
              allOthersPaid ? (
                isMySharePaid ? (
                  <span className="text-emerald-600 dark:text-green-500 font-semibold">₱0.00 (Paid)</span>
                ) : (
                  `₱${userShareDue.toFixed(2)}`
                )
              ) : (
                <span className="text-[#4B49AC] dark:text-[#ff8c00]">
                  ₱{userShareDue.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">(Base + Collected: ₱{totalCollectedFromOthers.toFixed(2)})</span>
                </span>
              )
            ) : (
              myBreakdown ? (
                isMySharePaid ? (
                  <span className="text-emerald-600 dark:text-green-500 font-semibold">₱0.00 (Paid)</span>
                ) : (
                  `₱${userShareDue.toFixed(2)}`
                )
              ) : (
                <span className="text-slate-400 dark:text-gray-500 italic text-xs">Not included in this expense</span>
              )
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isPaymentReceiver ? (
            isReceiverFullyAccumulated ? (
              <Button
                onClick={() => onSettleExpense(expense)}
                className="bg-emerald-600 hover:bg-emerald-700 dark:bg-green-600 dark:hover:bg-green-700 text-white font-bold text-xs h-9 px-4 cursor-pointer shadow-sm"
              >
                Mark as Settled
              </Button>
            ) : null
          ) : (
            myBreakdown && userShareDue > 0 && !isMySharePaid && !isDanz && (
              hasPendingSubmission ? (
                <span className="text-xs text-amber-600 dark:text-yellow-500 font-semibold bg-amber-500/10 dark:bg-yellow-500/10 border border-amber-500/30 dark:border-yellow-500/30 px-3 py-1.5 rounded-md">
                  Pending Approval
                </span>
              ) : (
                <Button
                  onClick={() => onPayNow(expense, userShareDue)}
                  className="bg-[#4B49AC] hover:bg-[#3f3dc9] dark:bg-[#ff8c00] dark:hover:bg-[#e67e00] text-white dark:text-black font-bold text-xs h-9 px-4 cursor-pointer shadow-sm"
                >
                  Pay Now
                </Button>
              )
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
                      onEditExpense(expense);
                    }}
                    className="text-blue-600 dark:text-blue-400 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10"
                    title="Edit Expense"
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
                      setShowDeleteConfirm(true);
                    }}
                    className="text-red-600 dark:text-red-400 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10"
                    title="Delete Expense"
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

      {/* Delete Confirmation Modal / Inline Overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-white/95 dark:bg-[#111111]/95 backdrop-blur-sm z-30 p-4 rounded-lg flex flex-col justify-center items-center text-center space-y-3 border border-red-500/30 animate-fadeIn">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Are you sure you want to delete <span className="text-red-500">"{expense.description || expense.title}"</span>?
          </p>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            This action is irreversible and will remove all participant shares.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setShowDeleteConfirm(false);
                onDeleteExpense(expense.id);
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-8 px-4 cursor-pointer"
            >
              Yes, Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              className="border-slate-300 dark:border-[#333] text-slate-700 dark:text-gray-300 text-xs h-8 px-4 cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="pt-2">
        <button
          onClick={() => onToggleExpand(expense.id)}
          className="text-xs text-[#4B49AC] dark:text-[#ff8c00] flex items-center gap-1 hover:underline font-semibold focus:outline-none cursor-pointer"
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isExpanded ? "Hide Member Breakdown" : `See More Info (Member Shares) • ${normalizedBreakdown.length} Participants`}
        </button>

        {isExpanded && (
          <ExpenseBreakdown 
            breakdown={normalizedBreakdown} 
            paymentReceiverId={expense.payment_receiver_id} 
            totalExpenseAmount={totalExpenseAmount}
          />
        )}
      </div>
    </div>
  );
};
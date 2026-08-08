'use client';

import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Edit, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import ExpenseBreakdown from "./ExpenseBreakdown";

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
}

interface ExpenseCardProps {
  expense: Expense;
  breakdown: ExpenseShare[];
  activeUserId: string;
  isExpanded: boolean;
  hasPendingSubmission: boolean;
  hasAnyActivity: boolean;
  allSharesArePaid: boolean;
  isReceiver: boolean;
  receiverName: string;
  myBreakdown?: ExpenseShare;
  userShareDue: number;
  userPaidAmount: number;
  netUserShareDue: number;
  isMySharePaid: boolean;
  onToggleExpand: (id: string) => void;
  onOpenPayModal: (expense: Expense, shareDue: number, paidAmount: number) => void;
  onOpenSettleModal: (expense: Expense) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export default function ExpenseCard({
  expense,
  breakdown,
  isExpanded,
  hasPendingSubmission,
  hasAnyActivity,
  allSharesArePaid,
  isReceiver,
  receiverName,
  myBreakdown,
  userShareDue,
  userPaidAmount,
  netUserShareDue,
  isMySharePaid,
  onToggleExpand,
  onOpenPayModal,
  onOpenSettleModal,
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  return (
    <div className="p-5 border border-zinc-800/80 rounded-xl bg-zinc-900/60 hover:border-zinc-700 transition-all space-y-4 shadow-sm">
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
                onClick={() => onOpenPayModal(expense, userShareDue, userPaidAmount)}
                className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-xs h-9 px-4 shadow-sm"
              >
                Pay Share
              </Button>
            )
          )}

          {isReceiver && !allSharesArePaid && (
            <Button
              type="button"
              onClick={() => onOpenSettleModal(expense)}
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
                      onEdit(expense);
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
                      onDelete(expense.id);
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
          onClick={() => onToggleExpand(expense.id)}
          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium focus:outline-none transition-colors"
        >
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {isExpanded ? "Hide Member Breakdown" : `View Member Breakdown (${breakdown.length} Participants)`}
        </button>

        {isExpanded && (
          <ExpenseBreakdown breakdown={breakdown} receiverId={expense.payment_receiver_id} />
        )}
      </div>
    </div>
  );
}
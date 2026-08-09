// components/expense/ExpenseBreakdown.tsx
import React from 'react';

interface MemberShare {
  id: string;
  boarder_id?: string;
  username?: string;
  daysPresent?: number;
  days_present?: number;
  shareDue?: number;
  shared_amount?: number;
  paidAmount?: number;
  paid_amount?: number;
  status?: string;
  isPaid?: boolean;
  is_paid?: boolean;
}

interface ExpenseBreakdownProps {
  breakdown: MemberShare[];
  totalDays?: number;
  paymentReceiverId?: string | null;
  totalExpenseAmount?: number;
}

export const ExpenseBreakdown = ({
  breakdown,
  totalDays = 30,
  paymentReceiverId,
  totalExpenseAmount = 0,
}: ExpenseBreakdownProps) => {
  const normalizedBreakdown = (breakdown || []).map((b) => ({
    ...b,
    id: b.id || b.boarder_id || '',
    username: b.username || 'Member',
    daysPresent: Number(b.daysPresent ?? b.days_present ?? 0),
    shareDue: Number(b.shareDue ?? b.shared_amount ?? 0),
    paidAmount: Number(b.paidAmount ?? b.paid_amount ?? 0),
    isPaid: Boolean(b.isPaid ?? b.is_paid ?? b.status === 'paid'),
  }));

  const nonReceiverShares = normalizedBreakdown.filter((b) => b.id !== paymentReceiverId);
  const allOthersPaid = nonReceiverShares.length > 0 && nonReceiverShares.every((b) => b.isPaid || b.status === 'paid');
  const totalCollectedFromOthers = nonReceiverShares.reduce((sum, b) => sum + b.paidAmount, 0);

  return (
    <div className="mt-3 p-3 bg-slate-100 dark:bg-[#181818] rounded-md border border-slate-200 dark:border-[#333] space-y-2 transition-colors">
      <p className="text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider mb-2">
        Member Share Breakdown ({normalizedBreakdown.length} Participants)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {normalizedBreakdown.map((member) => {
          const isReceiver = member.id === paymentReceiverId;
          const isPaid = member.status === 'paid' || member.isPaid;

          // Calculate display amount: Receiver's amount accumulates collected funds, others decrease as they pay
          let displayAmount = 0;
          if (isReceiver) {
            const receiverBase = member.shareDue;
            displayAmount = receiverBase + totalCollectedFromOthers;
          } else {
            displayAmount = Math.max(0, member.shareDue - member.paidAmount);
          }

          return (
            <div
              key={member.id}
              className="flex justify-between items-center bg-white dark:bg-[#111] p-2 rounded border border-slate-200 dark:border-[#222] text-xs transition-colors"
            >
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {member.username} {isReceiver ? "(Receiver)" : ""}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400">
                  Present in House: {member.daysPresent} / {totalDays} days
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#4B49AC] dark:text-[#ff8c00]">
                  {isPaid && (!isReceiver || allOthersPaid) ? (
                    '₱0.00'
                  ) : (
                    `₱${displayAmount.toFixed(2)}`
                  )}
                </p>
                <span
                  className={`text-[10px] font-semibold uppercase block ${
                    isPaid
                      ? 'text-emerald-600 dark:text-green-500'
                      : member.status === 'pending_approval'
                      ? 'text-amber-600 dark:text-yellow-500'
                      : 'text-slate-500 dark:text-gray-400'
                  }`}
                >
                  {member.isPaid ? 'paid' : member.status || 'unpaid'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
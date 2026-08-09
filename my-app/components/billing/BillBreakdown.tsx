// components/billing/BillBreakdown.tsx
import React from 'react';

interface MemberShare {
  id: string;
  username: string;
  daysPresent: number;
  shareDue: number;
  paid_amount?: number;
  status?: string;
  isPaid?: boolean;
}

interface BillBreakdownProps {
  breakdown: MemberShare[];
  totalDays: number;
  paymentReceiverId?: string | null;
  totalBillAmount?: number;
}

export const BillBreakdown = ({ breakdown, totalDays, paymentReceiverId, totalBillAmount = 0 }: BillBreakdownProps) => {
  const nonReceiverShares = breakdown.filter((b) => b.id !== paymentReceiverId);
  const allOthersPaid = nonReceiverShares.length > 0 && nonReceiverShares.every((b) => b.isPaid || b.status === 'paid');
  const totalCollectedFromOthers = nonReceiverShares.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);

  return (
    <div className="mt-3 p-3 bg-slate-100 dark:bg-[#181818] rounded-md border border-slate-200 dark:border-[#333] space-y-2 transition-colors">
      <p className="text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider mb-2">
        Member Share Breakdown ({breakdown.length} Participants)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {breakdown.map((member) => {
          const isReceiver = member.id === paymentReceiverId;
          const isPaid = member.status === 'paid' || member.isPaid;

          // Calculate display amount: Receiver's amount accumulates collected funds, others decrease as they pay
          let displayAmount = 0;
          if (isReceiver) {
            const receiverBase = Number(member.shareDue || 0);
            displayAmount = receiverBase + totalCollectedFromOthers;
          } else {
            displayAmount = Math.max(0, Number(member.shareDue) - Number(member.paid_amount || 0));
          }

          return (
            <div key={member.id} className="flex justify-between items-center bg-white dark:bg-[#111] p-2 rounded border border-slate-200 dark:border-[#222] text-xs transition-colors">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {member.username} {isReceiver ? "(Receiver)" : ""}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400">Present in House: {member.daysPresent} / {totalDays} days</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#4B49AC] dark:text-[#ff8c00]">
                  {isPaid && (!isReceiver || allOthersPaid) ? (
                    '₱0.00'
                  ) : (
                    `₱${displayAmount.toFixed(2)}`
                  )}
                </p>
                <span className={`text-[10px] font-semibold uppercase block ${
                  isPaid ? 'text-emerald-600 dark:text-green-500' :
                  member.status === 'pending_approval' ? 'text-amber-600 dark:text-yellow-500' :
                  'text-slate-500 dark:text-gray-400'
                }`}>
                  {member.isPaid ? 'paid' : (member.status || 'unpaid')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
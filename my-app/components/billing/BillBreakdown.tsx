// components/billing/BillBreakdown.tsx
import React from 'react';

interface BillBreakdownProps {
  breakdown: any[];
  totalDays: number;
  paymentReceiverId: string;
  totalBillAmount: number;
  onMarkAsSettled?: () => void;
  isBillSettled?: boolean;
}

export const BillBreakdown: React.FC<BillBreakdownProps> = ({
  breakdown,
  totalDays,
  paymentReceiverId,
  totalBillAmount,
  onMarkAsSettled,
  isBillSettled,
}) => {
  // Find the receiver's current share due amount from the breakdown list
  const receiverEntry = breakdown.find(
    (item) => item.id === paymentReceiverId || item.boarder_id === paymentReceiverId
  );
  
  const receiverShareDue = Number(receiverEntry?.shareDue || receiverEntry?.shared_amount || receiverEntry?.amount || 0);
  
  // Condition: receiver's share due equals or exceeds the total bill amount
  const isFullyCollected = receiverShareDue >= totalBillAmount;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#222] space-y-3 animate-fadeIn">
      <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">
        Member Breakdown & Prorated Days ({totalDays} Total Days):
      </p>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-[#333]">
              <th className="pb-2 font-medium">Member</th>
              <th className="pb-2 font-medium text-center">Days Present</th>
              <th className="pb-2 font-medium text-right">Share Due</th>
              <th className="pb-2 font-medium text-right">Paid Amount</th>
              <th className="pb-2 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#222]">
            {breakdown.map((item, index) => {
              const isReceiver = item.id === paymentReceiverId || item.boarder_id === paymentReceiverId;
              const isPaid = item.isPaid || item.status === 'paid';
              const isPending = item.status === 'pending_approval';

              return (
                <tr key={item.id || index} className="text-slate-800 dark:text-gray-200">
                  <td className="py-2 font-medium flex items-center gap-1.5">
                    {item.username || item.name || 'Unknown'}
                    {isReceiver && (
                      <span className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20">
                        Receiver
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-center text-slate-500 dark:text-gray-400">
                    {item.daysPresent} / {totalDays}
                  </td>
                  <td className="py-2 text-right font-semibold">
                    ₱{Number(item.shareDue || item.shared_amount || item.amount || 0).toFixed(2)}
                  </td>
                  <td className="py-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                    ₱{Number(item.paidAmount || item.paid_amount || 0).toFixed(2)}
                  </td>
                  <td className="py-2 text-center">
                    {isPaid ? (
                      <span className="inline-block text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                        Paid
                      </span>
                    ) : isPending ? (
                      <span className="inline-block text-[10px] bg-amber-500/10 text-amber-600 dark:text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                        Pending Approval
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] bg-slate-500/10 text-slate-500 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
                        Unpaid
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mark as Settled Action Area */}
      {isFullyCollected && !isBillSettled && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            ✨ Total bill amount fully collected into receiver balance.
          </p>
          {onMarkAsSettled && (
            <button
              type="button"
              onClick={onMarkAsSettled}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs"
            >
              Mark as Settled
            </button>
          )}
        </div>
      )}

      {isBillSettled && (
        <div className="pt-2 text-center">
          <span className="inline-block text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-xl font-semibold border border-emerald-500/20">
            ✓ Bill is Fully Settled
          </span>
        </div>
      )}
    </div>
  );
};
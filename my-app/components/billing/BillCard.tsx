// components/billing/BillCard.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Edit, Trash2 } from 'lucide-react';
import { BillBreakdown } from './BillBreakdown';

interface BillCardProps {
  bill: any;
  breakdown: any[];
  activeUserId: string;
  isAdmin: boolean;
  isDanz: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onPayNow: (bill: any, amount: number) => void;
  onSettleBill: (bill: any) => void;
  onEditBill: (bill: any) => void;
  onDeleteBill: (id: string) => void;
  userPaymentRequests: any[];
}

export const BillCard = ({
  bill,
  breakdown,
  activeUserId,
  isAdmin,
  isDanz,
  isExpanded,
  onToggleExpand,
  onPayNow,
  onSettleBill,
  onEditBill,
  onDeleteBill,
  userPaymentRequests,
}: BillCardProps) => {
  const normalizedBreakdown = (breakdown || []).map((b) => ({
    ...b,
    id: b.id || b.boarder_id,
    shareDue: b.shareDue ?? b.shared_amount ?? 0,
    paidAmount: b.paidAmount ?? b.paid_amount ?? 0,
    daysPresent: b.daysPresent ?? b.days_present ?? 0,
    isPaid: b.isPaid ?? b.is_paid ?? false,
  }));

  const validDays = normalizedBreakdown.map((b) => Number(b.daysPresent)).filter((d) => !isNaN(d) && d > 0);
  const totalDays = validDays.length > 0 ? Math.max(...validDays) : Number(bill.total_members) > 0 ? 30 : 31;

  const myBreakdown = normalizedBreakdown.find((b) => b.id === activeUserId);
  const totalBillAmount = Number(bill.total_amount) || 0;

  const isPaymentReceiver = bill.payment_receiver_id === activeUserId;
  const nonReceiverShares = normalizedBreakdown.filter((b) => b.id !== bill.payment_receiver_id);
  const allOthersPaid = nonReceiverShares.length > 0 && nonReceiverShares.every((b) => b.isPaid || b.status === 'paid');

  const totalCollectedFromOthers = nonReceiverShares.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0);
  const receiverBaseShare = myBreakdown ? Number(myBreakdown.shareDue) : 0;

  const userShareDue = isPaymentReceiver 
    ? receiverBaseShare + totalCollectedFromOthers
    : (myBreakdown ? Math.max(0, Number(myBreakdown.shareDue) - Number(myBreakdown.paidAmount || 0)) : 0);

  // "Settle Bill" button will only appear if and only if receiver's due matches the total bill amount
  const isReceiverFullyAccumulated = isPaymentReceiver && Math.abs(userShareDue - totalBillAmount) < 0.01;

  const isMySharePaid = myBreakdown?.isPaid || myBreakdown?.status === 'paid';

  const hasPendingSubmission =
    userPaymentRequests.some((req) => req.details?.bill_id === bill.id && req.details?.user_id === activeUserId) ||
    myBreakdown?.status === 'pending_approval';

  const hasAnyActivity =
    normalizedBreakdown.some((b) => b.status === 'pending_approval' || b.status === 'paid' || b.isPaid) ||
    userPaymentRequests.some((req) => req.details?.bill_id === bill.id);

  return (
    <div className="p-4 border border-slate-200 dark:border-[#333] rounded-lg bg-white dark:bg-[#111111] space-y-3 shadow-sm transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-lg text-slate-900 dark:text-white">{bill.description}</p>
            {allOthersPaid && (
              <span className="text-[10px] bg-emerald-500/10 dark:bg-green-500/20 border border-emerald-500 dark:border-green-500 text-emerald-600 dark:text-green-400 font-semibold px-2 py-0.5 rounded-full">
                All Shares Collected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Billing Period: {bill.billing_period_start || 'N/A'} to {bill.billing_period_end || 'N/A'} ({totalDays} Days) • Type:{' '}
            <span className="capitalize">{bill.calculation_type || 'prorated'}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500 dark:text-gray-400">Total Bill Due</p>
          <p className="font-bold text-xl text-[#4B49AC] dark:text-[#ff8c00]">₱{totalBillAmount.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-[#222]">
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
                <span className="text-slate-400 dark:text-gray-500 italic text-xs">Not included in this bill</span>
              )
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isPaymentReceiver ? (
            isReceiverFullyAccumulated ? (
              <Button
                onClick={() => onSettleBill(bill)}
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
                  onClick={() => onPayNow(bill, userShareDue)}
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
                      onEditBill(bill);
                    }}
                    className="text-blue-600 dark:text-blue-400 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10"
                    title="Edit Bill"
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
                      onDeleteBill(bill.id);
                    }}
                    className="text-red-600 dark:text-red-400 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10"
                    title="Delete Bill"
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

      <div className="pt-2">
        <button
          onClick={() => onToggleExpand(bill.id)}
          className="text-xs text-[#4B49AC] dark:text-[#ff8c00] flex items-center gap-1 hover:underline font-semibold focus:outline-none cursor-pointer"
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isExpanded ? "Hide Member Breakdown & Days" : `See More Info (Member Shares & Prorated Days) • ${normalizedBreakdown.length} Participants`}
        </button>

        {isExpanded && (
          <BillBreakdown 
            breakdown={normalizedBreakdown} 
            totalDays={totalDays} 
            paymentReceiverId={bill.payment_receiver_id} 
            totalBillAmount={totalBillAmount}
          />
        )}
      </div>
    </div>
  );
};
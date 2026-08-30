// components/billing/BillCard.tsx
import React, { useState } from 'react';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const isReceiverFullyAccumulated = isPaymentReceiver && Math.abs(userShareDue - totalBillAmount) < 0.01;
  const isMySharePaid = myBreakdown?.isPaid || myBreakdown?.status === 'paid';

  const hasPendingSubmission =
    userPaymentRequests.some((req) => req.details?.bill_id === bill.id && req.details?.user_id === activeUserId) ||
    myBreakdown?.status === 'pending_approval';

  const hasAnyActivity =
    normalizedBreakdown.some((b) => b.status === 'pending_approval' || b.status === 'paid' || b.isPaid) ||
    userPaymentRequests.some((req) => req.details?.bill_id === bill.id);

  return (
    <div className="p-4 border border-slate-200 rounded-lg bg-white space-y-3 shadow-sm transition-colors relative">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-lg text-slate-900">{bill.description}</p>
            {allOthersPaid && (
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">
                All Shares Collected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Billing Period: {bill.billing_period_start || 'N/A'} to {bill.billing_period_end || 'N/A'} ({totalDays} Days) • Type:{' '}
            <span className="capitalize">{bill.calculation_type || 'prorated'}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500">Total Bill Due</p>
          <p className="font-bold text-xl text-[#4B49AC]">₱{totalBillAmount.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-2 border-t border-slate-100">
        <div>
          <p className="text-xs text-slate-500">Your Share Due:</p>
          <p className="text-md font-bold text-slate-900">
            {isPaymentReceiver ? (
              allOthersPaid ? (
                isMySharePaid ? (
                  <span className="text-emerald-600 font-semibold">₱0.00 (Paid)</span>
                ) : (
                  `₱${userShareDue.toFixed(2)}`
                )
              ) : (
                <span className="text-[#4B49AC]">
                  ₱{userShareDue.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">(Base + Collected: ₱{totalCollectedFromOthers.toFixed(2)})</span>
                </span>
              )
            ) : (
              myBreakdown ? (
                isMySharePaid ? (
                  <span className="text-emerald-600 font-semibold">₱0.00 (Paid)</span>
                ) : (
                  `₱${userShareDue.toFixed(2)}`
                )
              ) : (
                <span className="text-slate-400 italic text-xs">Not included in this bill</span>
              )
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isPaymentReceiver ? (
            isReceiverFullyAccumulated ? (
              <Button
                onClick={() => onSettleBill(bill)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 cursor-pointer shadow-sm"
              >
                Mark as Settled
              </Button>
            ) : null
          ) : (
            myBreakdown && userShareDue > 0 && !isMySharePaid && !isDanz && (
              hasPendingSubmission ? (
                <span className="text-xs text-amber-600 font-semibold bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-md">
                  Pending Approval
                </span>
              ) : (
                <Button
                  onClick={() => onPayNow(bill, userShareDue)}
                  className="bg-[#4B49AC] hover:bg-[#3f3dc9] text-white font-bold text-xs h-9 px-4 cursor-pointer shadow-sm"
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
                    className="text-blue-600 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-50"
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
                      setShowDeleteConfirm(true);
                    }}
                    className="text-red-600 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-red-50"
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

      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-30 p-4 rounded-lg flex flex-col justify-center items-center text-center space-y-3 border border-red-500/30 animate-fadeIn">
          <p className="text-sm font-semibold text-slate-900">
            Are you sure you want to delete <span className="text-red-500">"{bill.description}"</span>?
          </p>
          <p className="text-xs text-slate-500">
            This action is irreversible and will remove all participant shares.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setShowDeleteConfirm(false);
                onDeleteBill(bill.id);
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
              className="border-slate-300 text-slate-700 text-xs h-8 px-4 cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="pt-2">
        <button
          onClick={() => onToggleExpand(bill.id)}
          className="text-xs text-[#4B49AC] flex items-center gap-1 hover:underline font-semibold focus:outline-none cursor-pointer"
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
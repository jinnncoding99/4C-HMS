import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Edit, Trash2 } from 'lucide-react';

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
  const validDays = breakdown.map((b) => Number(b.daysPresent)).filter((d) => !isNaN(d) && d > 0);
  const totalDays = validDays.length > 0 ? Math.max(...validDays) : Number(bill.total_members) > 0 ? 30 : 31;

  const myBreakdown = breakdown.find((b) => b.id === activeUserId);
  const userShareDue = myBreakdown ? myBreakdown.shareDue : 0;
  const isMySharePaid = myBreakdown?.isPaid || myBreakdown?.status === 'paid';

  const hasPendingSubmission =
    userPaymentRequests.some((req) => req.details?.bill_id === bill.id && req.details?.user_id === activeUserId) ||
    myBreakdown?.status === 'pending_approval';

  const hasAnyActivity =
    breakdown.some((b) => b.status === 'pending_approval' || b.status === 'paid' || b.isPaid) ||
    userPaymentRequests.some((req) => req.details?.bill_id === bill.id);

  const isPaymentReceiver = bill.payment_receiver_id === activeUserId;
  const nonReceiverShares = breakdown.filter((b) => b.id !== bill.payment_receiver_id);
  const allOthersPaid = nonReceiverShares.length > 0 && nonReceiverShares.every((b) => b.isPaid || b.status === 'paid');

  return (
    <div className="p-4 border border-[#333] rounded-lg bg-[#111111] space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-lg text-white">{bill.description}</p>
            {allOthersPaid && (
              <span className="text-[10px] bg-green-500/20 border border-green-500 text-green-400 font-semibold px-2 py-0.5 rounded-full">
                All Shares Collected
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Billing Period: {bill.billing_period_start || 'N/A'} to {bill.billing_period_end || 'N/A'} ({totalDays} Days) • Type:{' '}
            <span className="capitalize">{bill.calculation_type || 'prorated'}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Total Bill Due</p>
          <p className="font-bold text-xl text-[#ff8c00]">₱{Number(bill.total_amount).toFixed(2)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-[#222]">
        <div>
          <p className="text-xs text-gray-400">Your Share Due:</p>
          <p className="text-md font-bold text-white">
            {myBreakdown ? (
              isMySharePaid ? (
                <span className="text-green-500 font-semibold">₱0.00 (Paid)</span>
              ) : (
                `₱${userShareDue.toFixed(2)}`
              )
            ) : (
              <span className="text-gray-500 italic text-xs">Not included in this bill</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isPaymentReceiver && allOthersPaid && (
            <Button
              onClick={() => onSettleBill(bill)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-9 px-4 cursor-pointer"
            >
              Mark as Settled
            </Button>
          )}

          {myBreakdown && userShareDue > 0 && !isMySharePaid && !isDanz && !isPaymentReceiver && (
            hasPendingSubmission ? (
              <span className="text-xs text-yellow-500 font-semibold bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-md">
                Pending Approval
              </span>
            ) : (
              <Button
                onClick={() => onPayNow(bill, userShareDue)}
                className="bg-[#ff8c00] hover:bg-[#e67e00] text-black font-bold text-xs h-9 px-4 cursor-pointer"
              >
                Pay Now
              </Button>
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
                    className="text-blue-400 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-500/10"
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
                    className="text-red-400 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-red-500/10"
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
          className="text-xs text-[#ff8c00] flex items-center gap-1 hover:underline font-semibold focus:outline-none cursor-pointer"
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isExpanded ? "Hide Member Breakdown & Days" : "See More Info (Member Shares & Prorated Days)"}
        </button>

        {isExpanded && (
          <div className="mt-3 p-3 bg-[#181818] rounded-md border border-[#333] space-y-2">
            <p className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
              Member Share Breakdown ({breakdown.length} Participants)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {breakdown.map((member) => (
                <div key={member.id} className="flex justify-between items-center bg-[#111] p-2 rounded border border-[#222] text-xs">
                  <div>
                    <p className="font-semibold text-white">
                      {member.username} {member.id === bill.payment_receiver_id ? "(Receiver)" : ""}
                    </p>
                    <p className="text-[10px] text-gray-400">Present in House: {member.daysPresent} / {totalDays} days</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#ff8c00]">
                      ₱{member.status === 'paid' || member.isPaid 
                        ? '0.00' 
                        : (Math.max(0, Number(member.shareDue) - Number(member.paid_amount || 0))).toFixed(2)}
                    </p>
                    <span className={`text-[10px] font-semibold uppercase block ${
                      member.status === 'paid' || member.isPaid ? 'text-green-500' :
                      member.status === 'pending_approval' ? 'text-yellow-500' :
                      'text-gray-400'
                    }`}>
                      {member.isPaid ? 'paid' : (member.status || 'unpaid')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
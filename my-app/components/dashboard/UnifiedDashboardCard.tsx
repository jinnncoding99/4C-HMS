// components/dashboard/UnifiedDashboardCard.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Edit, Trash2, History, Clock } from 'lucide-react';

interface MemberShare {
  id?: string;
  boarder_id?: string;
  user_id?: string;
  userId?: string;
  username?: string;
  name?: string;
  boarder_name?: string;
  user_name?: string;
  daysPresent?: number;
  days_present?: number;
  shareDue?: number;
  shared_amount?: number;
  amount?: number;
  paidAmount?: number;
  paid_amount?: number;
  status?: string;
  isPaid?: boolean;
  is_paid?: boolean;
}

interface UnifiedDashboardCardProps {
  item: any; // Can be a bill or an expense
  breakdown: MemberShare[];
  activeUserId: string;
  isAdmin: boolean;
  isDanz: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onPayNow: (item: any, amount: number) => void;
  onSettleItem: (item: any) => void;
  onEditItem: (item: any) => void;
  onDeleteItem: (id: string) => void;
  userPaymentRequests: any[];
  type?: 'bill' | 'expense';
  profileMap?: Map<string, any> | Record<string, any>;
}

export const UnifiedDashboardCard = ({
  item,
  breakdown,
  activeUserId,
  isAdmin,
  isDanz,
  isExpanded,
  onToggleExpand,
  onPayNow,
  onSettleItem,
  onEditItem,
  onDeleteItem,
  userPaymentRequests,
  type = 'bill',
  profileMap = new Map(),
}: UnifiedDashboardCardProps) => {
  const [showTimeline, setShowTimeline] = useState(false);

  // Helper to safely fetch username from profileMap (supports Map or plain object)
  const resolveUsername = (userId: string, fallbackName?: string) => {
    if (fallbackName && fallbackName !== 'Unknown Member') return fallbackName;
    if (!userId) return 'Unknown Member';

    if (profileMap instanceof Map) {
      const profile = profileMap.get(userId);
      return profile?.username || profile?.name || profile?.full_name || 'Unknown Member';
    } else if (profileMap && typeof profileMap === 'object') {
      const profile = profileMap[userId];
      return profile?.username || profile?.name || profile?.full_name || 'Unknown Member';
    }
    return 'Unknown Member';
  };

  // Normalize breakdown fields for consistency across bills and expenses
  const normalizedBreakdown = (breakdown || []).map((b) => {
    // Prioritize boarder_id first since the database schema uses boarder_id for expense_shares
    const memberId = b.boarder_id || b.user_id || b.userId || b.id;
    const rawName = b.username || b.name || b.boarder_name || b.user_name;
    const resolvedName = resolveUsername(memberId || '', rawName);

    return {
      ...b,
      id: memberId,
      username: resolvedName,
      shareDue: b.shareDue ?? b.shared_amount ?? b.amount ?? 0,
      paidAmount: b.paidAmount ?? b.paid_amount ?? 0,
      daysPresent: b.daysPresent ?? b.days_present ?? 0,
      isPaid: b.isPaid ?? b.is_paid ?? (b.status === 'paid'),
    };
  });

  const validDays = normalizedBreakdown.map((b) => Number(b.daysPresent)).filter((d) => !isNaN(d) && d > 0);
  const totalDays = validDays.length > 0 ? Math.max(...validDays) : Number(item.total_members) > 0 ? 30 : 31;

  const myBreakdown = normalizedBreakdown.find((b) => b.id === activeUserId);
  const totalItemAmount = Number(item.total_amount || item.amount) || 0;

  const isPaymentReceiver = item.payment_receiver_id === activeUserId || item.paid_by === activeUserId;
  const nonReceiverShares = normalizedBreakdown.filter((b) => b.id !== (item.payment_receiver_id || item.paid_by));
  const allOthersPaid = nonReceiverShares.length > 0 && nonReceiverShares.every((b) => b.isPaid || b.status === 'paid');

  const totalCollectedFromOthers = nonReceiverShares.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0);
  const receiverBaseShare = myBreakdown ? Number(myBreakdown.shareDue) : 0;

  const userShareDue = isPaymentReceiver 
    ? receiverBaseShare + totalCollectedFromOthers
    : (myBreakdown ? Math.max(0, Number(myBreakdown.shareDue) - Number(myBreakdown.paidAmount || 0)) : 0);

  // Settle button appears if and only if receiver's computed due matches the total amount
  const isReceiverFullyAccumulated = isPaymentReceiver && Math.abs(userShareDue - totalItemAmount) < 0.01;
  const isMySharePaid = myBreakdown?.isPaid || myBreakdown?.status === 'paid';

  const hasPendingSubmission =
    userPaymentRequests.some((req) => (req.details?.bill_id === item.id || req.details?.expense_id === item.id) && req.details?.user_id === activeUserId) ||
    myBreakdown?.status === 'pending_approval';

  const hasAnyActivity =
    normalizedBreakdown.some((b) => b.status === 'pending_approval' || b.status === 'paid' || b.isPaid) ||
    userPaymentRequests.some((req) => req.details?.bill_id === item.id || req.details?.expense_id === item.id);

  // Collection progress calculation
  const totalCollectedOverall = normalizedBreakdown.reduce((sum, b) => sum + Number(b.paidAmount || (b.isPaid ? b.shareDue : 0)), 0);
  const progressPercentage = totalItemAmount > 0 ? Math.min(100, (totalCollectedOverall / totalItemAmount) * 100) : 0;

  // Filter relevant payment requests for this item's audit log timeline
  const itemPaymentRequests = userPaymentRequests.filter(
    (req) => req.details?.bill_id === item.id || req.details?.expense_id === item.id
  );

  return (
    <div className="p-4 border border-slate-200 dark:border-[#333] rounded-lg bg-white dark:bg-[#111111] space-y-3 shadow-sm transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-lg text-slate-900 dark:text-white">{item.description || item.title}</p>
            {allOthersPaid && (
              <span className="text-[10px] bg-emerald-500/10 dark:bg-green-500/20 border border-emerald-500 dark:border-green-500 text-emerald-600 dark:text-green-400 font-semibold px-2 py-0.5 rounded-full">
                All Shares Collected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            {type === 'bill' ? `Billing Period: ${item.billing_period_start || 'N/A'} to ${item.billing_period_end || 'N/A'} (${totalDays} Days)` : `Date Recorded: ${item.date || item.created_at?.split('T')[0] || 'N/A'}`} • Type:{' '}
            <span className="capitalize">{item.calculation_type || item.category || 'standard'}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500 dark:text-gray-400">Total {type === 'bill' ? 'Bill Due' : 'Expense Amount'}</p>
          <p className="font-bold text-xl text-[#4B49AC] dark:text-[#ff8c00]">₱{totalItemAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Built-in Progress Bar */}
      <div className="space-y-1 pt-1">
        <div className="flex justify-between text-[11px] text-slate-500 dark:text-gray-400">
          <span>Collection Progress</span>
          <span className="font-semibold text-slate-700 dark:text-gray-300">
            ₱{totalCollectedOverall.toFixed(2)} / ₱{totalItemAmount.toFixed(2)} ({progressPercentage.toFixed(0)}%)
          </span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-[#222] h-2 rounded-full overflow-hidden">
          <div 
            className="bg-[#4B49AC] dark:bg-[#ff8c00] h-full transition-all duration-300 rounded-full" 
            style={{ width: `${progressPercentage}%` }}
          />
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
                <span className="text-slate-400 dark:text-gray-500 italic text-xs">Not included in this item</span>
              )
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isPaymentReceiver ? (
            isReceiverFullyAccumulated ? (
              <Button
                onClick={() => onSettleItem(item)}
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
                  onClick={() => onPayNow(item, userShareDue)}
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
                      onEditItem(item);
                    }}
                    className="text-blue-600 dark:text-blue-400 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10"
                    title="Edit Item"
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
                      onDeleteItem(item.id);
                    }}
                    className="text-red-600 dark:text-red-400 h-9 px-2 text-xs flex items-center gap-1 cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10"
                    title="Delete Item"
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

      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-[#222]">
        <button
          onClick={() => onToggleExpand(item.id)}
          className="text-xs text-[#4B49AC] dark:text-[#ff8c00] flex items-center gap-1 hover:underline font-semibold focus:outline-none cursor-pointer"
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isExpanded ? "Hide Member Breakdown & Days" : `See More Info (Participant Shares & Days) • ${normalizedBreakdown.length} Participants`}
        </button>

        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1 hover:text-[#4B49AC] dark:hover:text-[#ff8c00] transition-colors font-semibold focus:outline-none cursor-pointer"
        >
          <History size={13} />
          {showTimeline ? "Hide Audit Log" : "Activity Timeline"}
        </button>
      </div>

      {/* #3 Activity Timeline & Audit Log */}
      {showTimeline && (
        <div className="mt-3 p-3 bg-slate-50 dark:bg-[#151515] rounded-md border border-slate-200 dark:border-[#333] space-y-2.5 transition-colors">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-2">
            <Clock size={14} className="text-[#4B49AC] dark:text-[#ff8c00]" />
            Audit Log & Activity Timeline
          </div>
          <div className="space-y-2 text-xs border-l-2 border-slate-200 dark:border-[#333] pl-3 ml-1">
            <div className="relative">
              <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-[#4B49AC] dark:bg-[#ff8c00]" />
              <p className="font-semibold text-slate-800 dark:text-gray-200">
                {type === 'bill' ? 'Monthly Bill Created' : 'Expense Recorded'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-gray-400">
                {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recently'}
              </p>
            </div>

            {itemPaymentRequests.map((req, idx) => (
              <div key={req.id || idx} className="relative pt-1">
                <div className="absolute -left-[17px] top-2 w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-yellow-500" />
                <p className="font-semibold text-slate-800 dark:text-gray-200">
                  Payment Proof Submitted {req.status ? `(${req.status})` : ''}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400">
                  Amount: ₱{Number(req.amount || req.details?.amount || 0).toFixed(2)} • {req.created_at ? new Date(req.created_at).toLocaleString() : 'Pending review'}
                </p>
              </div>
            ))}

            {(item.is_paid || item.status === 'paid' || allOthersPaid) && (
              <div className="relative pt-1">
                <div className="absolute -left-[17px] top-2 w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-green-500" />
                <p className="font-semibold text-emerald-700 dark:text-green-400">Item Fully Settled / Collected</p>
                <p className="text-[10px] text-slate-500 dark:text-gray-400">All corresponding member shares have been successfully verified and cleared.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 p-3 bg-slate-100 dark:bg-[#181818] rounded-md border border-slate-200 dark:border-[#333] space-y-2 transition-colors">
          <p className="text-xs font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider mb-2">
            Participant Share Breakdown ({normalizedBreakdown.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {normalizedBreakdown.map((member) => {
              const isReceiver = member.id === (item.payment_receiver_id || item.paid_by);
              const isPaid = member.status === 'paid' || member.isPaid;

              let displayAmount = 0;
              if (isReceiver) {
                const receiverBase = Number(member.shareDue || 0);
                displayAmount = receiverBase + totalCollectedFromOthers;
              } else {
                displayAmount = Math.max(0, Number(member.shareDue) - Number(member.paidAmount || 0));
              }

              return (
                <div key={member.id || Math.random()} className="flex justify-between items-center bg-white dark:bg-[#111] p-2 rounded border border-slate-200 dark:border-[#222] text-xs transition-colors">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {member.username} {isReceiver ? "(Receiver/Payer)" : ""}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400">
                      {type === 'bill' 
                        ? `Days Active: ${member.daysPresent} / ${totalDays} days`
                        : `Split Share (${item.date || item.created_at?.split('T')[0] || 'One-time'})`
                      }
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
      )}
    </div>
  );
};
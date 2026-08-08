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
}

export const BillBreakdown = ({ breakdown, totalDays, paymentReceiverId }: BillBreakdownProps) => {
  return (
    <div className="mt-3 p-3 bg-[#181818] rounded-md border border-[#333] space-y-2">
      <p className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
        Member Share Breakdown ({breakdown.length} Participants)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {breakdown.map((member) => (
          <div key={member.id} className="flex justify-between items-center bg-[#111] p-2 rounded border border-[#222] text-xs">
            <div>
              <p className="font-semibold text-white">
                {member.username} {member.id === paymentReceiverId ? "(Receiver)" : ""}
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
  );
};
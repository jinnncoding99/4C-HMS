'use client';

interface ExpenseShare {
  id: string;
  username: string;
  role: string;
  shareDue: number;
  isPaid?: boolean;
  status?: string;
  paid_amount?: number;
}

interface ExpenseBreakdownProps {
  breakdown: ExpenseShare[];
  receiverId?: string;
}

export default function ExpenseBreakdown({ breakdown, receiverId }: ExpenseBreakdownProps) {
  return (
    <div className="mt-3 p-3.5 bg-slate-50 dark:bg-zinc-950/70 rounded-lg border border-slate-200 dark:border-zinc-800/80 space-y-2">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
        Participant Share Status & Deductions
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {breakdown.map((member) => {
          const remainingDue = Math.max(0, Number(member.shareDue) - Number(member.paid_amount || 0));
          const isReceiverMember = member.id === receiverId;
          const isPaidStatus = member.status === 'paid' || member.isPaid || remainingDue === 0;

          return (
            <div key={member.id} className="flex justify-between items-center bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs shadow-xs">
              <div>
                <span className="font-medium text-slate-800 dark:text-zinc-200 block">
                  {member.username} {isReceiverMember ? <span className="text-[#4B49AC] dark:text-amber-500 text-[10px] ml-1">(Receiver)</span> : ""}
                </span>
                {Number(member.paid_amount || 0) > 0 && (
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5">Paid: ₱{Number(member.paid_amount).toFixed(2)}</span>
                )}
              </div>
              <div className="text-right">
                <span className="font-bold text-[#4B49AC] dark:text-amber-400 block">
                  ₱{isPaidStatus ? '0.00' : remainingDue.toFixed(2)}
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-tight block mt-0.5 ${
                  isPaidStatus ? 'text-emerald-600 dark:text-emerald-400' :
                  member.status === 'pending_approval' ? 'text-[#4B49AC] dark:text-amber-400' :
                  'text-slate-400 dark:text-zinc-500'
                }`}>
                  {isPaidStatus ? 'paid' : (member.status || 'unpaid')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
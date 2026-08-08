"use client";

import { useEffect, useState } from "react";
// Updated to match your actual folder structure: my-app/supabase/client
import { createClient } from "../../lib/supabase/client";

export default function ApprovalList({ userId }: { userId: string }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchPending = async () => {
      // Fetch only expenses posted by the current user
      const { data } = await supabase
        .from("expenses")
        .select(`
          *,
          expense_splits (
            id,
            amount_due,
            is_approved,
            is_paid,
            payer:profiles(username)
          )
        `)
        .eq("poster_id", userId)
        .eq("status", "pending");
      
      if (data) setExpenses(data);
    };
    fetchPending();
  }, [userId, supabase]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">My Pending Requests</h3>
      {expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending requests.</p>
      ) : (
        expenses.map((expense) => (
          <div key={expense.id} className="p-4 border rounded-lg bg-card space-y-2">
            <div className="flex justify-between">
              <h4 className="font-semibold">{expense.description}</h4>
              <span className="text-sm text-muted-foreground">
                Total: ${parseFloat(expense.total_amount).toFixed(2)}
              </span>
            </div>
            
            <div className="space-y-1">
              {expense.expense_splits.map((split: any) => (
                <div key={split.id} className="flex justify-between text-sm">
                  <span>{split.payer?.username || "Unknown"}:</span>
                  <span className={split.is_approved ? "text-green-500" : "text-amber-500"}>
                    {split.is_approved ? "Approved" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
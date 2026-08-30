// components/dashboard/PendingExpenseApprovals.tsx
'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, XCircle, ExternalLink, Image as ImageIcon } from "lucide-react";

interface ExpensePaymentDetails {
  expense_id: string;
  user_id: string;
  receiver_id?: string;
  amount: string;
  method: string;
  receipt_url?: string | null;
}

interface ExpenseNotificationItem {
  id: string;
  type: string;
  email: string;
  message: string;
  status?: string;
  details?: ExpensePaymentDetails;
}

export default function PendingExpenseApprovals() {
  const [requests, setRequests] = useState<ExpenseNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("type", "expense_payment_approval")
      .eq("status", "pending");

    if (error) {
      console.error("Error fetching expense notifications:", error.message);
    } else if (data) {
      setRequests(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('pending-expense-approvals-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => { fetchRequests(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleApproval = async (notification: ExpenseNotificationItem, approved: boolean) => {
    const details = notification.details;
    if (!details || !details.expense_id || !details.user_id) {
      alert("Invalid expense notification metadata.");
      return;
    }

    const targetExpenseId = details.expense_id;

    try {
      const submittedAmount = Number(details.amount) || 0;

      if (approved) {
        const { data: expenseShare, error: shareError } = await supabase
          .from("expense_shares")
          .select("id, shared_amount, paid_amount, receipt_url, payment_method")
          .eq("expense_id", targetExpenseId)
          .eq("boarder_id", details.user_id)
          .maybeSingle();

        if (shareError || !expenseShare || !expenseShare.id) {
          throw new Error(`Could not find expense share record: ${shareError?.message}`);
        }

        const totalShareAmount = Number(expenseShare.shared_amount || 0);
        const existingPaidAmount = Number(expenseShare.paid_amount || 0);
        
        const amountToCredit = Math.min(submittedAmount, totalShareAmount - existingPaidAmount);
        const totalPaidSoFar = existingPaidAmount + amountToCredit;
        const remainingBalance = totalShareAmount - totalPaidSoFar;
        const isNowFullyPaid = remainingBalance <= 0;

        const { error: updateError } = await supabase
          .from("expense_shares")
          .update({
            is_paid: isNowFullyPaid,
            status: isNowFullyPaid ? 'paid' : 'partial',
            paid_amount: totalPaidSoFar,
            receipt_url: details.receipt_url || expenseShare.receipt_url,
            payment_method: details.method || expenseShare.payment_method || 'cash',
            approved_at: new Date().toISOString()
          })
          .eq("id", expenseShare.id);

        if (updateError) {
          throw new Error(`Failed to update expense share: ${updateError.message}`);
        }

      } else {
        const { data: expenseShare } = await supabase
          .from("expense_shares")
          .select("id")
          .eq("expense_id", targetExpenseId)
          .eq("boarder_id", details.user_id)
          .maybeSingle();

        if (expenseShare?.id) {
          const { error: rejectError } = await supabase
            .from("expense_shares")
            .update({
              status: 'unpaid',
              paid_amount: 0,
              receipt_url: null,
              is_paid: false
            })
            .eq("id", expenseShare.id);

          if (rejectError) {
            throw new Error(`Failed to reject expense payment: ${rejectError.message}`);
          }
        }
      }

      const { error: notifError } = await supabase
        .from("notifications")
        .update({ status: approved ? 'approved' : 'rejected' })
        .eq("id", notification.id);

      if (notifError) {
        throw new Error(`Failed to update notification status: ${notifError.message}`);
      }

      setRequests((prev) => prev.filter((req) => req.id !== notification.id));
      alert(approved ? "Expense payment approved successfully!" : "Expense payment rejected.");
      
      fetchRequests();
      router.refresh();
      window.dispatchEvent(new Event('expense-updated'));
      window.dispatchEvent(new Event('transaction-updated'));

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error processing expense approval:", errorMessage);
      alert("Action failed: " + errorMessage);
    }
  };

  if (loading || requests.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="w-full bg-[#1a1a1a] border border-[#ff8c00] text-white p-4 space-y-4 shadow-xl">
        <h3 className="text-md font-bold text-[#ff8c00]">Pending Expense Payment Approvals ({requests.length})</h3>
       
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="p-3 bg-[#111] border border-[#333] rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-white">{req.message}</p>
                <p className="text-gray-400">User Email: <span className="text-gray-200">{req.email}</span></p>
               
                {req.details?.receipt_url && (
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewImage(req.details?.receipt_url || null)}
                      className="inline-flex items-center gap-1 text-[#ff8c00] hover:underline cursor-pointer"
                    >
                      <ImageIcon size={14} /> Preview Receipt Image
                    </button>
                    <a
                      href={req.details.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <ExternalLink size={12} /> Open Full
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button 
                  onClick={() => handleApproval(req, true)}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3 cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle2 size={14} /> Approve
                </Button>
                <Button 
                  onClick={() => handleApproval(req, false)}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 px-3 cursor-pointer flex items-center gap-1"
                >
                  <XCircle size={14} /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {previewImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[99999]">
          <div className="relative max-w-2xl w-full bg-[#1a1a1a] p-4 rounded-2xl border border-[#ff8c00] space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-white">Receipt Verification Preview</h4>
              <button 
                onClick={() => setPreviewImage(null)}
                className="text-gray-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="bg-black/50 p-2 rounded-lg flex items-center justify-center max-h-[70vh] overflow-auto">
              <img src={previewImage} alt="Receipt Preview" className="max-h-[65vh] object-contain rounded-md" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
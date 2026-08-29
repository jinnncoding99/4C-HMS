// components/billing/PendingApprovals.tsx
'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, XCircle, ExternalLink, Image as ImageIcon } from "lucide-react";

interface PaymentDetails {
  bill_id?: string;
  user_id: string;
  receiver_id?: string;
  amount: string;
  method: string;
  receipt_url?: string | null;
  source_type?: string;
}

interface NotificationItem {
  id: string;
  type: string;
  email: string;
  message: string;
  status?: string;
  details?: PaymentDetails;
}

export default function PendingApprovals() {
  const [requests, setRequests] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("type", "payment_approval")
      .eq("status", "pending");

    if (error) {
      console.error("Error fetching notifications:", error.message);
    } else if (data) {
      setRequests(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('pending-approvals-realtime')
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

  const handleApproval = async (notification: NotificationItem, approved: boolean) => {
    const details = notification.details;
    if (!details || !details.bill_id || !details.user_id) {
      alert("Invalid notification metadata.");
      return;
    }

    const targetId = details.bill_id;

    try {
      const submittedAmount = Number(details.amount) || 0;

      if (approved) {
        // 1. Fetch payer's bill share row by unique identifiers
        const { data: payerShare, error: payerShareError } = await supabase
          .from("bill_shares")
          .select("id, shared_amount, amount, paid_amount, receipt_url, payment_method")
          .eq("bill_id", targetId)
          .eq("boarder_id", details.user_id)
          .maybeSingle();

        if (payerShareError || !payerShare || !payerShare.id) {
          throw new Error(`Could not find payer bill share record: ${payerShareError?.message}`);
        }

        const shareRowId = payerShare.id;

        // 2. Compute amounts securely
        const totalShareAmount = Number(payerShare.shared_amount || payerShare.amount || 0);
        const existingPaidAmount = Number(payerShare.paid_amount || 0);
        
        const amountToCreditToShare = Math.min(submittedAmount, totalShareAmount - existingPaidAmount);
        const totalPaidSoFar = existingPaidAmount + amountToCreditToShare;
        
        const remainingBalance = totalShareAmount - totalPaidSoFar;
        const isNowFullyPaid = remainingBalance <= 0;

        // 3. Update bill_shares using primary key .eq("id", shareRowId)
        const updatePayload = {
          is_paid: isNowFullyPaid,
          status: isNowFullyPaid ? 'paid' : 'partial',
          paid_amount: totalPaidSoFar,
          receipt_url: details.receipt_url || payerShare.receipt_url,
          payment_method: details.method || payerShare.payment_method || 'cash',
          approved_at: new Date().toISOString()
        };

        const { error: updatePayerError } = await supabase
          .from("bill_shares")
          .update(updatePayload)
          .eq("id", shareRowId);

        if (updatePayerError) {
          throw new Error(`Failed to update bill share: ${updatePayerError.message}`);
        }

        // 4. Fetch parent bill details and insert transaction using strictly valid schema columns
        const { data: billData } = await supabase
          .from("bills")
          .select("*")
          .eq("id", targetId)
          .maybeSingle();

        const transactionPayload = {
          original_bill_id: targetId,
          description: billData?.description || notification.message || "Approved Bill Payment",
          total_amount: submittedAmount,
          billing_period_start: billData?.billing_period_start || null,
          billing_period_end: billData?.billing_period_end || null,
          calculation_type: billData?.calculation_type || null,
          settled_at: new Date().toISOString(),
          url_receipt: details.receipt_url || null,
          payment_receiver_id: billData?.payment_receiver_id || details.receiver_id || null,
          payment_receiver: billData?.payment_receiver || null,
          payer_id: details.user_id || null,
          source_type: "Approve_bill_payment"
        };

        const { error: historyError } = await supabase
          .from("transaction_history")
          .insert([transactionPayload]);

        if (historyError) {
          throw new Error(`Failed to insert transaction history: ${historyError.message}`);
        }

      } else {
        // Rejection path
        const { data: payerShare } = await supabase
          .from("bill_shares")
          .select("id")
          .eq("bill_id", targetId)
          .eq("boarder_id", details.user_id)
          .maybeSingle();

        if (payerShare?.id) {
          const { error: rejectError } = await supabase
            .from("bill_shares")
            .update({
              status: 'unpaid',
              paid_amount: 0,
              receipt_url: null,
              is_paid: false
            })
            .eq("id", payerShare.id);

          if (rejectError) {
            throw new Error(`Failed to reject payment: ${rejectError.message}`);
          }
        }
      }

      // 5. Update Notification Status
      const { error: notifError } = await supabase
        .from("notifications")
        .update({ status: approved ? 'approved' : 'rejected' })
        .eq("id", notification.id);

      if (notifError) {
        throw new Error(`Failed to update notification status: ${notifError.message}`);
      }

      setRequests((prev) => prev.filter((req) => req.id !== notification.id));

      alert(approved ? "Payment approved successfully! Transaction recorded." : "Payment rejected.");
      
      fetchRequests();
      router.refresh();
      window.dispatchEvent(new Event('billing-updated'));
      window.dispatchEvent(new Event('transaction-updated'));

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error processing approval:", errorMessage);
      alert("Action failed: " + errorMessage);
    }
  };

  if (loading) {
    return <div className="text-xs text-gray-500 py-2">Loading pending requests...</div>;
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="w-full bg-[#1a1a1a] border border-[#ff8c00] text-white p-4 space-y-4 shadow-xl">
        <h3 className="text-md font-bold text-[#ff8c00]">Pending Payment Approvals ({requests.length})</h3>
       
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
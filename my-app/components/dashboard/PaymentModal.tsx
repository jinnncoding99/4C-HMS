// components/dashboard/PaymentModal.tsx
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { QrCode, CheckCircle2, AlertCircle, Loader2, Maximize2, X } from "lucide-react";
import { validateReceiptImage } from "./receiptValidator";
import { toast } from "sonner";

interface Profile {
  id: string;
  username: string;
  qr_code_url?: string | null;
}

interface Bill {
  id: string;
  description: string;
  total_amount: number;
  amount?: number;
  billing_period_start?: string;
  billing_period_end?: string;
  calculation_type?: string;
  payment_receiver_id?: string;
}

interface PaymentModalProps {
  bill: Bill;
  shareDue: number;
  receiverProfile: Profile | null;
  isDirectSettlement?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ 
  bill, 
  shareDue, 
  receiverProfile, 
  isDirectSettlement = false, 
  onClose, 
  onSuccess 
}: PaymentModalProps) {
  const safeShareDue = shareDue ?? 0;

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('online');
  const [paymentAmount, setPaymentAmount] = useState<string>(safeShareDue.toFixed(2));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Validation States
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isReceiptValid, setIsReceiptValid] = useState<boolean>(false);
  const [validationMessage, setValidationMessage] = useState<string>("");

  const supabase = createClient();

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      setIsReceiptValid(false);
      setValidationMessage("");
      return;
    }

    if (!file.type.startsWith('image/')) {
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      setIsReceiptValid(false);
      setValidationMessage("Invalid file type. Please upload a valid image file (PNG, JPG, JPEG).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      setIsReceiptValid(false);
      setValidationMessage("File size is too large. Please upload an image smaller than 5MB.");
      return;
    }

    setReceiptFile(file);
    setReceiptPreviewUrl(URL.createObjectURL(file));
    setIsReceiptValid(false);
    setIsScanning(true);
    setValidationMessage("Scanning receipt image with OCR...");

    try {
      const result = await validateReceiptImage(file, {
        expectedAmount: Number(paymentAmount),
        expectedRecipient: receiverProfile?.username || undefined
      });

      setIsScanning(false);
      setIsReceiptValid(result.isValid);

      if (result.isValid) {
        setValidationMessage(`Receipt verified successfully! (Confidence: ${Math.round(result.confidence)}%)`);
      } else {
        setReceiptFile(null);
        setReceiptPreviewUrl(null);
        setValidationMessage(result.errors.join(' ') || "Invalid receipt image detected. Please upload a genuine transaction receipt.");
      }
    } catch (error) {
      setIsScanning(false);
      setIsReceiptValid(false);
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      setValidationMessage("An error occurred while scanning the receipt.");
      console.error("OCR validation handler error:", error);
    }
  };

  const submitPaymentRequest = async () => {
    const parsedAmount = Number(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    if (parsedAmount > safeShareDue) {
      toast.error("Payment amount cannot exceed your total share due.");
      return;
    }

    if (paymentMethod === 'online' && (!receiptFile || !isReceiptValid)) {
      toast.error("Submission blocked: Please attach a valid receipt image containing transaction details.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Auth check
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) console.error("Session error:", sessionError);
      
      let user = session?.user;

      if (!user) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          throw new Error("Not authenticated. Please log in again.");
        }
        user = userData.user;
      }

      let receiptUrl: string | null = null;

      // 2. Storage upload check
      if (paymentMethod === 'online' && receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile);

        if (uploadError) {
          console.error("Storage upload failed:", uploadError);
          throw new Error(`Storage upload failed: ${uploadError.message || JSON.stringify(uploadError)}`);
        }

        const { data: publicURLData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);
        receiptUrl = publicURLData.publicUrl;
      }

      // 3. Database operations check
      if (isDirectSettlement) {
        // Insert into history log first with source_type: 'other' to show under Other Transactions
        const { error: historyError } = await supabase.from('transaction_history').insert([{
          source_type: 'other',
          type: paymentMethod,
          original_bill_id: bill.id,
          description: bill.description,
          total_amount: bill.total_amount ?? bill.amount ?? parsedAmount,
          billing_period_start: bill.billing_period_start || null,
          billing_period_end: bill.billing_period_end || null,
          calculation_type: bill.calculation_type || null,
          settled_at: new Date().toISOString(),
          url_receipt: receiptUrl,
          payment_receiver: receiverProfile?.username || null,
          payment_receiver_id: bill.payment_receiver_id || receiverProfile?.id || null
        }]);

        if (historyError) {
          console.error("Failed to write to transaction_history:", JSON.stringify(historyError, null, 2));
        }

        const { error: deleteBillError } = await supabase
          .from('bills')
          .delete()
          .eq('id', bill.id);

        if (deleteBillError) {
          console.error("bills delete failed:", deleteBillError);
          throw new Error(`Database cleanup failed: ${deleteBillError.message || JSON.stringify(deleteBillError)}`);
        }

        toast.success("Bill successfully settled and removed!");
      } else {
        const notificationPayload = {
          type: 'payment_approval',
          email: user.email || 'User',
          message: `Payment submitted for bill: ${bill.description} via ${paymentMethod.toUpperCase()} amount: ₱${parsedAmount.toFixed(2)}`,
          status: 'pending',
          details: {
            bill_id: bill.id,
            user_id: user.id,
            receiver_id: bill.payment_receiver_id || null,
            amount: parsedAmount,
            method: paymentMethod,
            receipt_url: receiptUrl,
            source_type: 'other'
          }
        };

        const { error: notifError } = await supabase.from('notifications').insert([notificationPayload]);
        if (notifError) {
          console.error("Notifications insert failed:", notifError);
          throw new Error(`Notification insert failed: ${notifError.message || JSON.stringify(notifError)}`);
        }

        const { error: shareError } = await supabase
          .from('bill_shares')
          .update({ 
            status: 'pending_approval',
            payment_method: paymentMethod,
            paid_amount: parsedAmount,
            receipt_url: receiptUrl
          })
          .eq('bill_id', bill.id)
          .eq('boarder_id', user.id);

        if (shareError) {
          console.error("bill_shares pending update failed:", shareError);
          throw new Error(`Bill share update failed: ${shareError.message || JSON.stringify(shareError)}`);
        }

        toast.success("Payment request successfully submitted for approval!");
      }

      onSuccess();
    } catch (err: unknown) {
      console.error("Caught error in submitPaymentRequest:", err);
      
      let errorMessage = "An unexpected error occurred";
      if (err instanceof Error && err.message) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = (err as any).message || (err as any).error_description || (err as any).details || JSON.stringify(err);
      } else {
        errorMessage = String(err);
      }

      toast.error("Failed to process payment: " + errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 text-slate-800 dark:text-zinc-100 shadow-2xl pb-12">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {isDirectSettlement ? "Settle Bill Directly" : "Submit Payment"}
          </h3>
          {isDirectSettlement && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
              Instant Clearance
            </span>
          )}
        </div>
        
        <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-medium">Payment Receiver</p>
          <p className="font-bold text-[#4B49AC] dark:text-amber-500 text-base">{receiverProfile?.username || 'Receiver'}</p>
          
          {receiverProfile?.qr_code_url ? (
            <img src={receiverProfile.qr_code_url} alt="QR Code" className="w-32 h-32 mx-auto rounded-lg border border-slate-200 dark:border-zinc-800 object-contain bg-white p-1" />
          ) : (
            <div className="w-32 h-32 mx-auto bg-slate-100 dark:bg-zinc-800/50 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-zinc-700 text-slate-400 dark:text-zinc-500">
              <QrCode size={36} className="text-[#4B49AC] dark:text-amber-500 mb-1" />
              <span className="text-[10px]">No QR Uploaded</span>
            </div>
          )}
        </div>

        {/* Editable Amount Field for Partial Payments / Full Settlement */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <span>Payment Amount (₱)</span>
            <span>Max Due: ₱{safeShareDue.toFixed(2)}</span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₱</span>
            <input 
              type="number"
              step="0.01"
              max={safeShareDue}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#4B49AC] dark:focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-600 dark:text-zinc-300 font-medium">Payment Option</label>
          <div className="flex gap-2">
            <Button 
              type="button" 
              onClick={() => setPaymentMethod('online')} 
              className={`flex-1 cursor-pointer transition-all shadow-none ${
                paymentMethod === 'online' 
                  ? 'bg-[#4B49AC] dark:bg-amber-500 text-white dark:text-black font-bold hover:opacity-90' 
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Online Payment
            </Button>
            <Button 
              type="button" 
              onClick={() => {
                setPaymentMethod('cash');
                setReceiptFile(null);
                setReceiptPreviewUrl(null);
                setIsReceiptValid(false);
                setValidationMessage("");
              }} 
              className={`flex-1 cursor-pointer transition-all shadow-none ${
                paymentMethod === 'cash' 
                  ? 'bg-[#4B49AC] dark:bg-amber-500 text-white dark:text-black font-bold hover:opacity-90' 
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Cash Payment
            </Button>
          </div>
        </div>

        {paymentMethod === 'online' && (
          <div className="space-y-2">
            <label className="text-xs text-slate-600 dark:text-zinc-300 font-medium flex justify-between">
              <span>Upload Receipt Screenshot</span>
              <span className="text-red-500 dark:text-red-400 text-[10px]">*Required (GCash / Maya / Bank)</span>
            </label>
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#4B49AC] dark:file:bg-amber-500 file:text-white dark:file:text-black hover:file:opacity-90 cursor-pointer bg-slate-50 dark:bg-zinc-900 p-2 rounded-md border border-slate-200 dark:border-zinc-800"
              />
              {receiptPreviewUrl && (
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 transition-colors shrink-0"
                  title="Preview Receipt"
                >
                  <Maximize2 size={16} />
                </button>
              )}
            </div>
            
            {validationMessage && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                isScanning 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                  : isReceiptValid 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
              }`}>
                {isScanning ? (
                  <>
                    <Loader2 size={16} className="shrink-0 text-blue-500 dark:text-blue-400 animate-spin" />
                    <span>{validationMessage}</span>
                  </>
                ) : isReceiptValid ? (
                  <>
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
                    <span>{validationMessage}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="shrink-0 text-red-500 dark:text-red-400" />
                    <span>{validationMessage}</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button 
            onClick={submitPaymentRequest} 
            disabled={submitting || isScanning || (paymentMethod === 'online' && (!isReceiptValid || !receiptFile))} 
            className="flex-1 bg-[#4B49AC] dark:bg-amber-500 hover:opacity-90 disabled:opacity-50 text-white dark:text-black font-bold cursor-pointer transition-all shadow-none"
          >
            {submitting ? "Processing..." : isScanning ? "Verifying..." : isDirectSettlement ? "Settle & Clear Bill" : "Confirm & Submit"}
          </Button>
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Lightbox Modal for Receipt Preview */}
      {isLightboxOpen && receiptPreviewUrl && (
        <div className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-4">
          <button 
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={24} />
          </button>
          <img 
            src={receiptPreviewUrl} 
            alt="Receipt Full Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg border border-zinc-700" 
          />
        </div>
      )}
    </div>
  );
}
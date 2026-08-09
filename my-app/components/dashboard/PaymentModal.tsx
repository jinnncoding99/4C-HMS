// components/dashboard/PaymentModal.tsx
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { QrCode, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { validateReceiptImage } from "./receiptValidator";

interface Profile {
  id: string;
  username: string;
  qr_code_url?: string | null;
}

interface Bill {
  id: string;
  description: string;
  total_amount: number;
  payment_receiver_id?: string;
}

interface PaymentModalProps {
  bill: Bill;
  shareDue: number;
  receiverProfile: Profile | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ bill, shareDue, receiverProfile, onClose, onSuccess }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('online');
  const [paymentAmount, setPaymentAmount] = useState(shareDue.toFixed(2));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Validation States
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isReceiptValid, setIsReceiptValid] = useState<boolean>(false);
  const [validationMessage, setValidationMessage] = useState<string>("");

  const supabase = createClient();

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setReceiptFile(null);
      setIsReceiptValid(false);
      setValidationMessage("");
      return;
    }

    // 1. Validate image type immediately
    if (!file.type.startsWith('image/')) {
      setReceiptFile(null);
      setIsReceiptValid(false);
      setValidationMessage("Invalid file type. Please upload a valid image file (PNG, JPG, JPEG).");
      return;
    }

    // 2. Validate file size limit (5MB) immediately
    if (file.size > 5 * 1024 * 1024) {
      setReceiptFile(null);
      setIsReceiptValid(false);
      setValidationMessage("File size is too large. Please upload an image smaller than 5MB.");
      return;
    }

    // Set file temporarily while scanning
    setReceiptFile(file);
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
        // If OCR validation fails, nullify the receiptFile so it's treated as no valid file uploaded
        setReceiptFile(null);
        setValidationMessage(result.errors.join(' ') || "Invalid receipt image detected. Please upload a genuine transaction receipt.");
      }
    } catch (error) {
      setIsScanning(false);
      setIsReceiptValid(false);
      setReceiptFile(null);
      setValidationMessage("An error occurred while scanning the receipt.");
      console.error("OCR validation handler error:", error);
    }
  };

  const submitPaymentRequest = async () => {
    if (paymentMethod === 'online') {
      if (!receiptFile || !isReceiptValid) {
        alert("Submission blocked: Please attach a valid receipt image containing transaction details.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let receiptUrl: string | null = null;

      if (paymentMethod === 'online' && receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile);

        if (uploadError) throw uploadError;

        const { data: publicURLData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);
        receiptUrl = publicURLData.publicUrl;
      }

      const notificationPayload = {
        type: 'payment_approval',
        email: user.email || 'User',
        message: `Payment submitted for bill: ${bill.description} via ${paymentMethod.toUpperCase()} amount: ₱${Number(paymentAmount).toFixed(2)}`,
        status: 'pending',
        details: {
          bill_id: bill.id,
          user_id: user.id,
          receiver_id: bill.payment_receiver_id || null,
          amount: paymentAmount,
          method: paymentMethod,
          receipt_url: receiptUrl
        }
      };

      const { error: notifError } = await supabase.from('notifications').insert([notificationPayload]);
      if (notifError) throw notifError;

      await supabase
        .from('bill_shares')
        .update({ 
          status: 'pending_approval',
          payment_method: paymentMethod,
          paid_amount: Number(paymentAmount),
          receipt_url: receiptUrl
        })
        .eq('bill_id', bill.id)
        .eq('boarder_id', user.id);

      alert("Payment request successfully submitted for approval!");
      onSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error submitting payment:", errorMessage);
      alert("Failed to submit payment request: " + errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 text-white shadow-2xl pb-12">
        <h3 className="text-lg font-bold">Submit Payment</h3>
        
        <div className="bg-[#111] p-3 rounded-xl border border-[#333] text-center space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Payment Receiver</p>
          <p className="font-bold text-[#ff8c00] text-base">{receiverProfile?.username || 'Receiver'}</p>
          
          {receiverProfile?.qr_code_url ? (
            <img src={receiverProfile.qr_code_url} alt="QR Code" className="w-32 h-32 mx-auto rounded-lg border border-[#ff8c00]" />
          ) : (
            <div className="w-32 h-32 mx-auto bg-[#222] flex flex-col items-center justify-center rounded-lg border border-dashed border-[#555] text-gray-500">
              <QrCode size={36} className="text-[#ff8c00] mb-1" />
              <span className="text-[10px]">No QR Uploaded</span>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-gray-400">Your Share Due Amount:</p>
          <p className="text-xl font-bold text-white">₱{Number(paymentAmount).toFixed(2)}</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-300">Payment Option</label>
          <div className="flex gap-2">
            <Button 
              type="button" 
              onClick={() => setPaymentMethod('online')} 
              className={`flex-1 cursor-pointer ${paymentMethod === 'online' ? 'bg-[#ff8c00] text-black font-bold' : 'bg-[#222] text-gray-300'}`}
            >
              Online Payment
            </Button>
            <Button 
              type="button" 
              onClick={() => {
                setPaymentMethod('cash');
                setReceiptFile(null);
                setIsReceiptValid(false);
                setValidationMessage("");
              }} 
              className={`flex-1 cursor-pointer ${paymentMethod === 'cash' ? 'bg-[#ff8c00] text-black font-bold' : 'bg-[#222] text-gray-300'}`}
            >
              Cash Payment
            </Button>
          </div>
        </div>

        {paymentMethod === 'online' && (
          <div className="space-y-2">
            <label className="text-xs text-gray-300 flex justify-between">
              <span>Upload Receipt Screenshot</span>
              <span className="text-red-400 text-[10px]">*Required (GCash / Maya / Bank)</span>
            </label>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#ff8c00] file:text-black hover:file:bg-[#e67e00] cursor-pointer bg-[#111] p-2 rounded-md border border-[#333]"
            />
            
            {validationMessage && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                isScanning 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : isReceiptValid 
                    ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                {isScanning ? (
                  <>
                    <Loader2 size={16} className="shrink-0 text-blue-400 animate-spin" />
                    <span>{validationMessage}</span>
                  </>
                ) : isReceiptValid ? (
                  <>
                    <CheckCircle2 size={16} className="shrink-0 text-green-400" />
                    <span>{validationMessage}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="shrink-0 text-red-400" />
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
            className="flex-1 bg-[#ff8c00] hover:bg-[#e67e00] disabled:opacity-50 text-black font-bold cursor-pointer"
          >
            {submitting ? "Submitting..." : isScanning ? "Verifying..." : "Confirm & Submit"}
          </Button>
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="text-gray-400 hover:text-white cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
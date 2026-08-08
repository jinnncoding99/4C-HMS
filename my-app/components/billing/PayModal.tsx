import React from 'react';
import { Button } from '@/components/ui/button';
import { QrCode } from 'lucide-react';

interface PayModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiverProfile: any;
  paymentAmount: number;
  paymentMethod: 'online' | 'cash';
  setPaymentMethod: (method: 'online' | 'cash') => void;
  setReceiptFile: (file: File | null) => void;
  submitting: boolean;
  onSubmit: () => void;
}

export const PayModal = ({
  isOpen,
  onClose,
  receiverProfile,
  paymentAmount,
  paymentMethod,
  setPaymentMethod,
  setReceiptFile,
  submitting,
  onSubmit,
}: PayModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 text-white shadow-2xl pb-12">
        <h3 className="text-lg font-bold">Submit Payment</h3>

        <div className="bg-[#111] p-3 rounded-xl border border-[#333] text-center space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Payment Receiver</p>
          <p className="font-bold text-[#ff8c00] text-base">{receiverProfile?.username}</p>

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
          <label className="text-xs text-gray-400">Payment Method</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('online')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                paymentMethod === 'online'
                  ? 'bg-[#ff8c00] text-black border-[#ff8c00]'
                  : 'bg-[#111] text-white border-[#333] hover:border-[#ff8c00]'
              }`}
            >
              Online Payment (QR)
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentMethod('cash');
                setReceiptFile(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'bg-[#ff8c00] text-black border-[#ff8c00]'
                  : 'bg-[#111] text-white border-[#333] hover:border-[#ff8c00]'
              }`}
            >
              Cash Payment
            </button>
          </div>
        </div>

        {paymentMethod === 'online' && (
          <div className="space-y-2">
            <label className="text-xs text-gray-400">
              Upload Receipt Screenshot <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setReceiptFile(e.target.files[0]);
                }
              }}
              className="w-full text-xs text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#ff8c00] file:text-black hover:file:bg-[#e67e00] file:cursor-pointer bg-[#111] border border-[#333] rounded-lg p-2 cursor-pointer"
            />
            <p className="text-[10px] text-gray-500">Please provide proof of payment via QR transfer to complete verification.</p>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            className="flex-1 bg-[#222] hover:bg-[#333] text-white font-bold text-xs h-10 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting}
            onClick={onSubmit}
            className="flex-1 bg-[#ff8c00] hover:bg-[#e67e00] text-black font-bold text-xs h-10 cursor-pointer"
          >
            {submitting ? "Submitting..." : "Submit Payment"}
          </Button>
        </div>
      </div>
    </div>
  );
};
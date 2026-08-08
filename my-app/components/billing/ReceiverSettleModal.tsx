import React from 'react';
import { Button } from '@/components/ui/button';

interface ReceiverSettleModalProps {
  settlingBill: any;
  settleMethod: 'cash' | 'online';
  setSettleMethod: (method: 'cash' | 'online') => void;
  setSettleReceiptFile: (file: File | null) => void;
  settlingSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export const ReceiverSettleModal = ({
  settlingBill,
  settleMethod,
  setSettleMethod,
  setSettleReceiptFile,
  settlingSubmitting,
  onClose,
  onSubmit,
}: ReceiverSettleModalProps) => {
  if (!settlingBill) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 text-white shadow-2xl pb-12">
        <h3 className="text-lg font-bold">Settle Bill Payment</h3>
        <p className="text-xs text-gray-400">
          Choose how you handled the final payment for{' '}
          <span className="text-white font-semibold">{settlingBill.description}</span>.
        </p>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Settlement Method</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSettleMethod('cash');
                setSettleReceiptFile(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                settleMethod === 'cash'
                  ? 'bg-[#ff8c00] text-black border-[#ff8c00]'
                  : 'bg-[#111] text-white border-[#333] hover:border-[#ff8c00]'
              }`}
            >
              Cash Settlement
            </button>
            <button
              type="button"
              onClick={() => setSettleMethod('online')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                settleMethod === 'online'
                  ? 'bg-[#ff8c00] text-black border-[#ff8c00]'
                  : 'bg-[#111] text-white border-[#333] hover:border-[#ff8c00]'
              }`}
            >
              Online Settlement (QR)
            </button>
          </div>
        </div>

        {settleMethod === 'online' && (
          <div className="space-y-2">
            <label className="text-xs text-gray-400">
              Upload Receipt Screenshot / Proof <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSettleReceiptFile(e.target.files[0]);
                }
              }}
              className="w-full text-xs text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#ff8c00] file:text-black hover:file:bg-[#e67e00] file:cursor-pointer bg-[#111] border border-[#333] rounded-lg p-2 cursor-pointer"
            />
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
            disabled={settlingSubmitting}
            onClick={onSubmit}
            className="flex-1 bg-[#ff8c00] hover:bg-[#e67e00] text-black font-bold text-xs h-10 cursor-pointer"
          >
            {settlingSubmitting ? "Processing..." : "Confirm Settlement"}
          </Button>
        </div>
      </div>
    </div>
  );
};
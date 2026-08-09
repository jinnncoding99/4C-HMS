// components/expense/ExpenseModals.tsx
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode } from "lucide-react";
import ExpenseForm from "./ExpenseForm";

export function SettleModal({
  settlingExpense,
  settleMethod,
  setSettleMethod,
  setSettleReceiptFile,
  settlingSubmitting,
  handleSettleExpenseAsReceiver,
  onClose,
}: any) {
  if (!settlingExpense) return null;
  
  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white dark:bg-[#18181b] p-6 rounded-xl border border-slate-200 dark:border-zinc-800 w-full max-w-md space-y-4 text-slate-900 dark:text-zinc-100 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">Settle Bill Payment</h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400">Choose how you handled the final payment for <span className="text-slate-900 dark:text-white font-semibold">{settlingExpense.description}</span>.</p>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Settlement Method</label>
          <div className="flex gap-2">
            <Button 
              type="button" 
              onClick={() => { setSettleMethod('cash'); setSettleReceiptFile(null); }} 
              className={`flex-1 ${settleMethod === 'cash' ? 'bg-[#4B49AC] hover:bg-[#3f3de9] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-zinc-950 font-semibold' : 'bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'}`}
            >
              Cash
            </Button>
            <Button 
              type="button" 
              onClick={() => setSettleMethod('online')} 
              className={`flex-1 ${settleMethod === 'online' ? 'bg-[#4B49AC] hover:bg-[#3f3de9] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-zinc-950 font-semibold' : 'bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'}`}
            >
              Online (QR)
            </Button>
          </div>
        </div>

        {settleMethod === 'online' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Upload Receipt Proof <span className="text-[#4B49AC] dark:text-amber-400">*</span></label>
            <Input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setSettleReceiptFile(e.target.files?.[0] || null)} 
              className="bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" 
            />
          </div>
        )}

        <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <Button 
            disabled={settlingSubmitting} 
            onClick={handleSettleExpenseAsReceiver} 
            className="flex-1 bg-[#4B49AC] hover:bg-[#3f3de9] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-zinc-950 font-semibold"
          >
            {settlingSubmitting ? "Processing..." : "Confirm"}
          </Button>
          <Button onClick={onClose} variant="outline" className="border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EditExpenseModal({ editingExpense, onSuccess, onCancel }: any) {
  if (!editingExpense) return null;
  
  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white dark:bg-[#18181b] p-6 rounded-xl border border-slate-200 dark:border-zinc-800 w-full max-w-lg space-y-4 text-slate-900 dark:text-zinc-100 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">Edit Expense Form</h3>
        <ExpenseForm initialData={editingExpense} onSuccess={onSuccess} onCancel={onCancel} />
      </div>
    </div>
  );
}

export function PayShareModal({
  selectedExpenseForPay,
  receiverProfile,
  paymentMethod,
  setPaymentMethod,
  paymentAmount,
  setPaymentAmount,
  setReceiptFile,
  submitting,
  submitPaymentRequest,
  onClose,
}: any) {
  if (!selectedExpenseForPay) return null;
  
  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white dark:bg-[#18181b] p-6 rounded-xl border border-slate-200 dark:border-zinc-800 w-full max-w-md space-y-4 text-slate-900 dark:text-zinc-100 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3">Submit Payment & Receipt</h3>
        
        <div className="bg-slate-50 dark:bg-zinc-900/80 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 text-center space-y-2">
          <span className="text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-medium">Payment Receiver</span>
          <p className="font-bold text-[#4B49AC] dark:text-amber-400 text-base">
            {receiverProfile?.username || receiverProfile?.full_name || "Assigned Receiver"}
          </p>
          {receiverProfile?.qr_code_url ? (
            <img 
              src={receiverProfile.qr_code_url} 
              alt="QR Code" 
              className="w-32 h-32 mx-auto rounded-lg border border-[#4B49AC]/40 dark:border-amber-500/40 object-contain bg-white p-1.5" 
            />
          ) : (
            <div className="w-32 h-32 mx-auto bg-slate-100 dark:bg-zinc-950 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-zinc-700 text-slate-400 dark:text-zinc-500">
              <QrCode className="h-8 w-8 text-[#4B49AC] dark:text-amber-500 mb-1" />
              <span className="text-[10px]">No QR Available</span>
            </div>
          )}
        </div>

        <div>
          <span className="text-xs text-slate-500 dark:text-zinc-400">Remaining Share Due:</span>
          <p className="text-lg font-bold text-slate-900 dark:text-white">₱{Number(paymentAmount).toFixed(2)}</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Payment Method</label>
          <div className="flex gap-2">
            <Button 
              type="button" 
              onClick={() => setPaymentMethod('online')} 
              className={`flex-1 ${paymentMethod === 'online' ? 'bg-[#4B49AC] hover:bg-[#3f3de9] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-zinc-950 font-semibold' : 'bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'}`}
            >
              Online
            </Button>
            <Button 
              type="button" 
              onClick={() => { setPaymentMethod('cash'); setReceiptFile(null); }} 
              className={`flex-1 ${paymentMethod === 'cash' ? 'bg-[#4B49AC] hover:bg-[#3f3de9] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-zinc-950 font-semibold' : 'bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'}`}
            >
              Cash
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Amount to Pay</label>
          <Input 
            type="number" 
            step="0.01" 
            value={paymentAmount} 
            onChange={(e) => setPaymentAmount(e.target.value)} 
            className="bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white" 
          />
        </div>

        {paymentMethod === 'online' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Upload Receipt Proof <span className="text-[#4B49AC] dark:text-amber-400">*</span></label>
            <Input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} 
              className="bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white" 
            />
          </div>
        )}

        <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <Button 
            onClick={submitPaymentRequest} 
            disabled={submitting} 
            className="flex-1 bg-[#4B49AC] hover:bg-[#3f3de9] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-zinc-950 font-semibold"
          >
            {submitting ? "Submitting..." : "Submit Payment"}
          </Button>
          <Button onClick={onClose} variant="outline" className="border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
// components/billing/BillModals.tsx
'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import BillForm from './BillForm';

interface AddBillDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddBillDialog = ({ isOpen, setIsOpen, onSuccess }: AddBillDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
  <Button className="bg-[#4B49AC] hover:bg-[#3f3de9] dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-zinc-950 font-semibold transition-all shadow-sm rounded-full px-4 h-9">
    <Plus className="h-4 w-4 mr-1.5" />
    Add New Bill
  </Button>
</DialogTrigger>
      <DialogContent className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#ff8c00] text-slate-900 dark:text-white w-[95%] max-w-2xl max-h-[85vh] overflow-y-auto p-6 pb-12 rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Post New Bill Entry</DialogTitle>
        </DialogHeader>
        <div className="mt-2 pb-6">
          <BillForm 
            onSuccess={() => { 
              setIsOpen(false); 
              onSuccess(); 
            }} 
            onCancel={() => setIsOpen(false)} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface EditBillModalProps {
  editingBill: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditBillModal = ({ editingBill, onClose, onSuccess }: EditBillModalProps) => {
  if (!editingBill) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#ff8c00] w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4 text-slate-900 dark:text-white shadow-2xl pb-12">
        <h3 className="text-lg font-bold">Edit Bill Entry</h3>
        <div className="mt-2 pb-6">
          <BillForm 
            initialData={editingBill} 
            onSuccess={() => { 
              onClose(); 
              onSuccess(); 
            }} 
            onCancel={onClose} 
          />
        </div>
      </div>
    </div>
  );
};

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
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl border border-slate-200 dark:border-[#ff8c00] w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 text-slate-900 dark:text-white shadow-2xl pb-12">
        <h3 className="text-lg font-bold">Settle Bill Manually</h3>
        <p className="text-xs text-slate-500 dark:text-gray-400">
          Marking bill: <span className="text-slate-900 dark:text-white font-semibold">{settlingBill.description}</span>
        </p>

        <div className="space-y-2">
          <label className="text-xs text-slate-700 dark:text-gray-300 font-medium">Settlement Method</label>
          <div className="flex gap-2">
            <Button 
              type="button" 
              onClick={() => {
                setSettleMethod('cash');
                setSettleReceiptFile(null);
              }} 
              className={`flex-1 cursor-pointer transition-colors ${
                settleMethod === 'cash' 
                  ? 'bg-[#4B49AC] hover:bg-[#3f3dc9] dark:bg-[#ff8c00] dark:hover:bg-[#e67e00] text-white dark:text-black font-bold' 
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#222] dark:hover:bg-[#2a2a2a] text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-transparent'
              }`}
            >
              Cash
            </Button>
            <Button 
              type="button" 
              onClick={() => setSettleMethod('online')} 
              className={`flex-1 cursor-pointer transition-colors ${
                settleMethod === 'online' 
                  ? 'bg-[#4B49AC] hover:bg-[#3f3dc9] dark:bg-[#ff8c00] dark:hover:bg-[#e67e00] text-white dark:text-black font-bold' 
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#222] dark:hover:bg-[#2a2a2a] text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-transparent'
              }`}
            >
              Online
            </Button>
          </div>
        </div>

        {settleMethod === 'online' && (
          <div className="space-y-2">
            <label className="text-xs text-slate-700 dark:text-gray-300 font-medium">Upload Proof of Receipt (Optional)</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => setSettleReceiptFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#4B49AC] hover:file:bg-[#3f3dc9] dark:file:bg-[#ff8c00] dark:hover:file:bg-[#e67e00] file:text-white dark:file:text-black cursor-pointer bg-slate-50 dark:bg-[#111] p-2 rounded-md border border-slate-200 dark:border-[#333]"
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button 
            onClick={onSubmit} 
            disabled={settlingSubmitting}
            className="flex-1 bg-[#4B49AC] hover:bg-[#3f3dc9] dark:bg-[#ff8c00] dark:hover:bg-[#e67e00] disabled:opacity-50 text-white dark:text-black font-bold cursor-pointer"
          >
            {settlingSubmitting ? "Processing..." : "Confirm Settlement"}
          </Button>
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
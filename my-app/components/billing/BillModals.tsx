// components/billing/BillModals.tsx
import React from 'react';
import { PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
        <span className="inline-flex items-center justify-center bg-[#ff8c00] hover:bg-[#e67e00] text-black font-bold p-2 sm:px-4 sm:py-2 rounded-md cursor-pointer text-sm">
          <span className="sm:hidden flex items-center justify-center">
            <PlusCircle size={18} />
          </span>
          <span className="hidden sm:inline">Add New Bill</span>
        </span>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1a1a] border border-[#ff8c00] text-white w-[95%] max-w-2xl max-h-[85vh] overflow-y-auto p-6 pb-12 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Post New Bill Entry</DialogTitle>
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4 text-white shadow-2xl pb-12">
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
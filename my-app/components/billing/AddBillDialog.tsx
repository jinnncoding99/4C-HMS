import React from 'react';
import { PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface AddBillDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSuccess: () => void;
  BillFormComponent: React.ComponentType<{ onSuccess: () => void; onCancel: () => void }>;
}

export const AddBillDialog = ({
  isOpen,
  setIsOpen,
  onSuccess,
  BillFormComponent,
}: AddBillDialogProps) => {
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
          <BillFormComponent 
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
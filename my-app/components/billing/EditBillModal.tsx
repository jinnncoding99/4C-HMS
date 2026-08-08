import React from 'react';

interface EditBillModalProps {
  editingBill: any;
  onClose: () => void;
  onSuccess: () => void;
  BillFormComponent: React.ComponentType<{ initialData: any; onSuccess: () => void; onCancel: () => void }>;
}

export const EditBillModal = ({
  editingBill,
  onClose,
  onSuccess,
  BillFormComponent,
}: EditBillModalProps) => {
  if (!editingBill) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4 text-white shadow-2xl pb-12">
        <h3 className="text-lg font-bold">Edit Bill Entry</h3>
        <div className="mt-2 pb-6">
          <BillFormComponent 
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
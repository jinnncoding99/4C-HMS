// components/expense/ExpenseForm.tsx
'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ExpenseItem {
  id?: string;
  description?: string;
  title?: string;
  total_amount?: number;
  amount?: number;
  expense_date?: string | null;
  date?: string | null;
  category?: string;
  payment_receiver_id?: string | null;
  payment_receiver?: string | null;
}

interface Profile {
  id: string;
  email: string;
  username: string;
}

interface ExpenseFormProps {
  initialData?: ExpenseItem;
  profiles?: Profile[];
  currentUserId?: string;
  currentReceiverName?: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function ExpenseForm({ 
  initialData, 
  profiles: propProfiles, 
  currentUserId, 
  currentReceiverName, 
  onSuccess, 
  onCancel 
}: ExpenseFormProps) {
  const isEditing = !!initialData?.id;
  const router = useRouter();
  
  const [profiles, setProfiles] = useState<Profile[]>(propProfiles || []);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [shareMode, setShareMode] = useState<"all" | "custom">("all");
  const [loading, setLoading] = useState(false);
  
  const [authUserId, setAuthUserId] = useState<string | null>(currentUserId || null);
  const [authUserName, setAuthUserName] = useState<string | null>(currentReceiverName || null);
  
  const initialDateVal = initialData?.expense_date || initialData?.date || "";
  const initialAmountVal = initialData?.total_amount ?? initialData?.amount ?? "";

  const [formData, setFormData] = useState({
    description: initialData?.description || initialData?.title || "",
    expenseDate: initialDateVal ? initialDateVal.split('T')[0] : "",
    amount: initialAmountVal !== "" ? String(initialAmountVal) : "",
    receiverId: initialData?.payment_receiver_id || "",
    category: initialData?.category || "Food",
  });

  const supabase = createClient();
  const inputStyles = "w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white rounded-md p-2 text-sm focus:border-[#4B49AC] dark:focus:border-[#ff8c00] focus:ring-1 focus:ring-[#4B49AC] dark:focus:ring-[#ff8c00] outline-none transition-all";

  useEffect(() => {
    const fetchData = async () => {
      if (!authUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setAuthUserId(user.id);
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single();
          
          if (userProfile) {
            setAuthUserName(userProfile.username);
          }
        }
      }

      let profileData = propProfiles;
      if (!profileData || profileData.length === 0) {
        const { data } = await supabase.from("profiles").select("id, email, username");
        if (data) profileData = data;
      }

      if (profileData && profileData.length > 0) {
        setProfiles(profileData);

        if (isEditing && initialData?.id) {
          const { data: existingShares } = await supabase
            .from("expense_shares")
            .select("boarder_id")
            .eq("expense_id", initialData.id);

          if (existingShares && existingShares.length > 0) {
            const memberIds = existingShares.map(s => s.boarder_id);
            setSelectedMembers(memberIds);
            if (memberIds.length === profileData.length) {
              setShareMode("all");
            } else {
              setShareMode("custom");
            }
          } else {
            setSelectedMembers(profileData.map(p => p.id));
            setShareMode("all");
          }
        } else {
          setSelectedMembers(profileData.map(p => p.id));
          setShareMode("all");
        }
      }
    };
    fetchData();
  }, [supabase, initialData, isEditing, propProfiles, authUserId]);

  const handleShareModeChange = (mode: "all" | "custom") => {
    setShareMode(mode);
    if (mode === "all") {
      setSelectedMembers(profiles.map(p => p.id));
    }
  };

  const toggleMember = (id: string) => {
    if (selectedMembers.includes(id)) {
      setSelectedMembers(selectedMembers.filter(m => m !== id));
    } else {
      setSelectedMembers([...selectedMembers, id]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMembers.length === 0) {
      alert("Please select at least one member to share this expense.");
      return;
    }

    setLoading(true);

    try {
      const totalAmountNum = parseFloat(formData.amount) || 0;
      const membersCount = selectedMembers.length;

      let memberShares: any[] = [];
      const splitAmount = totalAmountNum / membersCount;

      selectedMembers.forEach(id => {
        memberShares.push({ 
          boarder_id: id, 
          user_id: id,
          shared_amount: parseFloat(splitAmount.toFixed(2)), 
          shareDue: parseFloat(splitAmount.toFixed(2)),
          status: 'unpaid',
          is_paid: false
        });
      });

      let expenseId = initialData?.id;

      const activeReceiverId = isEditing ? formData.receiverId : (authUserId || formData.receiverId || null);
      const activeReceiverName = authUserName || profiles.find(p => p.id === activeReceiverId)?.username || null;

      const expensePayload = {
        description: formData.description,
        expense_date: formData.expenseDate ? formData.expenseDate : null,
        total_amount: totalAmountNum,
        category: formData.category,
        payment_receiver_id: activeReceiverId,
        payment_receiver: activeReceiverName,
      };

      if (isEditing && expenseId) {
        const { error: expenseError } = await supabase
          .from("expenses")
          .update(expensePayload)
          .eq('id', String(expenseId));

        if (expenseError) throw expenseError;

        const { data: existingShares } = await supabase
          .from("expense_shares")
          .select("*")
          .eq("expense_id", expenseId);

        for (const newShare of memberShares) {
          const existing = existingShares?.find(s => s.boarder_id === newShare.boarder_id);
          if (existing) {
            await supabase
              .from("expense_shares")
              .update({
                shared_amount: newShare.shared_amount,
              })
              .eq("expense_id", expenseId)
              .eq("boarder_id", newShare.boarder_id);
          } else {
            await supabase
              .from("expense_shares")
              .insert([{
                expense_id: expenseId,
                boarder_id: newShare.boarder_id,
                shared_amount: newShare.shared_amount,
                status: 'unpaid',
                is_paid: false
              }]);
          }
        }

        const activeBoarderIds = memberShares.map(s => s.boarder_id);
        const sharesToRemove = existingShares?.filter(s => !activeBoarderIds.includes(s.boarder_id)) || [];
        for (const oldShare of sharesToRemove) {
          await supabase
            .from("expense_shares")
            .delete()
            .eq("expense_id", expenseId)
            .eq("boarder_id", oldShare.boarder_id);
        }

      } else {
        const { data: insertedExpense, error: expenseError } = await supabase
          .from("expenses")
          .insert([{ ...expensePayload, status: 'unpaid', is_paid: false }])
          .select()
          .single();

        if (expenseError) throw expenseError;
        expenseId = insertedExpense.id;

        const expenseSharesPayload = memberShares.map(share => ({
          expense_id: expenseId,
          boarder_id: share.boarder_id,
          shared_amount: share.shared_amount,
          status: 'unpaid',
          is_paid: false
        }));

        const { error: sharesError } = await supabase
          .from("expense_shares")
          .insert(expenseSharesPayload);

        if (sharesError) throw sharesError;
      }

      window.dispatchEvent(new Event('expense-updated'));
      router.refresh();
      onSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error saving expense:", errorMessage);
      alert("Failed to save expense: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const membersCount = selectedMembers.length || 1;
  const estimatedShare = formData.amount && !isNaN(parseFloat(formData.amount)) 
    ? (parseFloat(formData.amount) / membersCount).toFixed(2) 
    : "0.00";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-900 dark:text-white">
      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Description</label>
        <Input 
          value={formData.description} 
          onChange={e => setFormData({...formData, description: e.target.value})} 
          className="bg-slate-50 dark:bg-[#111111] border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white focus:border-[#4B49AC] dark:focus:border-[#ff8c00]" 
          placeholder="e.g. Grocery Run - Weekly"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1">Category</label>
        <select 
          value={formData.category} 
          onChange={(e) => setFormData({...formData, category: e.target.value})}
          className={inputStyles}
        >
          <option value="Food" className="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white">Food & Groceries</option>
          <option value="Supplies" className="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white">Household Supplies</option>
          <option value="Transport" className="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white">Transportation</option>
          <option value="Misc" className="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white">Miscellaneous</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Expense Date</label>
        <Input 
          type="date" 
          value={formData.expenseDate} 
          onChange={e => setFormData({...formData, expenseDate: e.target.value})} 
          className="bg-slate-50 dark:bg-[#111111] border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white" 
          required 
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1">Expense Participants</label>
        <select 
          value={shareMode} 
          onChange={(e) => handleShareModeChange(e.target.value as "all" | "custom")}
          className={inputStyles}
        >
          <option value="all" className="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white">All Boarders (Everyone shares)</option>
          <option value="custom" className="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white">Custom (Select specific participants)</option>
        </select>
      </div>

      {shareMode === 'custom' && (
        <div className="space-y-2">
          <label className="text-xs text-slate-500 dark:text-gray-400 block font-medium">Select who will share this expense:</label>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#333333] rounded-md">
            {profiles.map(p => {
              const isChecked = selectedMembers.includes(p.id);
              return (
                <div 
                  key={p.id} 
                  onClick={() => toggleMember(p.id)}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer border text-xs transition ${
                    isChecked 
                      ? 'bg-[#4B49AC]/10 dark:bg-[#ff8c00]/10 border-[#4B49AC] dark:border-[#ff8c00] text-slate-900 dark:text-white' 
                      : 'bg-white dark:bg-[#181818] border-slate-200 dark:border-[#222222] text-slate-500 dark:text-gray-400'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={() => {}} 
                    className="accent-[#4B49AC] dark:accent-[#ff8c00] cursor-pointer"
                  />
                  <span className="truncate font-medium">{p.username}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Total Amount (₱)</label>
          <Input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="bg-slate-50 dark:bg-[#111111] border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white" placeholder="0.00" required />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Sharing Members Count</label>
          <Input type="number" value={membersCount} className="bg-slate-50 dark:bg-[#111111] border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white opacity-80 cursor-not-allowed" readOnly disabled />
        </div>
      </div>

      <div className="bg-slate-100 dark:bg-[#111] p-3 rounded-lg border border-slate-200 dark:border-[#333] text-xs text-slate-600 dark:text-gray-400">
        Estimated Base Share Due per person: <span className="text-[#4B49AC] dark:text-[#ff8c00] font-bold">₱{estimatedShare}</span>
      </div>

      <div className="flex gap-3 pt-2">
        <Button 
          type="submit" 
          disabled={loading}
          className="flex-1 bg-[#4B49AC] hover:bg-[#3f3dc9] dark:bg-[#ff8c00] dark:hover:bg-[#e67e00] text-white dark:text-black font-bold cursor-pointer"
        >
          {loading ? "Saving..." : isEditing ? "Save Changes" : "Submit Expense"}
        </Button>
        {onCancel && (
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onCancel}
            className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
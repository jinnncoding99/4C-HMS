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
  role?: string;
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
  const [step, setStep] = useState<1 | 2>(1);
  
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
  const inputStyles = "w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-md p-2 text-sm focus:border-[#4B49AC] focus:ring-1 focus:ring-[#4B49AC] outline-none transition-all";

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
        const { data } = await supabase.from("profiles").select("id, email, username, role");
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

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.expenseDate) {
      console.warn("[Validation Warning]: Please fill in all required basic fields.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMembers.length === 0) {
      console.warn("[Validation Line ~145]: Please select at least one member to share this expense.");
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

      let currentCreatorId = authUserId;
      if (!currentCreatorId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) currentCreatorId = user.id;
      }

      const activeReceiverId = isEditing ? formData.receiverId : (currentCreatorId || formData.receiverId || null);
      const activeReceiverName = authUserName || profiles.find(p => p.id === activeReceiverId)?.username || null;

      const expensePayload = {
        description: formData.description,
        expense_date: formData.expenseDate ? formData.expenseDate : null,
        total_amount: totalAmountNum,
        category: formData.category,
        payment_receiver_id: activeReceiverId,
        payment_receiver: activeReceiverName,
        created_by: currentCreatorId,
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

      if (selectedMembers.length > 0 && expenseId) {
        await supabase
          .from('notifications')
          .delete()
          .eq('type', 'expense_announcement')
          .eq('details->>expense_id', expenseId);

        // Exclude admin if needed, exactly like your working bill form logic
        const selectedProfiles = profiles.filter((p) =>
          selectedMembers.includes(p.id) && p.role !== 'admin'
        );

        const uniqueMap = new Map<string, Profile>();
        selectedProfiles.forEach((p) => {
          if (p.email && !uniqueMap.has(p.email)) {
            uniqueMap.set(p.email, p);
          }
        });

        const notificationsPayload = Array.from(uniqueMap.values()).map((profile) => ({
          type: 'expense_announcement',
          email: profile.email,
          message: `A new expense has been posted: "${formData.description}" amounting to ₱${totalAmountNum.toFixed(2)}.`,
          status: 'sent',
          details: { expense_id: expenseId, user_id: profile.id },
        }));

        if (notificationsPayload.length > 0) {
          const { error: notifError } = await supabase
            .from('notifications')
            .insert(notificationsPayload);

          if (notifError) {
            console.error("[Debug - Notification Insert Error]:", notifError.message);
          }
        }
      }

      window.dispatchEvent(new Event('expense-updated'));
      window.dispatchEvent(new Event('notification-updated'));
      router.refresh();
      onSuccess();
    } catch (err: unknown) {
      let errorMessage = "Unknown error occurred";
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        errorMessage = (err as any).message || (err as any).error_description || JSON.stringify(err);
      } else {
        errorMessage = String(err);
      }

      console.error("[Debug - Error saving expense]:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const membersCount = selectedMembers.length || 1;
  const estimatedShare = formData.amount && !isNaN(parseFloat(formData.amount)) 
    ? (parseFloat(formData.amount) / membersCount).toFixed(2) 
    : "0.00";

  return (
    <div className="text-slate-900 pb-20">
      <div className="flex items-center justify-between mb-4 px-1 border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-semibold text-sm">
            {step === 1 ? "Step 1: Expense Information" : "Step 2: Participants & Split"}
          </h3>
          <p className="text-xs text-slate-500">
            {step === 1 ? "Enter description, category, date, and amount." : "Choose who splits and reviews the share."}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold">
          <span className={`px-2 py-1 rounded-full ${step === 1 ? 'bg-[#4B49AC] text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
          <span className="text-slate-400">-</span>
          <span className={`px-2 py-1 rounded-full ${step === 2 ? 'bg-[#4B49AC] text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
        </div>
      </div>

      {step === 1 ? (
        <form onSubmit={handleNextStep} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Description</label>
            <Input 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              className="bg-slate-50 border-slate-300 text-slate-900 focus:border-[#4B49AC]" 
              placeholder="e.g. Grocery Run - Weekly"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Category</label>
            <select 
              value={formData.category} 
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className={inputStyles}
            >
              <option value="Food" className="bg-white text-slate-900">Food & Groceries</option>
              <option value="Supplies" className="bg-white text-slate-900">Household Supplies</option>
              <option value="Transport" className="bg-white text-slate-900">Transportation</option>
              <option value="Misc" className="bg-white text-slate-900">Miscellaneous</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Expense Date</label>
            <Input 
              type="date" 
              value={formData.expenseDate} 
              onChange={e => setFormData({...formData, expenseDate: e.target.value})} 
              className="bg-slate-50 border-slate-300 text-slate-900" 
              required 
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Total Amount (₱)</label>
            <Input 
              type="number" 
              step="0.01" 
              value={formData.amount} 
              onChange={e => setFormData({...formData, amount: e.target.value})} 
              className="bg-slate-50 border-slate-300 text-slate-900 w-full" 
              placeholder="0.00" 
              required 
            />
          </div>

          <div className="fixed sm:relative bottom-0 left-0 right-0 bg-white/95 backdrop-blur sm:bg-transparent p-3 sm:p-0 border-t sm:border-t-0 border-slate-200 flex gap-3 z-20">
            <Button 
              type="submit" 
              className="flex-1 bg-[#4B49AC] hover:bg-[#3f3dc9] text-white font-bold cursor-pointer h-10"
            >
              Next
            </Button>
            {onCancel && (
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onCancel}
                className="text-slate-500 hover:text-slate-900 cursor-pointer h-10 px-4"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Expense Participants</label>
            <select 
              value={shareMode} 
              onChange={(e) => handleShareModeChange(e.target.value as "all" | "custom")}
              className={inputStyles}
            >
              <option value="all" className="bg-white text-slate-900">All Boarders (Everyone shares)</option>
              <option value="custom" className="bg-white text-slate-900">Custom (Select specific participants)</option>
            </select>
          </div>

          {shareMode === 'custom' && (
            <div className="space-y-2">
              <label className="text-xs text-slate-500 block font-medium">Select who will share this expense:</label>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-md shadow-inner">
                {profiles.map(p => {
                  const isChecked = selectedMembers.includes(p.id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => toggleMember(p.id)}
                      className={`flex items-center gap-2 p-2.5 rounded cursor-pointer border text-xs transition ${
                        isChecked 
                          ? 'bg-[#4B49AC]/10 border-[#4B49AC] text-slate-900' 
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => {}} 
                        className="accent-[#4B49AC] cursor-pointer"
                      />
                      <span className="truncate font-medium">{p.username}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 text-xs space-y-1 text-slate-600">
            <div>Total Expense Amount: <span className="font-bold text-slate-900">₱{parseFloat(formData.amount || "0").toFixed(2)}</span></div>
            <div>Selected Participants Count: <span className="font-bold text-slate-900">{membersCount}</span></div>
            <div className="pt-1 border-t border-slate-200">
              Estimated Base Share Due per person: <span className="text-[#4B49AC] font-bold">₱{estimatedShare}</span>
            </div>
          </div>

          <div className="fixed sm:relative bottom-0 left-0 right-0 bg-white/95 backdrop-blur sm:bg-transparent p-3 sm:p-0 border-t sm:border-t-0 border-slate-200 flex gap-3 z-20">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setStep(1)}
              className="px-4 border-slate-300 text-slate-700 cursor-pointer h-10"
            >
              Back
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-[#4B49AC] hover:bg-[#3f3dc9] text-white font-bold cursor-pointer h-10"
            >
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Submit Expense"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
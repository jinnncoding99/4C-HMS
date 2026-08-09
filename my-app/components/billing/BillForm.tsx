// components/billing/BillForm.tsx
'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface BillItem {
  id?: string;
  description: string;
  total_amount: number;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  calculation_type?: string;
  payment_receiver_id?: string | null;
}

interface Profile {
  id: string;
  email: string;
  username: string;
}

interface BillFormProps {
  initialData?: BillItem;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function BillForm({ initialData, onSuccess, onCancel }: BillFormProps) {
  const isEditing = !!initialData?.id;
  const router = useRouter();
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [shareMode, setShareMode] = useState<"all" | "custom">("all");
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    description: initialData?.description || "",
    from: initialData?.billing_period_start ? initialData.billing_period_start.split('T')[0] : "",
    to: initialData?.billing_period_end ? initialData.billing_period_end.split('T')[0] : "",
    amount: initialData?.total_amount ? initialData.total_amount.toString() : "",
    receiverId: initialData?.payment_receiver_id || "",
    calculationType: initialData?.calculation_type || "prorated",
  });

  const supabase = createClient();
  const inputStyles = "w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white rounded-md p-2 text-sm focus:border-[#4B49AC] dark:focus:border-[#ff8c00] focus:ring-1 focus:ring-[#4B49AC] dark:focus:ring-[#ff8c00] outline-none transition-all";

  useEffect(() => {
    const fetchData = async () => {
      const { data: profileData } = await supabase.from("profiles").select("id, email, username");
      if (profileData) {
        setProfiles(profileData);

        if (isEditing && initialData?.id) {
          const { data: existingShares } = await supabase
            .from("bill_shares")
            .select("boarder_id")
            .eq("bill_id", initialData.id);

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
  }, [supabase, initialData, isEditing]);

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
      alert("Please select at least one member to share this bill.");
      return;
    }

    setLoading(true);

    try {
      const totalAmountNum = parseFloat(formData.amount) || 0;
      const membersCount = selectedMembers.length;

      const startDate = formData.from ? new Date(formData.from + 'T00:00:00') : null;
      const endDate = formData.to ? new Date(formData.to + 'T00:00:00') : null;

      let memberShares: { boarder_id: string; shared_amount: number; days_present: number }[] = [];

      if (formData.calculationType === 'prorated' && startDate && endDate) {
        const totalBillingDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1);
        
        const selectedProfiles = profiles.filter(p => selectedMembers.includes(p.id));
        const emails = selectedProfiles.map(p => p.email).filter(Boolean);

        const { data: vacations, error: vacError } = await supabase
          .from("vacation_history")
          .select("*")
          .in("user_email", emails)
          .eq("status", "approved");

        if (vacError) console.error("Error fetching vacations:", vacError);

        const memberWeights: { [id: string]: number } = {};
        let totalWeight = 0;

        selectedProfiles.forEach(profile => {
          let activeDays = totalBillingDays;

          if (vacations) {
            const userVacations = vacations.filter(v => v.user_email === profile.email);
            userVacations.forEach(vac => {
              const vacStart = new Date(vac.start_date + 'T00:00:00');
              const vacEnd = new Date(vac.end_date + 'T00:00:00');

              const overlapStart = vacStart > startDate ? vacStart : startDate;
              const overlapEnd = vacEnd < endDate ? vacEnd : endDate;

              if (overlapStart <= overlapEnd) {
                const overlapDays = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 3600 * 24)) + 1;
                activeDays = Math.max(0, activeDays - overlapDays);
              }
            });
          }

          memberWeights[profile.id] = activeDays;
          totalWeight += activeDays;
        });

        if (totalWeight <= 0) {
          const splitAmount = totalAmountNum / membersCount;
          selectedMembers.forEach(id => {
            memberShares.push({ 
              boarder_id: id, 
              shared_amount: splitAmount, 
              days_present: totalBillingDays
            });
          });
        } else {
          selectedMembers.forEach(id => {
            const weight = memberWeights[id] ?? totalBillingDays;
            const proratedAmount = (weight / totalWeight) * totalAmountNum;
            
            memberShares.push({ 
              boarder_id: id, 
              shared_amount: parseFloat(proratedAmount.toFixed(2)), 
              days_present: weight
            });
          });
        }
      } else {
        const fallbackDays = (startDate && endDate) 
          ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1)
          : 31;
        const splitAmount = totalAmountNum / membersCount;

        selectedMembers.forEach(id => {
          memberShares.push({ 
            boarder_id: id, 
            shared_amount: parseFloat(splitAmount.toFixed(2)), 
            days_present: fallbackDays
          });
        });
      }

      let billId = initialData?.id;

      const billPayload = {
        description: formData.description,
        billing_period_start: formData.from ? formData.from : null, 
        billing_period_end: formData.to ? formData.to : null,    
        total_amount: totalAmountNum,
        calculation_type: formData.calculationType,
        payment_receiver_id: formData.receiverId ? formData.receiverId : null,
      };

      if (isEditing && billId) {
        const { error: billError } = await supabase
          .from("bills")
          .update(billPayload)
          .eq('id', String(billId));

        if (billError) throw billError;

        const { data: existingShares } = await supabase
          .from("bill_shares")
          .select("*")
          .eq("bill_id", billId);

        for (const newShare of memberShares) {
          const existing = existingShares?.find(s => s.boarder_id === newShare.boarder_id);
          if (existing) {
            await supabase
              .from("bill_shares")
              .update({
                shared_amount: newShare.shared_amount,
                days_present: newShare.days_present,
              })
              .eq("bill_id", billId)
              .eq("boarder_id", newShare.boarder_id);
          } else {
            await supabase
              .from("bill_shares")
              .insert([{
                bill_id: billId,
                boarder_id: newShare.boarder_id,
                shared_amount: newShare.shared_amount,
                days_present: newShare.days_present,
                status: 'unpaid',
                is_paid: false
              }]);
          }
        }

        const activeBoarderIds = memberShares.map(s => s.boarder_id);
        const sharesToRemove = existingShares?.filter(s => !activeBoarderIds.includes(s.boarder_id)) || [];
        for (const oldShare of sharesToRemove) {
          await supabase
            .from("bill_shares")
            .delete()
            .eq("bill_id", billId)
            .eq("boarder_id", oldShare.boarder_id);
        }

      } else {
        const { data: insertedBill, error: billError } = await supabase
          .from("bills")
          .insert([{ ...billPayload, status: 'unpaid', is_paid: false }])
          .select()
          .single();

        if (billError) throw billError;
        billId = insertedBill.id;

        const billSharesPayload = memberShares.map(share => ({
          bill_id: billId,
          boarder_id: share.boarder_id,
          shared_amount: share.shared_amount,
          days_present: share.days_present,
          status: 'unpaid',
          is_paid: false
        }));

        const { error: sharesError } = await supabase
          .from("bill_shares")
          .insert(billSharesPayload);

        if (sharesError) throw sharesError;
      }

      window.dispatchEvent(new Event('billing-updated'));
      router.refresh();
      onSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error saving bill:", errorMessage);
      alert("Failed to save bill: " + errorMessage);
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
          placeholder="e.g. Internet Bill - June"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1">Calculation Type</label>
        <select 
          value={formData.calculationType} 
          onChange={(e) => setFormData({...formData, calculationType: e.target.value})}
          className={inputStyles}
        >
          <option value="prorated" className="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white">Prorated (Based on presence / days around)</option>
          <option value="fixed" className="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white">Fixed Split (Evenly divided)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-gray-300">From</label>
          <Input 
            type="date" 
            value={formData.from} 
            onChange={e => setFormData({...formData, from: e.target.value})} 
            className="bg-slate-50 dark:bg-[#111111] border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white" 
            required={formData.calculationType === 'prorated'} 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-gray-300">To</label>
          <Input 
            type="date" 
            value={formData.to} 
            onChange={e => setFormData({...formData, to: e.target.value})} 
            className="bg-slate-50 dark:bg-[#111111] border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white" 
            required={formData.calculationType === 'prorated'} 
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1">Payment Receiver</label>
        <select 
          value={formData.receiverId} 
          onChange={(e) => setFormData({...formData, receiverId: e.target.value})} 
          className={inputStyles}
          required
        >
          <option value="" disabled className="bg-white dark:bg-[#1a1a1a] text-gray-400">Select receiver</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id} className="bg-white dark:bg-[#1a1a1a] text-slate-900 dark:text-white">
              {p.username}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1">Bill Participants</label>
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
          <label className="text-xs text-slate-500 dark:text-gray-400 block font-medium">Select who will share this bill:</label>
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
          {loading ? "Saving..." : isEditing ? "Save Changes" : "Submit Bill"}
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
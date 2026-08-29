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
  role?: string;
}

interface BillFormProps {
  initialData?: BillItem;
  profiles?: Profile[];
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function BillForm({ initialData, profiles: propProfiles, onSuccess, onCancel }: BillFormProps) {
  const isEditing = !!initialData?.id;
  const router = useRouter();
  
  const [profiles, setProfiles] = useState<Profile[]>(propProfiles || []);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [shareMode, setShareMode] = useState<"all" | "custom">("all");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  
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
      let profileData = propProfiles;
      if (!profileData || profileData.length === 0) {
        const { data } = await supabase.from("profiles").select("id, email, username, role");
        if (data) profileData = data;
      }

      if (profileData && profileData.length > 0) {
        setProfiles(profileData);

        if (isEditing && initialData?.id) {
          const { data: existingShares } = await supabase
            .from("bill_shares")
            .select("boarder_id")
            .eq("bill_id", initialData.id);

          if (existingShares && existingShares.length > 0) {
            const memberIds = existingShares.map(s => s.boarder_id);
            setSelectedMembers(memberIds);
            setShareMode(memberIds.length === profileData.length ? "all" : "custom");
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
  }, [supabase, initialData, isEditing, propProfiles]);

  const handleShareModeChange = (mode: "all" | "custom") => {
    setShareMode(mode);
    if (mode === "all") {
      setSelectedMembers(profiles.map(p => p.id));
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.receiverId || !formData.amount) {
      console.warn("[Validation Warning]: Please fill in all required basic fields.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMembers.length === 0) {
      console.warn("[Validation Warning]: Please select at least one member to share this bill.");
      return;
    }

    setLoading(true);

    try {
      const totalAmountNum = parseFloat(formData.amount) || 0;
      const membersCount = selectedMembers.length;

      const startDate = formData.from ? new Date(formData.from + 'T00:00:00') : null;
      const endDate = formData.to ? new Date(formData.to + 'T00:00:00') : null;

      let memberShares: any[] = [];

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

        selectedMembers.forEach(id => {
          const weight = memberWeights[id] ?? totalBillingDays;
          let proratedAmount = totalWeight <= 0 ? totalAmountNum / membersCount : (weight / totalWeight) * totalAmountNum;
          const finalAmount = isNaN(proratedAmount) ? 0 : parseFloat(proratedAmount.toFixed(2));

          memberShares.push({ 
            boarder_id: id, 
            user_id: id,
            shared_amount: finalAmount, 
            days_present: weight > 0 ? weight : totalBillingDays,
            status: 'unpaid',
            is_paid: false
          });
        });

      } else {
        const fallbackDays = (startDate && endDate) 
          ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1)
          : 31;
        const splitAmount = totalAmountNum / membersCount;

        selectedMembers.forEach(id => {
          memberShares.push({ 
            boarder_id: id, 
            user_id: id,
            shared_amount: parseFloat(splitAmount.toFixed(2)), 
            days_present: fallbackDays,
            status: 'unpaid',
            is_paid: false
          });
        });
      }

      let billId = initialData?.id;

      const billPayload = {
        description: formData.description,
        billing_period_start: formData.from || null, 
        billing_period_end: formData.to || null,    
        total_amount: totalAmountNum,
        calculation_type: formData.calculationType,
        payment_receiver_id: formData.receiverId || null,
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

      if (selectedMembers.length > 0 && billId) {
        await supabase
          .from('notifications')
          .delete()
          .eq('type', 'bill_announcement')
          .eq('details->>bill_id', billId);

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
          type: 'bill_announcement',
          email: profile.email,
          message: `A new bill has been posted: "${formData.description}" amounting to ₱${totalAmountNum.toFixed(2)}.`,
          status: 'sent',
          details: { bill_id: billId, user_id: profile.id },
        }));

        if (notificationsPayload.length > 0) {
          await supabase.from('notifications').insert(notificationsPayload);
        }
      }

      window.dispatchEvent(new Event('billing-updated'));
      window.dispatchEvent(new Event('notification-updated'));
      router.refresh();
      onSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error saving bill:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const membersCount = selectedMembers.length || 1;
  const estimatedShare = formData.amount && !isNaN(parseFloat(formData.amount)) 
    ? (parseFloat(formData.amount) / membersCount).toFixed(2) 
    : "0.00";

  return (
    <div className="text-slate-900 dark:text-white pb-20">
      <div className="flex items-center justify-between mb-4 px-1 border-b border-slate-200 dark:border-[#333] pb-3">
        <div>
          <h3 className="font-semibold text-sm">
            {step === 1 ? "Step 1: Bill Information" : "Step 2: Participants & Split"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            {step === 1 ? "Enter basic details, amount, and dates." : "Choose who splits and reviews the share."}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold">
          <span className={`px-2 py-1 rounded-full ${step === 1 ? 'bg-[#4B49AC] dark:bg-[#ff8c00] text-white dark:text-black' : 'bg-slate-200 dark:bg-[#222] text-slate-500'}`}>1</span>
          <span className="text-slate-400">-</span>
          <span className={`px-2 py-1 rounded-full ${step === 2 ? 'bg-[#4B49AC] dark:bg-[#ff8c00] text-white dark:text-black' : 'bg-slate-200 dark:bg-[#222] text-slate-500'}`}>2</span>
        </div>
      </div>

      {step === 1 ? (
        <form onSubmit={handleNextStep} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1">Description</label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1">From</label>
              <Input 
                type="date" 
                value={formData.from} 
                onChange={e => setFormData({...formData, from: e.target.value})} 
                className="bg-slate-50 dark:bg-[#111111] border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white w-full" 
                required={formData.calculationType === 'prorated'} 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1">To</label>
              <Input 
                type="date" 
                value={formData.to} 
                onChange={e => setFormData({...formData, to: e.target.value})} 
                className="bg-slate-50 dark:bg-[#111111] border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white w-full" 
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
            <label className="text-sm font-medium text-slate-700 dark:text-gray-300 block mb-1">Total Amount (₱)</label>
            <Input 
              type="number" 
              step="0.01" 
              value={formData.amount} 
              onChange={e => setFormData({...formData, amount: e.target.value})} 
              className="bg-slate-50 dark:bg-[#111111] border-slate-300 dark:border-[#333333] text-slate-900 dark:text-white w-full" 
              placeholder="0.00" 
              required 
            />
          </div>

          <div className="fixed sm:relative bottom-0 left-0 right-0 bg-white/95 dark:bg-[#181818]/95 backdrop-blur sm:bg-transparent p-3 sm:p-0 border-t sm:border-t-0 border-slate-200 dark:border-[#333] flex gap-3 z-20">
            <Button 
              type="submit" 
              className="flex-1 bg-[#4B49AC] hover:bg-[#3f3dc9] dark:bg-[#ff8c00] dark:hover:bg-[#e67e00] text-white dark:text-black font-bold cursor-pointer h-10"
            >
              Next
            </Button>
            {onCancel && (
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onCancel}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white cursor-pointer h-10 px-4"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#333333] rounded-md shadow-inner">
                {profiles.map(p => {
                  const isChecked = selectedMembers.includes(p.id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => toggleMember(p.id)}
                      className={`flex items-center gap-2 p-2.5 rounded cursor-pointer border text-xs transition ${
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

          <div className="bg-slate-100 dark:bg-[#111] p-3 rounded-lg border border-slate-200 dark:border-[#333] text-xs space-y-1 text-slate-600 dark:text-gray-400">
            <div>Total Bill Amount: <span className="font-bold text-slate-900 dark:text-white">₱{parseFloat(formData.amount || "0").toFixed(2)}</span></div>
            <div>Selected Participants Count: <span className="font-bold text-slate-900 dark:text-white">{membersCount}</span></div>
            <div className="pt-1 border-t border-slate-200 dark:border-[#222]">
              Estimated Base Share Due per person: <span className="text-[#4B49AC] dark:text-[#ff8c00] font-bold">₱{estimatedShare}</span>
            </div>
          </div>

          <div className="fixed sm:relative bottom-0 left-0 right-0 bg-white/95 dark:bg-[#181818]/95 backdrop-blur sm:bg-transparent p-3 sm:p-0 border-t sm:border-t-0 border-slate-200 dark:border-[#333] flex gap-3 z-20">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setStep(1)}
              className="px-4 border-slate-300 dark:border-[#333] text-slate-700 dark:text-gray-300 cursor-pointer h-10"
            >
              Back
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-[#4B49AC] hover:bg-[#3f3dc9] dark:bg-[#ff8c00] dark:hover:bg-[#e67e00] text-white dark:text-black font-bold cursor-pointer h-10"
            >
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Submit Bill"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
// components/dashboard/VacationRequestComponent.tsx
'use client';

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plane, ArrowLeft, Loader2 } from "lucide-react";

interface VacationRequestProps {
  onSuccess?: () => void;
  onBack?: () => void;
}

export default function VacationRequestComponent({ onSuccess, onBack }: VacationRequestProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    await supabase.from('vacation_history').insert({
      user_email: user.email,
      start_date: startDate,
      end_date: endDate,
      reason: reason,
      days_requested: diffDays,
      status: 'pending'
    });

    const message = `Vacation Request from ${user.email}: From ${startDate} to ${endDate}. Reason: ${reason}.`;
    await supabase.from('notifications').insert({
      email: user.email,
      type: 'vacation',
      message: message,
      status: 'pending',
      details: {
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        status: 'pending'
      }
    });

    setLoading(false);
    if (onSuccess) onSuccess();
  };

  const handleReturn = onBack || onSuccess;

  return (
    <form onSubmit={handleSubmit} className="text-foreground flex flex-col justify-between h-full w-full space-y-6">
      <div className="space-y-6">
        {/* Header section */}
        <div className="flex flex-col border-b border-border pb-4 gap-4 relative">
          {handleReturn && (
            <div className="flex items-center w-full">
              <Button 
                type="button"
                onClick={handleReturn}
                title="Return"
                className="bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer shrink-0 shadow-sm"
              >
                <ArrowLeft size={18} />
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left w-full">
            <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-xl text-primary shrink-0">
              <Plane size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Request Vacation</h2>
              <p className="text-sm text-muted-foreground">Submit your scheduled time off.</p>
            </div>
          </div>
        </div>

        {/* Form Inputs section */}
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1 font-medium">From</label>
            <input 
              type="date" 
              required
              value={startDate}
              className="w-full bg-background border border-input p-3 rounded-xl text-foreground text-sm focus:border-primary outline-none cursor-pointer"
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1 font-medium">To</label>
            <input 
              type="date" 
              required
              min={startDate}
              value={endDate}
              className="w-full bg-background border border-input p-3 rounded-xl text-foreground text-sm focus:border-primary outline-none cursor-pointer"
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1 font-medium">Reason</label>
            <textarea 
              required
              value={reason}
              placeholder="e.g., Vacation trip..."
              className="w-full bg-background border border-input p-3 rounded-xl text-foreground text-sm h-32 focus:border-primary outline-none resize-none"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2 pb-safe">
        <Button 
          type="submit" 
          disabled={loading}
          className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 cursor-pointer h-12 flex items-center justify-center gap-2 rounded-xl shadow-lg text-sm"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : "Submit Request"}
        </Button>
      </div>
    </form>
  );
}
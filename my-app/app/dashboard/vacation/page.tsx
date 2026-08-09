'use client';

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plane, ArrowLeft, X } from "lucide-react";

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
    <div className="text-foreground space-y-4">
      <div className="flex flex-col border-b border-border pb-4 gap-4 relative">
        {handleReturn && (
          <div className="flex justify-between items-center">
            <Button 
              onClick={handleReturn}
              title="Return"
              className="md:hidden bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer shrink-0"
            >
              <ArrowLeft size={18} />
            </Button>

            <button 
              onClick={handleReturn}
              className="hidden md:flex ml-auto items-center gap-1.5 text-muted-foreground hover:text-foreground transition cursor-pointer text-xs font-bold bg-card border border-border px-3 py-1.5 rounded-lg"
            >
              <X size={14} /> Close
            </button>
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

      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <input 
            type="date" 
            required
            value={startDate}
            className="w-full bg-background border border-input p-2.5 rounded-lg text-foreground text-sm focus:border-primary outline-none cursor-pointer"
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <input 
            type="date" 
            required
            min={startDate}
            value={endDate}
            className="w-full bg-background border border-input p-2.5 rounded-lg text-foreground text-sm focus:border-primary outline-none cursor-pointer"
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Reason</label>
          <textarea 
            required
            value={reason}
            className="w-full bg-background border border-input p-2.5 rounded-lg text-foreground text-sm h-24 focus:border-primary outline-none resize-none"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Button 
          type="submit" 
          disabled={loading}
          className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 cursor-pointer h-10"
        >
          {loading ? "Submitting..." : "Submit Request"}
        </Button>
      </form>
    </div>
  );
}
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
    <div className="text-white space-y-4">
      <div className="flex flex-col border-b border-[#333] pb-4 gap-4 relative">
        {handleReturn && (
          <div className="flex justify-between items-center">
            <Button 
              onClick={handleReturn}
              title="Return"
              className="md:hidden bg-[#222] border border-[#333] hover:bg-[#333] text-gray-300 hover:text-white h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer shrink-0"
            >
              <ArrowLeft size={18} />
            </Button>

            <button 
              onClick={handleReturn}
              className="hidden md:flex ml-auto items-center gap-1.5 text-gray-400 hover:text-white transition cursor-pointer text-xs font-bold bg-[#222] border border-[#333] px-3 py-1.5 rounded-lg"
            >
              <X size={14} /> Close
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left w-full">
          <div className="p-2.5 bg-[#ff8c00]/10 border border-[#ff8c00]/30 rounded-xl text-[#ff8c00] shrink-0">
            <Plane size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Request Vacation</h2>
            <p className="text-sm text-gray-400">Submit your scheduled time off.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div>
          <label className="text-xs text-gray-400 block mb-1">From</label>
          <input 
            type="date" 
            required
            value={startDate}
            className="w-full bg-[#111111] border border-[#333] p-2.5 rounded-lg text-white text-sm focus:border-[#ff8c00] outline-none cursor-pointer"
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">To</label>
          <input 
            type="date" 
            required
            min={startDate}
            value={endDate}
            className="w-full bg-[#111111] border border-[#333] p-2.5 rounded-lg text-white text-sm focus:border-[#ff8c00] outline-none cursor-pointer"
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Reason</label>
          <textarea 
            required
            value={reason}
            className="w-full bg-[#111111] border border-[#333] p-2.5 rounded-lg text-white text-sm h-24 focus:border-[#ff8c00] outline-none resize-none"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Button 
          type="submit" 
          disabled={loading}
          className="w-full bg-[#ff8c00] text-black font-bold hover:bg-[#e67e00] cursor-pointer h-10"
        >
          {loading ? "Submitting..." : "Submit Request"}
        </Button>
      </form>
    </div>
  );
}
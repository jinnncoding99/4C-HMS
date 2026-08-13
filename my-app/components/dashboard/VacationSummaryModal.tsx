// components/dashboard/VacationSummaryModal.tsx
'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Plane, Plus, ArrowLeft, Calendar, Check, Ban } from "lucide-react";
import VacationRequestComponent from "@/app/dashboard/vacation/page";

interface VacationRequest {
  id: string;
  user_email: string;
  reason: string;
  start_date: string;
  end_date: string;
  days_requested?: number;
  status?: string; 
  created_at?: string;
}

interface VacationSummaryModalProps {
  onBack?: () => void;
}

export default function VacationSummaryModal({ onBack }: VacationSummaryModalProps) {
  const [vacations, setVacations] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'approved' | 'pending'>('all');
  
  // Date Range Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const supabase = createClient();

  useEffect(() => {
    fetchUserDataAndVacations();
  }, []);

  const fetchUserDataAndVacations = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const userIsAdmin = profile?.role?.toLowerCase() === 'admin';
    setIsAdmin(userIsAdmin);

    const { data } = await supabase
      .from("vacation_history")
      .select("*")
      .order("start_date", { ascending: false });

    if (data) {
      const activeVacations = data.filter(v => (v.status || 'pending').toLowerCase() !== 'rejected');
      setVacations(activeVacations);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from("vacation_history")
      .update({ status: newStatus })
      .eq("id", id);

    if (!error) {
      fetchUserDataAndVacations();
    } else {
      alert("Failed to update leave status.");
    }
  };

  const filterByDate = (dateString?: string | null) => {
    if (!dateString) return true;
    const itemDate = new Date(dateString).getTime();
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
    return itemDate >= start && itemDate <= end;
  };

  const filteredVacations = vacations.filter(v => {
    const matchesDate = filterByDate(v.start_date);
    if (!matchesDate) return false;

    const currentStatus = (v.status || 'pending').toLowerCase();
    if (filterType === 'approved') return currentStatus === 'approved';
    if (filterType === 'pending') return currentStatus === 'pending';
    return true;
  });

  return (
    <div className="w-full space-y-4 text-foreground relative">
      {/* Header section */}
      <div className="flex flex-col border-b border-border pb-4 gap-4 relative">
        {onBack && (
          <div className="flex items-center w-full">
            <Button 
              onClick={onBack}
              title="Return"
              className="bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer shrink-0 shadow-sm"
            >
              <ArrowLeft size={18} />
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3 w-full">
            <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-xl text-primary shrink-0">
              <Plane size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Vacation Leave Summary</h3>
              <p className="text-sm text-muted-foreground">Review all team vacation history and request time off.</p>
            </div>
          </div>

          <Button 
            onClick={() => setIsRequestModalOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs cursor-pointer flex items-center gap-2 h-10 px-4 shrink-0 w-full sm:w-auto justify-center"
          >
            <Plus size={16} /> Request Vacation
          </Button>
        </div>
      </div>

      {/* Date Range Selector Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border text-xs">
        <span className="text-muted-foreground flex items-center gap-1 font-medium shrink-0">
          <Calendar size={14} className="text-primary" /> Date Range Filter:
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2 w-full md:w-auto">
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-muted border border-border text-foreground px-2.5 py-1.5 rounded-lg focus:border-primary outline-none cursor-pointer flex-1 sm:flex-none"
          />
          <span className="text-muted-foreground">to</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-muted border border-border text-foreground px-2.5 py-1.5 rounded-lg focus:border-primary outline-none cursor-pointer flex-1 sm:flex-none"
          />
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }} 
              className="text-primary hover:underline ml-2 cursor-pointer font-medium shrink-0"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Short Filter Buttons */}
      <div className="flex items-center justify-start sm:justify-center gap-2 border-b border-border pb-4 overflow-x-auto scrollbar-none">
        <Button 
          onClick={() => setFilterType('all')} 
          className={`text-xs cursor-pointer px-4 h-8 shrink-0 ${filterType === 'all' ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'}`}
        >
          All
        </Button>
        <Button 
          onClick={() => setFilterType('approved')} 
          className={`text-xs cursor-pointer px-4 h-8 shrink-0 ${filterType === 'approved' ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'}`}
        >
          Approved
        </Button>
        <Button 
          onClick={() => setFilterType('pending')} 
          className={`text-xs cursor-pointer px-4 h-8 shrink-0 ${filterType === 'pending' ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'}`}
        >
          Pending
        </Button>
      </div>

      {/* Summary List Content */}
      <div className="space-y-3 min-h-[250px]">
        {loading ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Loading vacation records...</p>
        ) : filteredVacations.length > 0 ? (
          <div className="space-y-2">
            {filteredVacations.map((v) => {
              const status = (v.status || 'pending').toLowerCase();
              const isApproved = status === 'approved';
              
              return (
                <div key={v.id} className="bg-card p-4 rounded-xl border border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-sm">{v.reason}</p>
                    <p className="text-muted-foreground text-[11px]">Requested by: <span className="text-foreground">{v.user_email}</span></p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Calendar size={12} className="text-primary" /> 
                      {v.start_date} to {v.end_date} {v.days_requested ? `(${v.days_requested} days)` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {isAdmin && status === 'pending' ? (
                      <div className="flex items-center gap-1.5">
                        <Button 
                          onClick={() => handleUpdateStatus(v.id, 'approved')}
                          className="bg-green-600 hover:bg-green-700 text-white h-7 px-2.5 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                        >
                          <Check size={12} /> Approve
                        </Button>
                        <Button 
                          onClick={() => handleUpdateStatus(v.id, 'rejected')}
                          className="bg-red-600/20 border border-red-600/40 hover:bg-red-600 text-red-400 hover:text-white h-7 px-2.5 text-[11px] font-semibold cursor-pointer flex items-center gap-1 transition"
                        >
                          <Ban size={12} /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider border ${
                        isApproved 
                          ? 'bg-green-500/10 text-green-500 border-green-500/30' 
                          : 'bg-primary/10 text-primary border-primary/30'
                      }`}>
                        {status}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 space-y-2">
            <p className="text-muted-foreground text-xs italic">No vacation requests found matching this filter or date range.</p>
          </div>
        )}
      </div>

      {/* Pop-up Modal occupying full screen with glass blur background */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-md p-0 sm:p-4">
          <div className="bg-card p-6 w-full h-full sm:w-auto sm:h-auto sm:max-w-md sm:rounded-2xl rounded-none border-0 sm:border border-primary shadow-2xl relative text-card-foreground overflow-y-auto flex flex-col justify-between">
            <VacationRequestComponent 
              onBack={() => setIsRequestModalOpen(false)}
              onSuccess={() => {
                setIsRequestModalOpen(false);
                fetchUserDataAndVacations();
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
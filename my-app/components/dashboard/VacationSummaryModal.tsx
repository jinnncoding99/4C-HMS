'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Plane, Plus, ArrowLeft, X, Calendar, Check, Ban } from "lucide-react";
import VacationRequestComponent from "@/app/dashboard/vacation/page";

interface VacationRequest {
  id: string;
  user_email: string;
  reason: string;
  start_date: string;
  end_date: string;
  days_requested?: number;
  status?: string; // 'pending' or 'approved' or 'rejected'
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

    // Check if current user is an admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const userIsAdmin = profile?.role?.toLowerCase() === 'admin';
    setIsAdmin(userIsAdmin);

    // Fetch all vacation requests for all users so everyone can view them
    const { data } = await supabase
      .from("vacation_history")
      .select("*")
      .order("start_date", { ascending: false });

    if (data) {
      // Filter out rejected ones if you don't want them showing up, or keep them if needed
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
      // Refresh the list after update
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
    if (filterType === 'approved') {
      return currentStatus === 'approved';
    }
    if (filterType === 'pending') {
      return currentStatus === 'pending';
    }
    return true; // 'all'
  });

  return (
    <div className="w-full space-y-4 text-white relative">
      {/* Header section */}
      <div className="flex flex-col border-b border-[#333] pb-4 gap-4 relative">
        {onBack && (
          <div className="flex justify-between items-center">
            <Button 
              onClick={onBack}
              title="Return"
              className="md:hidden bg-[#222] border border-[#333] hover:bg-[#333] text-gray-300 hover:text-white h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer shrink-0"
            >
              <ArrowLeft size={18} />
            </Button>
            <button 
              onClick={onBack}
              className="hidden md:flex ml-auto items-center gap-1.5 text-gray-400 hover:text-white transition cursor-pointer text-xs font-bold bg-[#222] border border-[#333] px-3 py-1.5 rounded-lg"
            >
              <X size={14} /> Close
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3 w-full">
            <div className="p-2.5 bg-[#ff8c00]/10 border border-[#ff8c00]/30 rounded-xl text-[#ff8c00] shrink-0">
              <Plane size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Vacation Leave Summary</h3>
              <p className="text-sm text-gray-400">Review all team vacation history and request time off.</p>
            </div>
          </div>

          <Button 
            onClick={() => setIsRequestModalOpen(true)}
            className="bg-[#ff8c00] text-black hover:bg-[#e07b00] font-bold text-xs cursor-pointer flex items-center gap-2 h-10 px-4 shrink-0 w-full sm:w-auto justify-center"
          >
            <Plus size={16} /> Request Vacation
          </Button>
        </div>
      </div>

      {/* Date Range Selector Toolbar */}
      <div className="flex flex-wrap items-center justify-center gap-3 bg-[#111] p-3 rounded-xl border border-[#333] text-xs">
        <span className="text-gray-400 flex items-center gap-1 font-medium">
          <Calendar size={14} className="text-[#ff8c00]" /> Date Range Filter:
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] text-white px-2.5 py-1.5 rounded-lg focus:border-[#ff8c00] outline-none cursor-pointer"
          />
          <span className="text-gray-500">to</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] text-white px-2.5 py-1.5 rounded-lg focus:border-[#ff8c00] outline-none cursor-pointer"
          />
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }} 
              className="text-[#ff8c00] hover:underline ml-2 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap justify-center gap-2 border-b border-[#333] pb-4">
        <Button 
          onClick={() => setFilterType('all')} 
          className={`text-xs cursor-pointer ${filterType === 'all' ? 'bg-[#ff8c00] text-black font-bold' : 'bg-[#222] text-white hover:bg-[#333]'}`}
        >
          All Requests ({vacations.length})
        </Button>
        <Button 
          onClick={() => setFilterType('approved')} 
          className={`text-xs cursor-pointer ${filterType === 'approved' ? 'bg-[#ff8c00] text-black font-bold' : 'bg-[#222] text-white hover:bg-[#333]'}`}
        >
          Approve Requests ({vacations.filter(v => (v.status || 'pending').toLowerCase() === 'approved').length})
        </Button>
        <Button 
          onClick={() => setFilterType('pending')} 
          className={`text-xs cursor-pointer ${filterType === 'pending' ? 'bg-[#ff8c00] text-black font-bold' : 'bg-[#222] text-white hover:bg-[#333]'}`}
        >
          Pending Requests ({vacations.filter(v => (v.status || 'pending').toLowerCase() === 'pending').length})
        </Button>
      </div>

      {/* Summary List Content */}
      <div className="space-y-3 min-h-[250px]">
        {loading ? (
          <p className="text-center text-gray-500 py-12 text-sm">Loading vacation records...</p>
        ) : filteredVacations.length > 0 ? (
          <div className="space-y-2">
            {filteredVacations.map((v) => {
              const status = (v.status || 'pending').toLowerCase();
              const isApproved = status === 'approved';
              
              return (
                <div key={v.id} className="bg-[#111] p-4 rounded-xl border border-[#333] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-white text-sm">{v.reason}</p>
                    <p className="text-gray-500 text-[11px]">Requested by: <span className="text-gray-300">{v.user_email}</span></p>
                    <p className="text-gray-400 flex items-center gap-1">
                      <Calendar size={12} className="text-[#ff8c00]" /> 
                      {v.start_date} to {v.end_date} {v.days_requested ? `(${v.days_requested} days)` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Admin Approval Actions for Pending items */}
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
                          : 'bg-[#ff8c00]/10 text-[#ff8c00] border-[#ff8c00]/30'
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
            <p className="text-gray-500 text-xs italic">No vacation requests found matching this filter or date range.</p>
          </div>
        )}
      </div>

      {/* Pop-up Modal containing the Vacation Request Form */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-md shadow-2xl relative">
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
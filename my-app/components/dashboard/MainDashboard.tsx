'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, History, Plane, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "./DashboardHeader"; // Import your separate header component
import BillingSummary from "./BillingSummary";
import ExpenseSummary from "./ExpenseSummary"; 
import ExpenseForm from "./ExpenseForm";
import RoleListenerModal from "@/components/RoleListenerModal";
import HistoryTab from "@/components/dashboard/HistoryTab";
import VacationSummaryModal from "@/components/dashboard/VacationSummaryModal";
import { Button } from "@/components/ui/button";

export default function MainDashboard({ userId, role }: { userId?: string; role?: string }) {
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [isButtonsVisible, setIsButtonsVisible] = useState(true);
  const [profile, setProfile] = useState<{ username: string; id?: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id) {
          const { data } = await supabase
            .from("profiles")
            .select("username, id, role")
            .eq("id", user.id)
            .maybeSingle();
            
          if (data) {
            setProfile(data);
          } else {
            setProfile({ 
              username: user.email?.split('@')[0] || "User", 
              id: user.id, 
              role: role || "Boarder" 
            });
          }
        }
      } catch (err) {
        console.error("MainDashboard init error:", err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [supabase, role]);

  const handleCloseAddModal = () => setIsAddFormOpen(false);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#111111]">
        <Loader2 className="animate-spin text-[#ff8c00]" size={48} />
      </div>
    );
  }

  const activeUserId = userId || profile?.id;
  const userRole = role || profile?.role || "Boarder";
  const isAdmin = userRole.toLowerCase() === 'admin';

  return (
    <div className="p-6 space-y-4 bg-[#111111] border border-[#ff8c00] rounded-2xl shadow-lg relative">
      
      {/* Realtime Role Change Listener Modal */}
      {activeUserId && <RoleListenerModal currentUserId={activeUserId} />}

      {/* Rendered Separate Dashboard Header Component */}
      <DashboardHeader 
        title={isAdmin ? "Admin Dashboard" : "User Dashboard"}
        role={userRole}
        username={profile?.username}
      />

      {/* Collapsible Action Buttons Bar */}
      <div className="flex justify-end items-center gap-2 relative min-h-[40px]">
        <Button
          onClick={() => setIsButtonsVisible(!isButtonsVisible)}
          title={isButtonsVisible ? "Collapse Actions" : "Expand Actions"}
          className="bg-[#222] border border-[#ff8c00] text-[#ff8c00] hover:bg-[#ff8c00] hover:text-black h-10 w-8 p-0 flex items-center justify-center rounded-xl cursor-pointer transition shadow-lg shadow-[#ff8c00]/10 z-10"
        >
          {isButtonsVisible ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </Button>

        <div className={`flex items-center gap-2 transition-all duration-300 overflow-hidden ${isButtonsVisible ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0 pointer-events-none'}`}>
          <Button
            onClick={() => setIsHistoryModalOpen(true)}
            title="History Logs"
            className="bg-[#222] border border-[#ff8c00] text-[#ff8c00] hover:bg-[#ff8c00] hover:text-black h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer transition shadow-lg shadow-[#ff8c00]/10"
          >
            <History size={18} />
          </Button>

          <Button
            onClick={() => setIsVacationModalOpen(true)}
            title="Vacation Leave Summary"
            className="bg-[#222] border border-[#ff8c00] text-[#ff8c00] hover:bg-[#ff8c00] hover:text-black h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer transition shadow-lg shadow-[#ff8c00]/10"
          >
            <Plane size={18} />
          </Button>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Add New Expense</h2>
            <ExpenseForm 
              onSuccess={handleCloseAddModal} 
              onCancel={handleCloseAddModal} 
            />
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-4xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="mt-2">
              <HistoryTab onBack={() => setIsHistoryModalOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Vacation Summary Modal */}
      {isVacationModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="mt-2">
              <VacationSummaryModal onBack={() => setIsVacationModalOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Merged Tabs Section */}
      <section className={`transition-all duration-300 ${isButtonsVisible ? 'mt-2' : '-mt-10'}`}>
        <div className="space-y-6">
          <Tabs defaultValue="bills" className="w-full">
            <TabsList className="bg-transparent border-b border-[#333] w-full justify-start rounded-none p-0 h-10 mb-6">
              <TabsTrigger value="bills" className="px-4">Bills</TabsTrigger>
              <TabsTrigger value="expenses" className="px-4">Expenses & Misc</TabsTrigger>
            </TabsList>
            
            <TabsContent value="bills">
              <BillingSummary userId={activeUserId} />
            </TabsContent>

            <TabsContent value="expenses" className="space-y-6">
              <ExpenseSummary userId={activeUserId} />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
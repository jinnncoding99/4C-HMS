// components/dashboard/MainDashboard.tsx
'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Loader2, History, Plane, ChevronLeft, ChevronRight, Sun, Moon, MoreHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "./DashboardHeader"; 
import { BillSummary } from "../billing/BillSummary";
import ExpenseSummary from "../expense/ExpenseSummary"; 
import ExpenseForm from "../expense/ExpenseForm";
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

  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [billSharesMap, setBillSharesMap] = useState<Record<string, any[]>>({});
  const [userPaymentRequests, setUserPaymentRequests] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchData = async () => {
    try {
      const { data: profilesData } = await supabase.from("profiles").select("*");
      if (profilesData) setProfilesList(profilesData);

      const { data: billsData } = await supabase.from("bills").select("*").order("created_at", { ascending: false });
      if (billsData) {
        setBills(billsData);

        const sharesMap: Record<string, any[]> = {};
        for (const bill of billsData) {
          const { data: sharesData } = await supabase
            .from("bill_shares")
            .select("*")
            .eq("bill_id", bill.id);
          
          if (sharesData) {
            sharesMap[bill.id] = sharesData.map((s: any) => {
              const matchedProfile = (profilesData || []).find((p: any) => p.id === s.boarder_id);
              return {
                id: s.boarder_id,
                username: matchedProfile?.username || 'Unknown',
                daysPresent: s.days_present || 0,
                shareDue: s.shared_amount || 0,
                paid_amount: s.paid_amount || 0,
                status: s.status || 'unpaid',
                isPaid: s.status === 'paid' || s.is_paid
              };
            });
          }
        }
        setBillSharesMap(sharesMap);
      }

      const { data: reqsData } = await supabase.from("payment_requests").select("*");
      if (reqsData) setUserPaymentRequests(reqsData);

    } catch (error) {
      console.error("Error fetching billing data:", error);
    }
  };

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
        await fetchData();
      } catch (err) {
        console.error("MainDashboard init error:", err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [supabase, role]);

  const handleCloseAddModal = () => setIsAddFormOpen(false);

  const handleDeleteBill = async (billId: string) => {
    try {
      const { error } = await supabase.from("bills").delete().eq("id", billId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error("Error deleting bill:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#F0F2F5] dark:bg-zinc-950 transition-colors">
        <Loader2 className="animate-spin text-[#4B49AC] dark:text-amber-500" size={48} />
      </div>
    );
  }

  const activeUserId = userId || profile?.id;
  const userRole = role || profile?.role || "Boarder";
  const isAdmin = userRole.toLowerCase() === 'admin';

  return (
    <div className="p-6 space-y-6 bg-[#F0F2F5] dark:bg-zinc-950 transition-colors relative min-h-screen">
      
      {activeUserId && <RoleListenerModal currentUserId={activeUserId} />}

      <DashboardHeader 
        title={isAdmin ? "Admin Dashboard" : "User Dashboard"}
        role={userRole}
        username={profile?.username}
      />

      <div className={`flex justify-end items-center gap-2 relative transition-all duration-300 ${isButtonsVisible ? 'my-3' : 'mt-2 mb-2'}`}>
        <Button
          onClick={() => setIsButtonsVisible(!isButtonsVisible)}
          title={isButtonsVisible ? "Collapse Actions" : "Expand Actions"}
          className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-[#4B49AC] dark:text-amber-500 hover:bg-[#4B49AC] hover:text-white dark:hover:bg-amber-500 dark:hover:text-black h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer transition shadow-sm z-10"
        >
          {isButtonsVisible ? <ChevronRight size={16} /> : <MoreHorizontal size={18} />}
        </Button>

        <div className={`flex items-center gap-2 transition-all duration-300 overflow-hidden ${isButtonsVisible ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0 invisible pointer-events-none'}`}>
          <Button
            onClick={() => setIsHistoryModalOpen(true)}
            title="History Logs"
            className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-[#4B49AC] dark:text-amber-500 hover:bg-[#4B49AC] hover:text-white dark:hover:bg-amber-500 dark:hover:text-black h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer transition shadow-sm shrink-0"
          >
            <History size={18} />
          </Button>

          <Button
            onClick={() => setIsVacationModalOpen(true)}
            title="Vacation Leave Summary"
            className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-[#4B49AC] dark:text-amber-500 hover:bg-[#4B49AC] hover:text-white dark:hover:bg-amber-500 dark:hover:text-black h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer transition shadow-sm shrink-0"
          >
            <Plane size={18} />
          </Button>

          <Button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Theme"
            className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-[#4B49AC] dark:text-amber-500 hover:bg-[#4B49AC] hover:text-white dark:hover:bg-amber-500 dark:hover:text-black h-10 w-10 p-0 flex items-center justify-center rounded-xl cursor-pointer transition shadow-sm shrink-0"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
        </div>
      </div>

      {isAddFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-[#4B49AC] dark:text-amber-500 mb-4">Add New Expense</h2>
            <ExpenseForm 
              onSuccess={handleCloseAddModal} 
              onCancel={handleCloseAddModal} 
            />
          </div>
        </div>
      )}

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-4xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="mt-2">
              <HistoryTab onBack={() => setIsHistoryModalOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {isVacationModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="mt-2">
              <VacationSummaryModal onBack={() => setIsVacationModalOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <section className="transition-all duration-300 mt-0">
        <div className="space-y-6">
          <Tabs defaultValue="bills" className="w-full">
            <TabsList className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 w-full justify-start rounded-xl p-1.5 h-auto mb-3 shadow-sm">
              <TabsTrigger 
                value="bills" 
                className="px-6 py-3 rounded-lg text-slate-600 dark:text-zinc-400 text-base font-semibold transition-all cursor-pointer hover:bg-[#4B49AC]/10 dark:hover:bg-amber-500/10 hover:text-[#4B49AC] dark:hover:text-amber-500 data-[state=active]:!bg-transparent dark:data-[state=active]:!bg-transparent data-[state=active]:!text-[#4B49AC] dark:data-[state=active]:!text-amber-500"
              >
                Monthly Bills
              </TabsTrigger>
              <TabsTrigger 
                value="expenses" 
                className="px-6 py-3 rounded-lg text-slate-600 dark:text-zinc-400 text-base font-semibold transition-all cursor-pointer hover:bg-[#4B49AC]/10 dark:hover:bg-amber-500/10 hover:text-[#4B49AC] dark:hover:text-amber-500 data-[state=active]:!bg-transparent dark:data-[state=active]:!bg-transparent data-[state=active]:!text-[#4B49AC] dark:data-[state=active]:!text-amber-500"
              >
                Expenses & Misc
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="bills" className="focus-visible:outline-none">
              <div className="w-full">
                <BillSummary 
                  userRole={userRole}
                  currentUserId={activeUserId}
                  userId={activeUserId}
                  profiles={profilesList}
                  bills={bills}
                  billSharesMap={billSharesMap}
                  userPaymentRequests={userPaymentRequests}
                  isMounted={isMounted}
                  fetchData={fetchData}
                  deleteBill={handleDeleteBill}
                />
              </div>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-6 focus-visible:outline-none">
              <div className="w-full">
                <ExpenseSummary userId={activeUserId} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
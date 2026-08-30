// components/dashboard/MainDashboard.tsx
'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, History, Plane, ChevronRight, FileText, Receipt, X, Edit2, Users, LogOut, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardHeader from "./DashboardHeader"; 
import { BillSummary } from "../billing/BillSummary";
import ExpenseSummary from "../expense/ExpenseSummary"; 
import ExpenseForm from "../expense/ExpenseForm";
import RoleListenerModal from "@/components/RoleListenerModal";
import HistoryTab from "@/components/dashboard/HistoryTab";
import VacationSummaryModal from "@/components/dashboard/VacationSummaryModal";
import UserManagementModal from "@/components/dashboard/UserManagementModal";
import EditProfileModal from "@/components/dashboard/EditProfileModal";

export default function MainDashboard({ userId, role }: { userId?: string; role?: string }) {
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  // Desktop hover state for push-drawer layout
  const [isDesktopDrawerOpen, setIsDesktopDrawerOpen] = useState(false);

  const [profile, setProfile] = useState<{ username: string; id?: string; role?: string; avatar_url?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Touch tracking refs for swipe-to-open gesture
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);

  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [billSharesMap, setBillSharesMap] = useState<Record<string, any[]>>({});
  
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseSharesMap, setExpenseSharesMap] = useState<Record<string, any[]>>({});

  const [userPaymentRequests, setUserPaymentRequests] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  
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

      const { data: expensesData } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
      if (expensesData) {
        setExpenses(expensesData);

        const expSharesMap: Record<string, any[]> = {};
        for (const expense of expensesData) {
          const { data: sharesData } = await supabase
            .from("expense_shares")
            .select("*")
            .eq("expense_id", expense.id);
          
          if (sharesData) {
            expSharesMap[expense.id] = sharesData;
          }
        }
        setExpenseSharesMap(expSharesMap);
      }

      const { data: reqsData, error: reqsError } = await supabase
        .from("notifications")
        .select("*")
        .in("type", ["payment_approval", "expense_approval"])
        .eq("status", "pending");
    
      if (!reqsError && reqsData) setUserPaymentRequests(reqsData);

    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id) {
        const { data } = await supabase
          .from("profiles")
          .select("username, id, role, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
          
        if (data) {
          setProfile(data);
        } else {
          setProfile({ 
            username: user.email?.split('@')[0] || "User", 
            id: user.id, 
            role: role || "Boarder",
            avatar_url: undefined
          });
        }
      }
    } catch (err) {
      console.error("Profile load error:", err);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        await loadUserProfile();
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

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error("Error deleting expense:", err);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current < 40 && touchCurrentX.current - touchStartX.current > 60) {
      setIsMobileNavOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#F0F2F5]">
        <Loader2 className="animate-spin text-[#4B49AC]" size={48} />
      </div>
    );
  }

  const activeUserId = userId || profile?.id;
  const userRole = role || profile?.role || "Boarder";
  const isAdmin = userRole.toLowerCase() === 'admin';

  return (
    <div 
      className="min-h-screen bg-[#F0F2F5] transition-colors relative overflow-x-hidden flex text-slate-900"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      
      {activeUserId && <RoleListenerModal currentUserId={activeUserId} />}

      {/* DESKTOP HOVER TRIGGER ZONE */}
      <div 
        className="hidden lg:block fixed left-0 top-0 w-6 h-full z-30"
        onMouseEnter={() => setIsDesktopDrawerOpen(true)}
      />

      {/* DESKTOP PUSH-DRAWER NAVIGATION PANEL */}
      <div 
        className={`hidden lg:flex flex-col justify-between fixed left-0 top-0 h-full w-72 bg-white/95 backdrop-blur-xl shadow-2xl z-40 p-5 border-r border-slate-200 transition-transform duration-300 ease-in-out ${isDesktopDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        onMouseLeave={() => setIsDesktopDrawerOpen(false)}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#4B49AC]/10 text-[#4B49AC] flex items-center justify-center font-bold text-sm shadow-inner overflow-hidden relative">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  profile?.username ? profile.username.charAt(0).toUpperCase() : 'V'
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{profile?.username}</p>
                <p className="text-[10px] text-slate-400 capitalize">{userRole}</p>
              </div>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">Menu</span>
          </div>

          <div className="space-y-1">
            <button 
              onClick={() => setIsEditProfileOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer border border-slate-200/70 bg-slate-50/60 shadow-xs"
            >
              <div className="flex items-center gap-3 text-[#4B49AC]">
                <Edit2 size={16} /> Edit Profile
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>

            <button 
              onClick={() => setIsUserManagementOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer mt-1"
            >
              <div className="flex items-center gap-3 text-[#4B49AC]">
                <Users size={16} /> User Management
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 px-3 tracking-wider uppercase mb-2">Quick Actions & Tools</p>
            
            <button 
              onClick={() => setIsVacationModalOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <div className="flex items-center gap-3 text-[#4B49AC]">
                <Plane size={16} /> Vacation Requests
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>

            <button 
              onClick={() => setIsHistoryModalOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <div className="flex items-center gap-3 text-[#4B49AC]">
                <History size={16} /> Transaction History
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 pb-1">
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/auth');
              router.refresh();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium text-red-600 hover:bg-red-500/10 transition cursor-pointer"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div className={`flex-1 p-4 sm:p-6 space-y-6 transition-all duration-300 ease-in-out ${isDesktopDrawerOpen ? 'lg:ml-72' : 'lg:ml-0'}`}>
        
        <DashboardHeader 
          title={isAdmin ? "Admin Dashboard" : "User Dashboard"}
          role={userRole}
          username={profile?.username}
          isMobileNavOpen={isMobileNavOpen}
          setIsMobileNavOpen={setIsMobileNavOpen}
          onOpenVacationModal={() => setIsVacationModalOpen(true)}
        />

        {/* Mobile Slide-Out Navigation Drawer */}
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" 
              onClick={() => setIsMobileNavOpen(false)}
            />

            <div className="relative w-80 bg-white/95 backdrop-blur-2xl h-full shadow-2xl z-10 p-5 flex flex-col justify-between animate-in slide-in-from-left duration-200 border-r border-white/20">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#4B49AC]/10 text-[#4B49AC] flex items-center justify-center font-bold text-sm shadow-inner overflow-hidden relative">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Profile" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        profile?.username ? profile.username.charAt(0).toUpperCase() : 'V'
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{profile?.username}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{userRole}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsMobileNavOpen(false)}
                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-1">
                  <button 
                    onClick={() => { setIsMobileNavOpen(false); setIsEditProfileOpen(true); }}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer border border-slate-200/70 bg-slate-50/60 shadow-xs"
                  >
                    <div className="flex items-center gap-3 text-[#4B49AC]">
                      <Edit2 size={16} /> Edit Profile
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>

                  <button 
                    onClick={() => { setIsMobileNavOpen(false); setIsUserManagementOpen(true); }}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer mt-1"
                  >
                    <div className="flex items-center gap-3 text-[#4B49AC]">
                      <Users size={16} /> User Management
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-slate-400 px-3 tracking-wider uppercase mb-2">Quick Actions & Tools</p>
                  
                  <button 
                    onClick={() => { setIsMobileNavOpen(false); setIsVacationModalOpen(true); }}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3 text-[#4B49AC]">
                      <Plane size={16} /> Vacation Requests
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>

                  <button 
                    onClick={() => { setIsMobileNavOpen(false); setIsHistoryModalOpen(true); }}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3 text-[#4B49AC]">
                      <History size={16} /> Transaction History
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 pb-1">
                <button 
                  onClick={async () => {
                    setIsMobileNavOpen(false);
                    await supabase.auth.signOut();
                    router.push('/auth');
                    router.refresh();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium text-red-600 hover:bg-red-500/10 transition cursor-pointer"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Management Modal Component */}
        <UserManagementModal 
          isOpen={isUserManagementOpen} 
          onClose={() => setIsUserManagementOpen(false)} 
          userRole={userRole}
        />

        {/* Edit Profile Modal Component */}
        <EditProfileModal 
          isOpen={isEditProfileOpen} 
          onClose={() => setIsEditProfileOpen(false)} 
          onProfileUpdated={loadUserProfile}
        />

        {/* Add Expense Form Modal */}
        {isAddFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-[#F0F2F5] text-slate-900 rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 w-full max-w-md shadow-2xl h-[85vh] sm:max-h-[85vh] flex flex-col overflow-hidden transition-colors animate-in slide-in-from-bottom duration-200">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-3 sm:hidden shrink-0" />
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <h2 className="text-xl font-bold text-[#4B49AC] mb-4">Add New Expense</h2>
                <ExpenseForm 
                  onSuccess={handleCloseAddModal} 
                  onCancel={handleCloseAddModal} 
                />
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-[#F0F2F5] text-slate-900 rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 w-full max-w-4xl shadow-2xl relative h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden transition-colors animate-in slide-in-from-bottom duration-200">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-3 sm:hidden shrink-0" />
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-transparent">
                <HistoryTab onBack={() => setIsHistoryModalOpen(false)} />
              </div>
            </div>
          </div>
        )}

        {/* Vacation Summary Modal */}
        {isVacationModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-[#F0F2F5] text-slate-900 rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 w-full max-w-3xl shadow-2xl relative h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden transition-colors animate-in slide-in-from-bottom duration-200">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-3 sm:hidden shrink-0" />
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-transparent">
                <VacationSummaryModal onBack={() => setIsVacationModalOpen(false)} />
              </div>
            </div>
          </div>
        )}

        {/* Main Tab Content Section */}
        <section className="transition-all duration-300 mt-0">
          <div className="space-y-6">
            <Tabs defaultValue="bills" className="w-full">
              <div className="w-full border-b border-slate-200 mb-6 overflow-x-auto scrollbar-none">
                <TabsList variant="line" className="w-full min-w-max justify-center space-x-8 md:space-x-12 px-2">
                  <TabsTrigger value="bills" className="cursor-pointer gap-2 px-1 text-sm md:text-base font-medium">
                    <FileText className="h-4 w-4 md:h-5 md:w-5" />
                    <span>Monthly Bills</span>
                  </TabsTrigger>
                  
                  <TabsTrigger value="expenses" className="cursor-pointer gap-2 px-1 text-sm md:text-base font-medium">
                    <Receipt className="h-4 w-4 md:h-5 md:w-5" />
                    <span>Expenses & Misc</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              
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
                <div className="w-full flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-inner">
                    <Lock size={28} />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-lg font-bold text-slate-900">Feature Not Yet Available</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      The Expenses & Misc tracking tab is currently under maintenance and will be available in an upcoming system update.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

      </div>
    </div>
  );
}
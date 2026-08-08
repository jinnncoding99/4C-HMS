'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { History, FileText, Download, Calendar, ArrowLeft, X, Eye, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { validateReceiptImage } from "./receiptValidator";

interface TransactionHistoryItem {
  id: string;
  original_bill_id?: string;
  description: string;
  total_amount: number;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  calculation_type?: string;
  settled_at?: string;
  payment_receiver?: string | null;
  payment_receiver_id?: string | null;
  url_receipt?: string | null;
  source_type: 'bill' | 'expense';
}

interface HistoryTabProps {
  onBack?: () => void;
}

export default function HistoryTab({ onBack }: HistoryTabProps) {
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Selection States
  const [selectedTx, setSelectedTx] = useState<TransactionHistoryItem | null>(null);
  
  // Current user state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Filter States
  const [filterType, setFilterType] = useState<'all' | 'bill' | 'expense'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Receipt view modal & replacement states
  const [viewingReceipt, setViewingReceipt] = useState(false);
  const [replacingReceipt, setReplacingReceipt] = useState(false);
  const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);

  // Validation States for Replacement
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isReplacementValid, setIsReplacementValid] = useState<boolean>(false);
  const [validationMessage, setValidationMessage] = useState<string>("");

  const supabase = createClient();

  useEffect(() => {
    fetchHistoryData();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email || null);
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];
      setCurrentUserName(fullName);
    }
  };

  const fetchHistoryData = async () => {
    setLoading(true);

    try {
      const { data: txData, error: txError } = await supabase
        .from("transaction_history")
        .select("*");
      
      if (txError) throw txError;

      const { data: expenseData, error: expenseError } = await supabase
        .from("expenses") 
        .select("*");

      if (expenseError) {
        console.warn("Could not fetch from expenses table:", expenseError.message);
      }

      const formattedBills: TransactionHistoryItem[] = (txData || []).map((item) => ({
        ...item,
        source_type: 'bill' as const,
      }));

      const formattedExpenses: TransactionHistoryItem[] = (expenseData || []).map((item) => ({
        id: item.id,
        description: item.description || item.title || 'Expense Item',
        total_amount: Number(item.amount || item.total_amount || 0),
        settled_at: item.settled_at || item.created_at || item.date,
        billing_period_start: item.billing_period_start || null,
        billing_period_end: item.billing_period_end || null,
        payment_receiver: item.payment_receiver || item.paid_to || 'N/A',
        payment_receiver_id: item.payment_receiver_id || null,
        url_receipt: item.url_receipt || item.receipt_url || null,
        calculation_type: item.calculation_type || 'expense',
        source_type: 'expense' as const,
      }));

      const combined = [...formattedBills, ...formattedExpenses].sort((a, b) => {
        const dateA = new Date(a.settled_at || 0).getTime();
        const dateB = new Date(b.settled_at || 0).getTime();
        return dateB - dateA;
      });

      setTransactionHistory(combined);
    } catch (err) {
      console.error("Error fetching history data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filterByDate = (dateString?: string | null) => {
    if (!dateString) return true;
    const itemDate = new Date(dateString).getTime();
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
    return itemDate >= start && itemDate <= end;
  };

  const filteredTransactions = transactionHistory.filter(tx => {
    const matchesType = filterType === 'all' || tx.source_type === filterType;
    const matchesDate = filterByDate(tx.settled_at || tx.billing_period_start);
    return matchesType && matchesDate;
  });

  const handleGenerateReport = () => {
    window.print();
  };

  const handleNewReceiptFileChange = async (file: File | null) => {
    setNewReceiptFile(file);
    setIsReplacementValid(false);
    setValidationMessage("");

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setIsReplacementValid(false);
      setValidationMessage("Invalid file type. Please upload a valid image file (PNG, JPG, JPEG).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setIsReplacementValid(false);
      setValidationMessage("File size is too large. Please upload an image smaller than 5MB.");
      return;
    }

    setIsScanning(true);
    setValidationMessage("Scanning replacement receipt with OCR...");

    try {
      const result = await validateReceiptImage(file, {
        expectedAmount: Number(selectedTx?.total_amount || 0),
        expectedRecipient: selectedTx?.payment_receiver || undefined
      });

      setIsScanning(false);
      setIsReplacementValid(result.isValid);

      if (result.isValid) {
        setValidationMessage(`Receipt verified successfully! (Confidence: ${Math.round(result.confidence)}%)`);
      } else {
        setValidationMessage(result.errors.join(' ') || "Invalid receipt image detected.");
      }
    } catch (error) {
      setIsScanning(false);
      setIsReplacementValid(false);
      setValidationMessage("An error occurred while scanning the receipt.");
      console.error("OCR validation handler error:", error);
    }
  };

  const handleReplaceReceipt = async () => {
    if (!selectedTx || !newReceiptFile || !isReplacementValid) return;

    setReplacingReceipt(true);
    try {
      const fileExt = newReceiptFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `receipts/settlements_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, newReceiptFile);

      if (uploadError) throw uploadError;

      const { data: publicURLData } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);
      const newUrl = publicURLData.publicUrl;

      const targetTable = selectedTx.source_type === 'expense' ? 'expenses' : 'transaction_history';

      const { error: updateError } = await supabase
        .from(targetTable)
        .update({ url_receipt: newUrl })
        .eq('id', selectedTx.id);

      if (updateError) throw updateError;

      alert("Receipt successfully verified and updated!");
      setNewReceiptFile(null);
      setViewingReceipt(false);
      
      const updatedTx = { ...selectedTx, url_receipt: newUrl };
      setSelectedTx(updatedTx);
      await fetchHistoryData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert("Failed to process receipt content: " + errorMessage);
    } finally {
      setReplacingReceipt(false);
    }
  };

  const handleDownloadReceipt = async (url?: string | null) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `receipt_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const isWithinFiveDays = (settledAt?: string | null) => {
    if (!settledAt) return false;
    const settledTime = new Date(settledAt).getTime();
    const currentTime = new Date().getTime();
    const diffDays = (currentTime - settledTime) / (1000 * 60 * 60 * 24);
    return diffDays <= 5;
  };

  const isPaymentReceiver = (tx: TransactionHistoryItem) => {
    if (currentUserId && tx.payment_receiver_id && tx.payment_receiver_id.trim() === currentUserId.trim()) {
      return true;
    }

    const receiver = tx.payment_receiver;
    if (!receiver) return false;
    const cleanReceiver = receiver.trim().toLowerCase();
    
    if (currentUserEmail && cleanReceiver === currentUserEmail.trim().toLowerCase()) return true;
    if (currentUserName && cleanReceiver === currentUserName.trim().toLowerCase()) return true;
    
    if (currentUserEmail) {
      const emailPrefix = currentUserEmail.split('@')[0].toLowerCase();
      if (cleanReceiver.includes(emailPrefix) || emailPrefix.includes(cleanReceiver)) return true;
    }
    if (currentUserName) {
      const namePart = currentUserName.toLowerCase();
      if (cleanReceiver.includes(namePart) || namePart.includes(cleanReceiver)) return true;
    }
    return false;
  };

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

        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 text-center lg:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="p-2.5 bg-[#ff8c00]/10 border border-[#ff8c00]/30 rounded-xl text-[#ff8c00] shrink-0">
              <History size={26} />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xl font-bold">Bill & Expense History</h3>
              <p className="text-sm text-gray-400">Review all settled bills, expenses, and transaction logs.</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0">
            <Button 
              onClick={handleGenerateReport} 
              className="bg-[#ff8c00] text-black hover:bg-[#e07b00] font-semibold text-xs cursor-pointer flex items-center gap-1.5 h-9"
            >
              <Download size={14} /> Generate Report
            </Button>
            <Button 
              onClick={fetchHistoryData} 
              className="bg-[#222] border border-[#333] text-gray-300 hover:text-white text-xs cursor-pointer h-9"
            >
              Refresh Logs
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar (Type Filter & Date Range Filter) */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-[#111] p-3 rounded-xl border border-[#333] text-xs">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-lg border border-[#333] w-full lg:w-auto justify-center">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              filterType === 'all' ? 'bg-[#ff8c00] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('bill')}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              filterType === 'bill' ? 'bg-[#ff8c00] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Bills
          </button>
          <button
            onClick={() => setFilterType('expense')}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              filterType === 'expense' ? 'bg-[#ff8c00] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Expenses
          </button>
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-gray-400 flex items-center gap-1 font-medium">
            <Calendar size={14} className="text-[#ff8c00]" /> Date:
          </span>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] text-white px-2 py-1.5 rounded-lg focus:border-[#ff8c00] outline-none cursor-pointer"
          />
          <span className="text-gray-500">to</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] text-white px-2 py-1.5 rounded-lg focus:border-[#ff8c00] outline-none cursor-pointer"
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

      {/* Content List */}
      <div className="space-y-3 min-h-[300px]">
        {loading ? (
          <p className="text-center text-gray-500 py-12 text-sm">Loading logs...</p>
        ) : filteredTransactions.length > 0 ? (
          <div className="space-y-2">
            {filteredTransactions.map(tx => (
              <div 
                key={`hist-tx-${tx.source_type}-${tx.id}`} 
                onClick={() => {
                  setSelectedTx(tx);
                  setNewReceiptFile(null);
                  setIsReplacementValid(false);
                  setValidationMessage("");
                  setViewingReceipt(false);
                }}
                className="bg-[#111] p-4 rounded-lg border border-[#333] hover:border-[#ff8c00]/50 transition cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white text-sm">{tx.description}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      tx.source_type === 'expense' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                    }`}>
                      {tx.source_type}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Receiver: <span className="text-white font-medium">{tx.payment_receiver || 'N/A'}</span> {tx.billing_period_start && `• Period: ${tx.billing_period_start} to ${tx.billing_period_end || 'N/A'}`}
                  </p>
                </div>
                <div className="text-left sm:text-right space-y-1 w-full sm:w-auto flex sm:block justify-between items-center">
                  <span className="bg-green-500/10 text-green-500 border border-green-500/30 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase inline-block">
                    Recorded
                  </span>
                  <p className="font-bold text-[#ff8c00] text-sm">₱{Number(tx.total_amount).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-12 text-xs italic">No records found matching this filter or date range.</p>
        )}
      </div>

      {/* Detailed Transaction Info Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#ff8c00] w-full max-w-lg shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#333] pb-3">
              <h4 className="font-bold text-base text-white flex items-center gap-2">
                <FileText size={18} className="text-[#ff8c00]" /> 
                {viewingReceipt ? "View Receipt Image" : "Record Details"}
              </h4>
              <button 
                onClick={() => {
                  setSelectedTx(null);
                  setViewingReceipt(false);
                }}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {!viewingReceipt ? (
              // Normal Detail View
              <>
                <div className="space-y-2.5 text-xs text-gray-300">
                  <div className="bg-[#111] p-3 rounded-lg border border-[#333] space-y-1.5">
                    <p><span className="text-gray-500">Record ID:</span> {selectedTx.id}</p>
                    <p><span className="text-gray-500">Type:</span> <span className="uppercase text-white font-medium">{selectedTx.source_type}</span></p>
                    <p><span className="text-gray-500">Description:</span> <span className="text-white font-medium">{selectedTx.description}</span></p>
                    <p><span className="text-gray-500">Payment Receiver:</span> <span className="text-white font-medium">{selectedTx.payment_receiver || 'N/A'}</span></p>
                    <p><span className="text-gray-500">Total Amount:</span> <span className="text-[#ff8c00] font-bold">₱{Number(selectedTx.total_amount || 0).toFixed(2)}</span></p>
                    {selectedTx.billing_period_start && (
                      <p><span className="text-gray-500">Billing Period:</span> {selectedTx.billing_period_start} to {selectedTx.billing_period_end || 'N/A'}</p>
                    )}
                    <p><span className="text-gray-500">Date Settled/Created:</span> {selectedTx.settled_at ? new Date(selectedTx.settled_at).toLocaleString() : 'N/A'}</p>

                    <div className="pt-2 border-t border-[#222]">
                      <span className="text-gray-500 block mb-1">Receipt Proof:</span>
                      {selectedTx.url_receipt ? (
                        <Button 
                          type="button"
                          onClick={() => setViewingReceipt(true)}
                          className="bg-[#222] hover:bg-[#333] border border-[#333] text-[#ff8c00] font-semibold text-xs h-8 px-3 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye size={14} /> View Receipt Image
                        </Button>
                      ) : (
                        <span className="text-gray-500 italic">No receipt attached</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    onClick={() => setSelectedTx(null)}
                    className="bg-[#222] border border-[#333] text-white hover:bg-[#333] text-xs h-8 cursor-pointer"
                  >
                    Close
                  </Button>
                </div>
              </>
            ) : (
              // Inline Receipt Viewer Sub-Modal Content
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-[#333] pb-2">
                  <button 
                    onClick={() => setViewingReceipt(false)}
                    className="flex items-center gap-1.5 text-gray-300 hover:text-white cursor-pointer bg-[#222] border border-[#333] px-2.5 py-1.5 rounded-lg font-medium"
                  >
                    <ArrowLeft size={14} /> Return to Details
                  </button>
                  <Button 
                    type="button"
                    onClick={() => handleDownloadReceipt(selectedTx.url_receipt)}
                    className="bg-[#ff8c00] hover:bg-[#e07b00] text-black font-semibold text-xs h-8 px-3 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} /> Download Receipt
                  </Button>
                </div>

                <div className="bg-[#111] p-3 rounded-lg border border-[#333] flex justify-center items-center overflow-hidden">
                  <img 
                    src={selectedTx.url_receipt || ''} 
                    alt="Receipt Proof" 
                    className="max-h-[350px] object-contain rounded border border-[#333]" 
                  />
                </div>

                {/* Replacement section */}
                {isPaymentReceiver(selectedTx) && isWithinFiveDays(selectedTx.settled_at) ? (
                  <div className="p-3 bg-[#181818] rounded border border-[#ff8c00]/40 space-y-2">
                    <p className="text-[11px] text-gray-300 font-semibold">Payment Receiver Access: Replace this receipt</p>
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleNewReceiptFileChange(e.target.files?.[0] || null)}
                      className="w-full text-xs text-gray-300 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-[#ff8c00] file:text-black hover:file:bg-[#e67e00] file:cursor-pointer bg-[#111] border border-[#333] rounded p-1 cursor-pointer"
                    />

                    {newReceiptFile && (
                      <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                        isScanning 
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : isReplacementValid 
                            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}>
                        {isScanning ? (
                          <>
                            <Loader2 size={16} className="shrink-0 text-blue-400 animate-spin" />
                            <span>{validationMessage}</span>
                          </>
                        ) : isReplacementValid ? (
                          <>
                            <CheckCircle2 size={16} className="shrink-0 text-green-400" />
                            <span>{validationMessage}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={16} className="shrink-0 text-red-400" />
                            <span>{validationMessage}</span>
                          </>
                        )}
                      </div>
                    )}

                    {newReceiptFile && (
                      <Button
                        type="button"
                        disabled={replacingReceipt || isScanning || !isReplacementValid}
                        onClick={handleReplaceReceipt}
                        className="bg-[#ff8c00] hover:bg-[#e67e00] disabled:opacity-50 text-black font-bold text-xs h-8 w-full cursor-pointer mt-1"
                      >
                        {replacingReceipt ? "Uploading..." : isScanning ? "Verifying..." : "Confirm Receipt Replacement"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 bg-[#111] rounded border border-[#333] text-center space-y-1">
                    <p className="text-[11px] text-gray-400 font-medium">
                      {isPaymentReceiver(selectedTx) 
                        ? "Payment Receiver Access Active" 
                        : `Note: Only the designated payment receiver (${selectedTx.payment_receiver || 'N/A'}) can replace this receipt.`}
                    </p>
                    {!isWithinFiveDays(selectedTx.settled_at) && (
                      <p className="text-[10px] text-gray-500 italic">The 5-day window to replace this receipt has expired.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
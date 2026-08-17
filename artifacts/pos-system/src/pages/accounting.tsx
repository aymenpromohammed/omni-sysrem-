import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import omnisystemLogo from "@/assets/images/omnisystem_pro_logo_1784250216808.png";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, Eye, Search, FileText, Printer, Sliders, RefreshCw, Sparkles,
  Wallet, Edit, BookOpen, CheckCircle, AlertTriangle, Building2, TrendingUp,
  ArrowRightLeft, Landmark, Layers, ShieldCheck, Scale, Calculator, ArrowUpRight,
  ArrowDownLeft, Calendar, FileSpreadsheet, Lock
} from "lucide-react";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPut(url: string, body: any) { const r = await fetchAuth(url, { method: "PUT", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); }

function fmt(n?: number) { return Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function Accounting() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [location] = useLocation();

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      return p.get("tab") || "dashboard";
    }
    return "dashboard";
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const tabParam = params.get("tab");
      if (tabParam) {
        setActiveTab(tabParam);
      } else {
        setActiveTab("dashboard");
      }
    };
    handleUrlChange();
    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, [location]);

  /* ─── Queries ─── */
  const { data: dashboardStats, refetch: refetchDashboard } = useQuery({
    queryKey: ["accounting-dashboard-stats"],
    queryFn: () => apiGet("/api/accounting/dashboard-stats"),
  });

  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees-list"], queryFn: () => apiGet("/api/hr/employees") });
  const { data: customers = [] } = useQuery({ queryKey: ["customers-list"], queryFn: () => apiGet("/api/customers") });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-list"], queryFn: () => apiGet("/api/suppliers").catch(() => []) });
  const { data: systemUsers = [] } = useQuery({ queryKey: ["system-users-list"], queryFn: () => apiGet("/api/accounting/system-users").catch(() => []) });
  const { data: vouchers = [], refetch: refetchVouchers } = useQuery({ queryKey: ["vouchers-list"], queryFn: () => apiGet("/api/accounting/vouchers") });
  const { data: docPrintSettings, refetch: refetchDocSettings } = useQuery({ queryKey: ["document-print-settings"], queryFn: () => apiGet("/api/document-print-settings") });
  const { data: safes = [], refetch: refetchSafes } = useQuery({ queryKey: ["safes-list"], queryFn: () => apiGet("/api/safes") });
  const { data: bankAccounts = [], refetch: refetchBanks } = useQuery({ queryKey: ["bank-accounts-list"], queryFn: () => apiGet("/api/accounting/bank-accounts") });
  const { data: transfers = [], refetch: refetchTransfers } = useQuery({ queryKey: ["transfers-list"], queryFn: () => apiGet("/api/accounting/transfers") });
  const { data: fixedAssets = [], refetch: refetchAssets } = useQuery({ queryKey: ["fixed-assets-list"], queryFn: () => apiGet("/api/accounting/fixed-assets") });
  const { data: recurringExpenses = [], refetch: refetchRecurring } = useQuery({ queryKey: ["recurring-expenses-list"], queryFn: () => apiGet("/api/accounting/recurring-expenses") });
  const { data: costCenters = [], refetch: refetchCostCenters } = useQuery({ queryKey: ["cost-centers-list"], queryFn: () => apiGet("/api/accounting/cost-centers") });
  const { data: fiscalPeriods = [], refetch: refetchFiscalPeriods } = useQuery({ queryKey: ["fiscal-periods-list"], queryFn: () => apiGet("/api/accounting/fiscal-periods") });

  const { data: accountsList = [], refetch: refetchAccounts } = useQuery({
    queryKey: ["accounts-list"],
    queryFn: () => apiGet("/api/accounting/accounts"),
  });

  const { data: journalEntries = [], refetch: refetchJournal } = useQuery({
    queryKey: ["journal-entries-list"],
    queryFn: () => apiGet("/api/accounting/journal-entries"),
  });

  const { data: trialBalance, refetch: refetchTrialBalance } = useQuery({
    queryKey: ["trial-balance-data"],
    queryFn: () => apiGet("/api/accounting/trial-balance"),
  });

  // Financial Statements Queries
  const { data: incomeStatement } = useQuery({
    queryKey: ["report-income-statement"],
    queryFn: () => apiGet("/api/accounting/reports/income-statement"),
    enabled: activeTab === "financials"
  });

  const { data: balanceSheet } = useQuery({
    queryKey: ["report-balance-sheet"],
    queryFn: () => apiGet("/api/accounting/reports/balance-sheet"),
    enabled: activeTab === "financials"
  });

  const { data: cashFlow } = useQuery({
    queryKey: ["report-cash-flow"],
    queryFn: () => apiGet("/api/accounting/reports/cash-flow"),
    enabled: activeTab === "financials"
  });

  /* ─── Helper for active section titles ─── */
  const getTabTitle = (tab: string) => {
    switch (tab) {
      case "chart": return "دليل الحسابات";
      case "journal": return "سجل القيود اليومية والمزدوجة";
      case "trial": return "ميزان المراجعة الشامل";
      case "vouchers": return "سندات القبض والصرف";
      case "safes": return "إدارة الصناديق والخزائن";
      case "banks": return "البنوك والتحويلات المالية";
      case "statements": return "كشوفات الحسابات";
      case "assets": return "الأصول الثابتة والإهلاك";
      case "recurring": return "المصروفات المتكررة";
      case "financials": return "القوائم المالية الختامية";
      default: return "لوحة التحكم المالية";
    }
  };

  /* ─── Global Document Print Settings (من تهيئة النظام) ─── */
  const [docForm, setDocForm] = useState({
    companyName: "مخابز الشام للخبز العربي",
    companySubtitle: "Maamil Al Sham",
    logoUrl: "/omnisystem-logo.png",
    customerHeaderText: "كشف حساب عميل معتمد",
    customerFooterText: "شكراً لتعاملكم معنا - يُرجى مراجعة الحسابات خلال 15 يوماً",
    employeeHeaderText: "كشف حساب ومسير رواتب موظف",
    employeeFooterText: "إدارة الموارد البشرية - التوقيع والاعتماد",
    voucherReceiptTitle: "سند قبض",
    voucherPaymentTitle: "سند صرف",
    voucherFooterText: "جودة الخبز ... سر ثقة عملائنا",
    reportHeaderText: "تقرير عام شامل",
    reportFooterText: "طبع بواسطة نظام OmniSystem Pro",
    accentColor: "#ef4444",
  });

  useEffect(() => {
    if (docPrintSettings && !docPrintSettings.error) {
      setDocForm(docPrintSettings);
    }
  }, [docPrintSettings]);

  const saveDocSettingsMutation = useMutation({
    mutationFn: (data: any) => apiPut("/api/document-print-settings", data),
    onSuccess: () => {
      toast({ title: "تم حفظ إعدادات وثائق وسندات النظام بنجاح" });
      refetchDocSettings();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل حفظ الإعدادات", description: e.message }),
  });

  /* ─── Account Statement State ─── */
  const [statementPartyType, setStatementPartyType] = useState<"employee" | "customer" | "supplier" | "account" | "user">("customer");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [stmtStartDate, setStmtStartDate] = useState<string>("");
  const [stmtEndDate, setStmtEndDate] = useState<string>("");
  const [showStatementPrintModal, setShowStatementPrintModal] = useState(false);

  const { data: statementData, isFetching: loadingStatement, refetch: refetchStatement } = useQuery({
    queryKey: ["party-statement", statementPartyType, selectedPartyId, stmtStartDate, stmtEndDate],
    queryFn: () => {
      if (statementPartyType === "account") {
        return apiGet(`/api/accounting/accounts/${selectedPartyId}/ledger`).then((res: any) => ({
          party: { id: res.account?.id, name: `${res.account?.code} - ${res.account?.name}`, phone: "حساب عام", address: "دليل الحسابات" },
          previousBalance: 0,
          currentBalance: res.account?.balance ?? 0,
          transactions: (res.ledger || []).map((l: any) => ({
            id: l.id,
            date: l.entry_date,
            description: l.journal_desc || l.description || "قيد يومية",
            debit: l.debit,
            credit: l.credit,
            running_balance: l.running_balance,
            notes: l.source_type || ""
          }))
        }));
      }
      return apiGet(`/api/accounting/statement/${statementPartyType}/${selectedPartyId}?start_date=${stmtStartDate}&end_date=${stmtEndDate}`);
    },
    enabled: !!selectedPartyId,
  });

  /* ─── Vouchers Dialog State ─── */
  const [showNewVoucherDlg, setShowNewVoucherDlg] = useState(false);
  const [viewVoucher, setViewVoucher] = useState<any>(null);
  const [voucherForm, setVoucherForm] = useState({
    type: "receipt",
    party_type: "customer" as "employee" | "customer" | "supplier" | "general" | "user",
    party_id: "",
    amount: "",
    received_from: "",
    payment_against: "",
    payment_method: "cash",
    amount_text: "",
    notes: "",
    safe_id: "",
    bank_account_id: "",
    cost_center_id: ""
  });

  const createVoucherMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/vouchers", data),
    onSuccess: () => {
      toast({ title: "تم إصدار وتوثيق السند المالي والقيد الآلي بنجاح" });
      setShowNewVoucherDlg(false);
      setVoucherForm({ type: "receipt", party_type: "customer", party_id: "", amount: "", received_from: "", payment_against: "", payment_method: "cash", amount_text: "", notes: "", safe_id: "", bank_account_id: "", cost_center_id: "" });
      refetchVouchers();
      refetchSafes();
      refetchBanks();
      refetchDashboard();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إصدار السند", description: e.message })
  });

  /* ─── Manual Account Entry State ─── */
  const [showManualDlg, setShowManualDlg] = useState(false);
  const [manualForm, setManualForm] = useState({
    description: "", debit: "0", credit: "0", entry_date: new Date().toISOString().slice(0, 10), notes: ""
  });

  const addManualMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/manual-entries", {
      party_type: statementPartyType,
      party_id: Number(selectedPartyId),
      ...data,
      debit: Number(data.debit || 0),
      credit: Number(data.credit || 0),
    }),
    onSuccess: () => {
      toast({ title: "تم تسجيل القيد اليدوي بنجاح" });
      setShowManualDlg(false);
      setManualForm({ description: "", debit: "0", credit: "0", entry_date: new Date().toISOString().slice(0, 10), notes: "" });
      refetchStatement();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة القيد", description: e.message }),
  });

  /* ─── Chart of Accounts State ─── */
  const [showAddAccountDlg, setShowAddAccountDlg] = useState(false);
  const [accountForm, setAccountForm] = useState({ code: "", name: "", type: "asset", parent_code: "" });
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<any>(null);

  const { data: ledgerData } = useQuery({
    queryKey: ["account-ledger", selectedLedgerAccount?.id],
    queryFn: () => apiGet(`/api/accounting/accounts/${selectedLedgerAccount.id}/ledger`),
    enabled: !!selectedLedgerAccount?.id
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/accounts", data),
    onSuccess: () => {
      toast({ title: "تمت إضافة الحساب إلى دليل الحسابات بنجاح" });
      setShowAddAccountDlg(false);
      setAccountForm({ code: "", name: "", type: "asset", parent_code: "" });
      refetchAccounts();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إنشاء الحساب", description: e.message })
  });

  /* ─── Manual Journal Entry State ─── */
  const [showNewJournalDlg, setShowNewJournalDlg] = useState(false);
  const [journalForm, setJournalForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    lines: [
      { account_code: "11100", debit: "", credit: "", description: "" },
      { account_code: "41000", debit: "", credit: "", description: "" }
    ]
  });

  const createJournalMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/journal-entries", data),
    onSuccess: () => {
      toast({ title: "تم تسجيل القيد اليومي المزدوج وتحديث الأرصدة بنجاح" });
      setShowNewJournalDlg(false);
      refetchJournal();
      refetchAccounts();
      refetchTrialBalance();
      refetchDashboard();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تسجيل القيد", description: e.message })
  });

  const reverseJournalMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/api/accounting/journal-entries/${id}/reverse`, {}),
    onSuccess: () => {
      toast({ title: "تم عكس وتصحيح القيد بنجاح" });
      refetchJournal();
      refetchAccounts();
      refetchTrialBalance();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل عكس القيد", description: e.message })
  });

  /* ─── Safes State ─── */
  const [showSafeDlg, setShowSafeDlg] = useState(false);
  const [editingSafe, setEditingSafe] = useState<any>(null);
  const [safeForm, setSafeForm] = useState({ name: "", balance: "0", currency: "ريال", notes: "", active: true });

  const saveSafeMutation = useMutation({
    mutationFn: (data: any) => editingSafe ? apiPut(`/api/safes/${editingSafe.id}`, data) : apiPost("/api/safes", data),
    onSuccess: () => {
      toast({ title: editingSafe ? "تم تحديث الخزينة" : "تمت إضافة الخزينة بنجاح" });
      setShowSafeDlg(false);
      setEditingSafe(null);
      refetchSafes();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الحفظ", description: e.message })
  });

  /* ─── Bank Account & Transfer Dialog State ─── */
  const [showBankDlg, setShowBankDlg] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: "", account_number: "", iban: "", swift: "", balance: "0", currency: "ريال", notes: "" });

  const createBankMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/bank-accounts", data),
    onSuccess: () => {
      toast({ title: "تمت إضافة الحساب البنكي بنجاح" });
      setShowBankDlg(false);
      setBankForm({ bank_name: "", account_number: "", iban: "", swift: "", balance: "0", currency: "ريال", notes: "" });
      refetchBanks();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة البنك", description: e.message })
  });

  const [showTransferDlg, setShowTransferDlg] = useState(false);
  const [transferForm, setTransferForm] = useState({
    transfer_date: new Date().toISOString().slice(0, 10),
    from_type: "safe",
    from_id: "",
    to_type: "bank",
    to_id: "",
    amount: "",
    notes: ""
  });

  const createTransferMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/transfers", data),
    onSuccess: () => {
      toast({ title: "تم تنفيذ عملية التحويل وقيد الأثر المالي بنجاح" });
      setShowTransferDlg(false);
      setTransferForm({ transfer_date: new Date().toISOString().slice(0, 10), from_type: "safe", from_id: "", to_type: "bank", to_id: "", amount: "", notes: "" });
      refetchTransfers();
      refetchSafes();
      refetchBanks();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التحويل", description: e.message })
  });

  /* ─── Fixed Assets State ─── */
  const [showAssetDlg, setShowAssetDlg] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: "", category: "أجهزة ومعدات", purchase_date: new Date().toISOString().slice(0, 10),
    purchase_cost: "", salvage_value: "0", useful_life_years: "5", location: "المقر الرئيسي", responsible_person: "مدير الفرع"
  });

  const createAssetMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/fixed-assets", data),
    onSuccess: () => {
      toast({ title: "تم تسجيل الأصل الثابت وقيد الشراء بنجاح" });
      setShowAssetDlg(false);
      setAssetForm({ name: "", category: "أجهزة ومعدات", purchase_date: new Date().toISOString().slice(0, 10), purchase_cost: "", salvage_value: "0", useful_life_years: "5", location: "المقر الرئيسي", responsible_person: "مدير الفرع" });
      refetchAssets();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تسجيل الأصل", description: e.message })
  });

  const runDepreciationMutation = useMutation({
    mutationFn: () => apiPost("/api/accounting/run-depreciation", {}),
    onSuccess: (res) => {
      toast({ title: res.message, description: `إجمالي الإهلاك المحتسب: ${fmt(res.totalDepreciated)} ريال` });
      refetchAssets();
      refetchJournal();
      refetchDashboard();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل احتساب الإهلاك", description: e.message })
  });

  /* ─── Recurring Expenses State ─── */
  const [showRecurringDlg, setShowRecurringDlg] = useState(false);
  const [recurringForm, setRecurringForm] = useState({
    title: "", category: "إيجار", amount: "", frequency: "monthly", next_due_date: new Date().toISOString().slice(0, 10), notes: ""
  });

  const createRecurringMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/recurring-expenses", data),
    onSuccess: () => {
      toast({ title: "تم تسجيل المصروف المتكرر والتنبيه بنجاح" });
      setShowRecurringDlg(false);
      setRecurringForm({ title: "", category: "إيجار", amount: "", frequency: "monthly", next_due_date: new Date().toISOString().slice(0, 10), notes: "" });
      refetchRecurring();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الحفظ", description: e.message })
  });

  const generateRecurringMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/api/accounting/recurring-expenses/${id}/generate`, {}),
    onSuccess: () => {
      toast({ title: "تمت معالجة المصروف وتوليد سند الصرف وتأجيل الموعد بنجاح" });
      refetchRecurring();
      refetchVouchers();
      refetchDashboard();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل التوليد", description: e.message })
  });

  /* ─── Cost Centers & Fiscal Periods ─── */
  const [showCostCenterDlg, setShowCostCenterDlg] = useState(false);
  const [costCenterForm, setCostCenterForm] = useState({ code: "", name: "", notes: "" });

  const createCostCenterMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/cost-centers", data),
    onSuccess: () => {
      toast({ title: "تم إضافة مركز التكلفة بنجاح" });
      setShowCostCenterDlg(false);
      setCostCenterForm({ code: "", name: "", notes: "" });
      refetchCostCenters();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل الإضافة", description: e.message })
  });

  const closeFiscalPeriodMutation = useMutation({
    mutationFn: (id: number) => apiPost(`/api/accounting/fiscal-periods/${id}/close`, {}),
    onSuccess: () => {
      toast({ title: "تم إغلاق الفترة المالية وقفل تعديل القيود" });
      refetchFiscalPeriods();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إغلاق الفترة", description: e.message })
  });

  // Calculate journal totals for modal
  const journalDebitSum = journalForm.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const journalCreditSum = journalForm.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isJournalBalanced = Math.abs(journalDebitSum - journalCreditSum) < 0.01 && journalDebitSum > 0;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-4 dir-rtl" dir="rtl">
        
        {/* Compact Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm gap-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-indigo-900 text-indigo-100 font-extrabold text-xs px-3 py-1">
              {getTabTitle(activeTab)}
            </Badge>
            {activeTab !== "dashboard" && (
              <Button
                onClick={() => {
                  setActiveTab("dashboard");
                  const u = new URL(window.location.href);
                  u.searchParams.set("tab", "dashboard");
                  window.history.pushState({}, "", u.toString());
                  window.dispatchEvent(new Event("popstate"));
                }}
                variant="outline"
                size="sm"
                className="gap-2 font-bold text-xs text-indigo-900 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800 cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                ← العودة إلى لوحة التحكم المالية
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchDashboard();
              refetchAccounts();
              refetchVouchers();
              refetchSafes();
              refetchBanks();
              toast({ title: "تم تحديث البيانات المالية من الخادم" });
            }}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
            تحديث الأرصدة
          </Button>
        </div>

        {/* Main Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val);
            const u = new URL(window.location.href);
            u.searchParams.set("tab", val);
            window.history.pushState({}, "", u.toString());
            window.dispatchEvent(new Event("popstate"));
          }}
          className="w-full space-y-6"
        >
          <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <TabsList className="flex w-max min-w-full justify-start gap-1 bg-transparent p-0 h-auto">
              <TabsTrigger value="dashboard" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <TrendingUp className="w-4 h-4" />
                لوحة التحكم المالية
              </TabsTrigger>
              <TabsTrigger value="chart" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <BookOpen className="w-4 h-4" />
                دليل الحسابات
              </TabsTrigger>
              <TabsTrigger value="journal" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Scale className="w-4 h-4" />
                القيود وميزان المراجعة
              </TabsTrigger>
              <TabsTrigger value="vouchers" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <FileText className="w-4 h-4" />
                سندات القبض والصرف
              </TabsTrigger>
              <TabsTrigger value="safes" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Wallet className="w-4 h-4" />
                إدارة الصناديق
              </TabsTrigger>
              <TabsTrigger value="banks" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Landmark className="w-4 h-4" />
                البنوك والتحويلات
              </TabsTrigger>
              <TabsTrigger value="statements" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <FileSpreadsheet className="w-4 h-4" />
                كشوفات الحسابات
              </TabsTrigger>
              <TabsTrigger value="assets" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Building2 className="w-4 h-4" />
                الأصول والإهلاك
              </TabsTrigger>
              <TabsTrigger value="recurring" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Calendar className="w-4 h-4" />
                المصروفات المتكررة
              </TabsTrigger>
              <TabsTrigger value="financials" className="px-4 py-2.5 rounded-lg text-xs font-semibold gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Calculator className="w-4 h-4" />
                القوائم المالية الختامية
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 1: FINANCIAL DASHBOARD */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-6 m-0">

            {/* Quick Actions Control Panel Grid (لوحة التحكم والمهام المالية) */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-black text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-indigo-600" />
                    لوحة التحكم والمهام المالية والحسابية
                  </span>
                  <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-800 border-indigo-200 font-bold dark:bg-indigo-950 dark:text-indigo-300">
                    10 وحدات محاسبية رئيسية
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  وصول سريع ومنظم لكافة المهام المحاسبية الموحدة: الدليل، القيود، ميزان المراجعة، السندات، الصناديق، البنوك، والتقارير الختامية.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  
                  {/* 1. دليل الحسابات */}
                  <div
                    onClick={() => setActiveTab("chart")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">دليل الحسابات</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الشجرة المحاسبية المستوائية</p>
                      </div>
                    </div>
                  </div>

                  {/* 2. القيود وميزان المراجعة */}
                  <div
                    onClick={() => setActiveTab("journal")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Scale className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">القيود وميزان المراجعة</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">سجل اليومية العامة والتوازن</p>
                      </div>
                    </div>
                  </div>

                  {/* 3. سندات القبض والصرف */}
                  <div
                    onClick={() => setActiveTab("vouchers")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600">سندات القبض والصرف</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">إصدار وتوثيق المقبوضات</p>
                      </div>
                    </div>
                  </div>

                  {/* 4. إدارة الصناديق */}
                  <div
                    onClick={() => setActiveTab("safes")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-amber-50/80 dark:hover:bg-amber-950/40 hover:border-amber-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600">إدارة الصناديق</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الخزائن والسيولة النقدية</p>
                      </div>
                    </div>
                  </div>

                  {/* 5. البنوك والتحويلات */}
                  <div
                    onClick={() => setActiveTab("banks")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-purple-50/80 dark:hover:bg-purple-950/40 hover:border-purple-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600">البنوك والتحويلات</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الحسابات البنكية والتسويات</p>
                      </div>
                    </div>
                  </div>

                  {/* 6. كشوفات الحسابات */}
                  <div
                    onClick={() => setActiveTab("statements")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-sky-50/80 dark:hover:bg-sky-950/40 hover:border-sky-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-sky-600">كشوفات الحسابات</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">العملاء والموردين والأستاذ</p>
                      </div>
                    </div>
                  </div>

                  {/* 7. الأصول والإهلاك */}
                  <div
                    onClick={() => setActiveTab("assets")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 hover:border-rose-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-rose-600">الأصول والإهلاك</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">سجل الأصول ومعدل الإهلاك</p>
                      </div>
                    </div>
                  </div>

                  {/* 8. المصروفات المتكررة */}
                  <div
                    onClick={() => setActiveTab("recurring")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-teal-50/80 dark:hover:bg-teal-950/40 hover:border-teal-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-teal-600">المصروفات المتكررة</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الإيجارات والاشتراكات الدورية</p>
                      </div>
                    </div>
                  </div>

                  {/* 9. القوائم المالية الختامية */}
                  <div
                    onClick={() => setActiveTab("financials")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-cyan-50/80 dark:hover:bg-cyan-950/40 hover:border-cyan-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Calculator className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-600">القوائم المالية الختامية</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الأرباح والخسائر والميزانية</p>
                      </div>
                    </div>
                  </div>

                  {/* 10. ميزان المراجعة الشامل */}
                  <div
                    onClick={() => setActiveTab("trial")}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-900 text-indigo-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Scale className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600">ميزان المراجعة الشامل</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">تقرير ميزان الأرصدة المتزن</p>
                      </div>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                    مبيعات اليوم
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-emerald-950 dark:text-emerald-100">{fmt(dashboardStats?.todaySales)} ريال</div>
                  <p className="text-[10px] text-emerald-600 mt-1">المبيعات الموثقة بالنظام اليوم</p>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center justify-between">
                    مشتريات اليوم
                    <ArrowDownLeft className="w-4 h-4 text-blue-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-blue-950 dark:text-blue-100">{fmt(dashboardStats?.todayPurchases)} ريال</div>
                  <p className="text-[10px] text-blue-600 mt-1">فواتير المشتريات المستلمة اليوم</p>
                </CardContent>
              </Card>

              <Card className="border-rose-200 bg-rose-50/50 dark:bg-rose-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center justify-between">
                    إجمالي المصروفات
                    <FileText className="w-4 h-4 text-rose-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-rose-950 dark:text-rose-100">{fmt(dashboardStats?.totalExpenses)} ريال</div>
                  <p className="text-[10px] text-rose-600 mt-1">تشغيل، إيجار، رواتب، وصيانة</p>
                </CardContent>
              </Card>

              <Card className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-indigo-700 dark:text-indigo-400 flex items-center justify-between">
                    أرصدة الصناديق والخزائن
                    <Wallet className="w-4 h-4 text-indigo-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-indigo-950 dark:text-indigo-100">{fmt(dashboardStats?.safesBalance)} ريال</div>
                  <p className="text-[10px] text-indigo-600 mt-1">النقد المتوفر بكافة الصناديق</p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-purple-700 dark:text-purple-400 flex items-center justify-between">
                    أرصدة البنوك
                    <Landmark className="w-4 h-4 text-purple-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-purple-950 dark:text-purple-100">{fmt(dashboardStats?.bankBalance)} ريال</div>
                  <p className="text-[10px] text-purple-600 mt-1">إجمالي السيولة بالحسابات البنكية</p>
                </CardContent>
              </Card>
            </div>

            {/* Second Row Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
                    م
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">مستحقات الموردين (ذمم دائنة)</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{fmt(dashboardStats?.supplierPayables)} ريال</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 flex items-center justify-center font-bold text-lg">
                    ع
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">مستحقات العملاء (ذمم مدينة)</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{fmt(dashboardStats?.customerReceivables)} ريال</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 flex items-center justify-center font-bold text-lg">
                    قبض
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي المقبوضات المحصلة</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{fmt(dashboardStats?.totalReceipts)} ريال</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-indigo-800">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-lg">
                    ربح
                  </div>
                  <div>
                    <p className="text-xs text-indigo-200">صافي الربح التقديري</p>
                    <p className="text-lg font-bold text-white mt-0.5">{fmt(dashboardStats?.netProfit)} ريال</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Bills & Top Expense Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Overdue Bills Table */}
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    فواتير المشتريات الآجلة المستحقة السداد
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {dashboardStats?.overdueBills && dashboardStats.overdueBills.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dashboardStats.overdueBills.map((bill: any) => (
                        <div key={bill.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{bill.supplier_name}</p>
                            <p className="text-slate-500 text-[11px] mt-0.5">فاتورة رقم #{bill.invoice_number} — استحقاق: {bill.due_date}</p>
                          </div>
                          <div className="text-left">
                            <span className="font-bold text-rose-600 dark:text-rose-400">{fmt(bill.remaining_amount)} ريال</span>
                            <Badge className="block mt-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px]">
                              غير مدفوعة بالكامل
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500">لا توجد فواتير مشتريات مستحقة الدفع حالياً.</div>
                  )}
                </CardContent>
              </Card>

              {/* Expense Category Breakdown */}
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    تحليل أعلى تصنيفات المصروفات التشغيلية
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {dashboardStats?.expenseBreakdown && dashboardStats.expenseBreakdown.length > 0 ? (
                    dashboardStats.expenseBreakdown.map((item: any, idx: number) => {
                      const totalExp = dashboardStats.totalExpenses || 1;
                      const percent = Math.round((item.amount / totalExp) * 100);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-800 dark:text-slate-200">{item.category}</span>
                            <span className="text-indigo-600 dark:text-indigo-400">{fmt(item.amount)} ريال ({percent}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(percent, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500">لا توجد مصاريف مسجلة حتى الآن.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 2: CHART OF ACCOUNTS (دليل الحسابات) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="chart" className="space-y-6 m-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                <Input
                  placeholder="بحث عن حساب برقم الرمز أو الاسم..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="pr-9 text-xs"
                />
              </div>

              <Button
                onClick={() => setShowAddAccountDlg(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة حساب جديد لدليل الحسابات
              </Button>
            </div>

            {/* Tree / Table View */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">رمز الحساب</th>
                      <th className="p-3">اسم الحساب المحاسبي</th>
                      <th className="p-3">نوع الحساب</th>
                      <th className="p-3">الحساب الأب</th>
                      <th className="p-3">الرصيد الحالي</th>
                      <th className="p-3 text-center">الحالة</th>
                      <th className="p-3 text-center">كشف الحساب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {accountsList
                      .filter((acc: any) =>
                        !accountSearch ||
                        acc.code.includes(accountSearch) ||
                        acc.name.toLowerCase().includes(accountSearch.toLowerCase())
                      )
                      .map((acc: any) => {
                        const typeLabels: Record<string, string> = {
                          asset: "أصول",
                          liability: "التزامات",
                          equity: "حقوق ملكية",
                          revenue: "إيرادات",
                          cogs: "تكلفة المبيعات",
                          expense: "مصروفات"
                        };
                        return (
                          <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{acc.code}</td>
                            <td className="p-3 font-semibold text-slate-900 dark:text-white">{acc.name}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px]">
                                {typeLabels[acc.type] || acc.type}
                              </Badge>
                            </td>
                            <td className="p-3 text-slate-500">{acc.parent_code || "—"}</td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{fmt(acc.balance)} ريال</td>
                            <td className="p-3 text-center">
                              <Badge className={acc.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}>
                                {acc.active ? "نشط" : "معطل"}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedLedgerAccount(acc)}
                                className="h-7 text-xs text-indigo-600 gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                كشف حركة
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 3: JOURNAL ENTRIES & TRIAL BALANCE */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="journal" className="space-y-6 m-0">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">سجل القيود اليومية والمزدوجة</h3>
                <p className="text-xs text-slate-500">كافة القيود الناتجة آلياً ويدوياً مع ميزان المراجعة وتأكيد الاتزان المحاسبي.</p>
              </div>

              <Button
                onClick={() => setShowNewJournalDlg(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                <Plus className="w-4 h-4" />
                تسجيل قيد يومية يدوي جديد
              </Button>
            </div>

            {/* Trial Balance Banner Summary */}
            <Card className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-indigo-900">
              <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-200">حالة ميزان المراجعة والقيود</h4>
                    <p className="text-sm font-extrabold text-white">
                      إجمالي المدين: {fmt(trialBalance?.totalDebit)} ريال | إجمالي الدائن: {fmt(trialBalance?.totalCredit)} ريال
                    </p>
                  </div>
                </div>

                <Badge className={Math.abs((trialBalance?.totalDebit || 0) - (trialBalance?.totalCredit || 0)) < 0.01 ? "bg-emerald-500 text-white text-xs px-3 py-1" : "bg-rose-500 text-white text-xs px-3 py-1"}>
                  {Math.abs((trialBalance?.totalDebit || 0) - (trialBalance?.totalCredit || 0)) < 0.01 ? "ميزان متزن 100%" : "يوجد فرق بالميزان!"}
                </Badge>
              </CardContent>
            </Card>

            {/* Journal Entries Table */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">رقم القيد</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">البيان والشرح</th>
                      <th className="p-3">النوع المصدر</th>
                      <th className="p-3">التفاصيل والبنود</th>
                      <th className="p-3 text-center">عكس القيد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {journalEntries.map((entry: any) => (
                      <tr key={entry.id} className={entry.is_reversed ? "bg-rose-50/40 dark:bg-rose-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}>
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{entry.entry_number}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{entry.entry_date}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white max-w-xs truncate">{entry.description}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">
                            {entry.source_type || "عام"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1 text-[11px]">
                            {entry.lines?.map((line: any, idx: number) => (
                              <div key={idx} className="flex gap-2">
                                <span className="font-mono text-slate-500">{line.account_code}</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{line.account_name}:</span>
                                {line.debit > 0 && <span className="text-emerald-600 font-bold">مدين {fmt(line.debit)}</span>}
                                {line.credit > 0 && <span className="text-blue-600 font-bold">دائن {fmt(line.credit)}</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {entry.is_reversed ? (
                            <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 text-[10px]">معكوس ومصحح</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm("هل أنت أصل ومستعد لعكس وتصحيح هذا القيد؟ سيتم إنشاء قيد تسوية عكسي.")) {
                                  reverseJournalMutation.mutate(entry.id);
                                }
                              }}
                              className="h-7 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
                            >
                              عكس القيد
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB: TRIAL BALANCE (ميزان المراجعة الشامل) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="trial" className="space-y-6 m-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-600" />
                  تقرير ميزان المراجعة الشامل (Trial Balance)
                </h3>
                <p className="text-xs text-slate-500">كشف حركة ورصيد كافة الحسابات المدينة والدائنة وصافي الأرصدة القائمة مع تأكيد الاتزان المحاسبي.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => refetchTrialBalance()} variant="outline" size="sm" className="text-xs gap-1.5">
                  <RefreshCw className="w-4 h-4 text-sky-600" />
                  تحديث الميزان
                </Button>
                <Button onClick={() => window.print()} size="sm" className="bg-slate-900 text-white text-xs gap-1.5">
                  <Printer className="w-4 h-4" />
                  طباعة ميزان المراجعة
                </Button>
              </div>
            </div>

            {/* Trial Balance Banner Summary */}
            <Card className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-indigo-900 shadow-md">
              <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-200">إجمالي حركة الميزان المتوازن</h4>
                    <p className="text-sm font-extrabold text-white">
                      إجمالي المدين: {fmt(trialBalance?.totalDebit)} ريال | إجمالي الدائن: {fmt(trialBalance?.totalCredit)} ريال
                    </p>
                  </div>
                </div>

                <Badge className={Math.abs((trialBalance?.totalDebit || 0) - (trialBalance?.totalCredit || 0)) < 0.01 ? "bg-emerald-500 text-white text-xs px-3 py-1 font-bold" : "bg-rose-500 text-white text-xs px-3 py-1 font-bold"}>
                  {Math.abs((trialBalance?.totalDebit || 0) - (trialBalance?.totalCredit || 0)) < 0.01 ? "ميزان متزن 100% ✅" : "يوجد فرق بالميزان!"}
                </Badge>
              </CardContent>
            </Card>

            {/* Detailed Accounts Trial Balance Table */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">رمز الحساب</th>
                      <th className="p-3">اسم الحساب</th>
                      <th className="p-3">نوع الحساب</th>
                      <th className="p-3 text-emerald-700 dark:text-emerald-400">مدين (له)</th>
                      <th className="p-3 text-rose-700 dark:text-rose-400">دائن (عليه)</th>
                      <th className="p-3 text-indigo-700 dark:text-indigo-400">صافي الرصيد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {trialBalance?.accounts?.map((acc: any) => (
                      <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{acc.code}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">{acc.name}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">
                            {acc.type === "asset" ? "أصول" : acc.type === "liability" ? "خصوم" : acc.type === "equity" ? "حقوق ملكية" : acc.type === "revenue" ? "إيرادات" : "مصروفات"}
                          </Badge>
                        </td>
                        <td className="p-3 font-bold text-emerald-600">{acc.debit > 0 ? `${fmt(acc.debit)} ريال` : "—"}</td>
                        <td className="p-3 font-bold text-rose-600">{acc.credit > 0 ? `${fmt(acc.credit)} ريال` : "—"}</td>
                        <td className="p-3 font-extrabold text-slate-900 dark:text-white">{fmt(acc.balance)} ريال</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-800 font-extrabold border-t border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                    <tr>
                      <td colSpan={3} className="p-3 text-left">الإجمالي العام لميزان المراجعة:</td>
                      <td className="p-3 text-emerald-600">{fmt(trialBalance?.totalDebit)} ريال</td>
                      <td className="p-3 text-rose-600">{fmt(trialBalance?.totalCredit)} ريال</td>
                      <td className="p-3 text-indigo-600">متزن ✅</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 4: VOUCHERS (سندات القبض والصرف) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="vouchers" className="space-y-6 m-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">إدارة سندات القبض والصرف المعتمدة</h3>
                <p className="text-xs text-slate-500">إصدار سندات التحصيل والمقبوضات والدفعات مع القيد المالي الفوري والطباعة.</p>
              </div>

              <Button
                onClick={() => setShowNewVoucherDlg(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                <Plus className="w-4 h-4" />
                إصدار سند قبض / صرف جديد
              </Button>
            </div>

            {/* Vouchers Grid / Table */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">رقم السند</th>
                      <th className="p-3">نوع السند</th>
                      <th className="p-3">الطرف المستهدف</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">طريقة الدفع</th>
                      <th className="p-3">البيان/السبب</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3 text-center"> معاينة وطباعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {vouchers.map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">#{v.voucher_number}</td>
                        <td className="p-3">
                          <Badge className={v.type === "receipt" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"}>
                            {v.type === "receipt" ? "سند قبض" : "سند صرف"}
                          </Badge>
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{v.party_name}</td>
                        <td className="p-3 font-extrabold text-slate-900 dark:text-white">{fmt(v.amount)} {v.currency || "ريال"}</td>
                        <td className="p-3 text-slate-600">{v.payment_method === "cash" ? "نقداً" : "بنك / تحويل"}</td>
                        <td className="p-3 text-slate-500 max-w-xs truncate">{v.payment_against || v.notes || "—"}</td>
                        <td className="p-3 text-slate-500">{v.created_at?.slice(0, 10)}</td>
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewVoucher(v)}
                            className="h-7 text-xs gap-1"
                          >
                            <Printer className="w-3.5 h-3.5 text-indigo-600" />
                            معاينة
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 5: SAFES / CASH DRAWERS (إدارة الصناديق) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="safes" className="space-y-6 m-0">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">الصناديق والخزائن المالية</h3>
                <p className="text-xs text-slate-500">إدارة صندوق الفرع الرئيسي، صناديق الكاشير، والعهد النقدية.</p>
              </div>

              <Button
                onClick={() => {
                  setEditingSafe(null);
                  setSafeForm({ name: "", balance: "0", currency: "ريال", notes: "", active: true });
                  setShowSafeDlg(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة صندوق / خزينة جديدة
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {safes.map((safe: any) => (
                <Card key={safe.id} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-indigo-600" />
                      {safe.name}
                    </CardTitle>
                    <Badge className={safe.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}>
                      {safe.active ? "نشط" : "معطل"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">الرصيد الدفتري الحالي</p>
                      <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{fmt(safe.balance)} {safe.currency || "ريال"}</p>
                    </div>

                    {safe.notes && <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{safe.notes}</p>}

                    <div className="pt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingSafe(safe);
                          setSafeForm({ name: safe.name, balance: String(safe.balance), currency: safe.currency || "ريال", notes: safe.notes || "", active: !!safe.active });
                          setShowSafeDlg(true);
                        }}
                        className="h-7 text-xs"
                      >
                        تعديل البيانات
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 6: BANKS & TRANSFERS (البنوك والتحويلات) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="banks" className="space-y-6 m-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">إدارة الحسابات البنكية والتحويلات النقدية</h3>
                <p className="text-xs text-slate-500">متابعة الأرصدة البنكية، والتحويل بين الصناديق والبنوك بدون أثر إيراد/مصروف.</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowBankDlg(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة حساب بنكي جديد
                </Button>
                <Button
                  onClick={() => setShowTransferDlg(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  تحويل مالي بين الحسابات
                </Button>
              </div>
            </div>

            {/* Bank Accounts Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankAccounts.map((b: any) => (
                <Card key={b.id} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-purple-600" />
                      {b.bank_name}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs font-mono">{b.account_number}</Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                    <div>
                      <p className="text-xs text-slate-500">الرصيد المتاح بالحساب</p>
                      <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5">{fmt(b.balance)} {b.currency || "ريال"}</p>
                    </div>
                    {b.iban && <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">IBAN: {b.iban}</p>}
                    {b.notes && <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{b.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Transfers Table */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">سجل عمليات التحويل النقدي والبنكي</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">رقم العملية</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">المصدر</th>
                      <th className="p-3">الجهة المستلمة</th>
                      <th className="p-3">المبلغ المحول</th>
                      <th className="p-3">ملاحظات</th>
                      <th className="p-3">بواسطة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {transfers.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono font-bold text-indigo-600">{t.transfer_number}</td>
                        <td className="p-3 text-slate-600">{t.transfer_date}</td>
                        <td className="p-3 font-semibold text-rose-600 dark:text-rose-400">{t.from_name}</td>
                        <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">{t.to_name}</td>
                        <td className="p-3 font-extrabold text-slate-900 dark:text-white">{fmt(t.amount)} ريال</td>
                        <td className="p-3 text-slate-500 max-w-xs truncate">{t.notes || "—"}</td>
                        <td className="p-3 text-slate-500">{t.created_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 7: ACCOUNT STATEMENTS (كشوفات الحسابات) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="statements" className="space-y-6 m-0">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">نوع كشف الحساب</label>
                    <Select value={statementPartyType} onValueChange={(v: any) => { setStatementPartyType(v); setSelectedPartyId(""); }}>
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">مستخدم / كاشير / مدير نظام</SelectItem>
                        <SelectItem value="customer">عميل (ذمم مدينة)</SelectItem>
                        <SelectItem value="supplier">مورد (ذمم دائنة)</SelectItem>
                        <SelectItem value="employee">موظف (مسير رواتب وعهد)</SelectItem>
                        <SelectItem value="account">حساب عام (دليل الحسابات)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">اختر الطرف أو الحساب</label>
                    <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="اختر من القائمة..." />
                      </SelectTrigger>
                      <SelectContent>
                        {statementPartyType === "user" && systemUsers.filter((u: any) => u.role !== 'developer' && u.username !== 'developer' && !String(u.name || '').includes('مطور')).map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.role === 'admin' ? 'مدير نظام' : u.role === 'accountant' ? 'محاسب' : u.role === 'manager' ? 'مدير فرع' : 'كاشير'})</SelectItem>
                        ))}
                        {statementPartyType === "customer" && customers.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.phone || "بدون هاتف"})</SelectItem>
                        ))}
                        {statementPartyType === "supplier" && suppliers.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.phone || "بدون هاتف"})</SelectItem>
                        ))}
                        {statementPartyType === "employee" && employees.map((e: any) => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.position || "موظف"})</SelectItem>
                        ))}
                        {statementPartyType === "account" && accountsList.map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">من تاريخ</label>
                    <Input type="date" value={stmtStartDate} onChange={(e) => setStmtStartDate(e.target.value)} className="text-xs" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">إلى تاريخ</label>
                    <Input type="date" value={stmtEndDate} onChange={(e) => setStmtEndDate(e.target.value)} className="text-xs" />
                  </div>
                </div>

                {selectedPartyId && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="text-slate-600">الرصيد السابق: {fmt(statementData?.previousBalance)} ريال</span>
                      <span className="text-indigo-600 text-sm">الرصيد الحالي المستحق: {fmt(statementData?.currentBalance)} ريال</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button onClick={() => setShowManualDlg(true)} size="sm" variant="outline" className="text-xs gap-1.5">
                        <Plus className="w-4 h-4 text-emerald-600" />
                        إضافة قيد يدوي
                      </Button>
                      <Button onClick={() => setShowStatementPrintModal(true)} size="sm" className="bg-slate-900 text-white text-xs gap-1.5">
                        <Printer className="w-4 h-4" />
                        طباعة كشف الحساب
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statement Table */}
            {statementData?.party && (
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                    كشف حساب تفصيلي — {statementData.party.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3">التاريخ</th>
                        <th className="p-3">البيان والشرح</th>
                        <th className="p-3">مدين (له)</th>
                        <th className="p-3">دائن (عليه)</th>
                        <th className="p-3">الرصيد التراكمي</th>
                        <th className="p-3">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {statementData.transactions.map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3 font-mono text-slate-600">{t.date}</td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-white">{t.description}</td>
                          <td className="p-3 font-bold text-emerald-600">{t.debit > 0 ? `${fmt(t.debit)} ريال` : "—"}</td>
                          <td className="p-3 font-bold text-rose-600">{t.credit > 0 ? `${fmt(t.credit)} ريال` : "—"}</td>
                          <td className="p-3 font-extrabold text-indigo-600 dark:text-indigo-400">{fmt(t.running_balance)} ريال</td>
                          <td className="p-3 text-slate-500">{t.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 8: FIXED ASSETS & DEPRECIATION (الأصول والإهلاك) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="assets" className="space-y-6 m-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">سجل الأصول الثابتة والإهلاك الدوري</h3>
                <p className="text-xs text-slate-500">متابعة قيم الأصول، الإهلاك التراكمي، القيمة الدفترية المتبقية والاحتساب الآلي.</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => runDepreciationMutation.mutate()}
                  disabled={runDepreciationMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-2"
                >
                  <Calculator className="w-4 h-4" />
                  تشغيل واحتساب الإهلاك الدوري للأصول
                </Button>

                <Button
                  onClick={() => setShowAssetDlg(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة أصل ثابت جديد
                </Button>
              </div>
            </div>

            {/* Assets Table */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">رمز الأصل</th>
                      <th className="p-3">اسم الأصل الثابت</th>
                      <th className="p-3">الفئة</th>
                      <th className="p-3">تاريخ الشراء</th>
                      <th className="p-3">تكلفة الشراء</th>
                      <th className="p-3">مجمع الإهلاك</th>
                      <th className="p-3">القيمة الدفترية المتبقية</th>
                      <th className="p-3">الموقع / المسئول</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fixedAssets.map((asset: any) => (
                      <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono font-bold text-indigo-600">{asset.asset_code}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{asset.name}</td>
                        <td className="p-3"><Badge variant="outline" className="text-[10px]">{asset.category}</Badge></td>
                        <td className="p-3 text-slate-600">{asset.purchase_date}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{fmt(asset.purchase_cost)} ريال</td>
                        <td className="p-3 font-bold text-rose-600">{fmt(asset.accumulated_depreciation)} ريال</td>
                        <td className="p-3 font-extrabold text-emerald-600 dark:text-emerald-400">{fmt(asset.net_book_value)} ريال</td>
                        <td className="p-3 text-slate-500">{asset.location} ({asset.responsible_person})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 9: RECURRING EXPENSES (المصروفات المتكررة) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="recurring" className="space-y-6 m-0">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">جدول المصروفات والالتزامات المتكررة</h3>
                <p className="text-xs text-slate-500">إدارة الإيجارات والاشتراكات الدورية وتوليد القيد المالي وسند الصرف تلقائياً.</p>
              </div>

              <Button
                onClick={() => setShowRecurringDlg(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة مصروف متكرر جديد
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recurringExpenses.map((rec: any) => (
                <Card key={rec.id} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      {rec.title}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {rec.frequency === "monthly" ? "شهري" : rec.frequency === "quarterly" ? "ربع سنوي" : "سنوي"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-slate-500">المبلغ المستحق</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{fmt(rec.amount)} ريال</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-slate-500">تاريخ الاستحقاق القادم</p>
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{rec.next_due_date}</p>
                      </div>
                    </div>

                    {rec.notes && <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">{rec.notes}</p>}

                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => generateRecurringMutation.mutate(rec.id)}
                        disabled={generateRecurringMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        توليد وتأكيد السداد الآن
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>


          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 10: FINANCIAL STATEMENTS (القوائم المالية الختامية) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <TabsContent value="financials" className="space-y-6 m-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Income Statement (P&L) */}
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    قائمة الدخل - الأرباح والخسائر (Income Statement / P&L)
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="h-7 text-[10px] gap-1 bg-slate-50 dark:bg-slate-800 border-slate-200">
                    <Printer className="w-3 h-3" />
                    طباعة التقرير
                  </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-4 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                    <span>إجمالي الإيرادات والمبيعات (+)</span>
                    <span className="text-emerald-600">{fmt(incomeStatement?.totalRevenues)} ريال</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                    <span>خصم: تكلفة البضاعة المباعة COGS (-)</span>
                    <span className="text-rose-600">{fmt(incomeStatement?.cogsTotal)} ريال</span>
                  </div>

                  <div className="flex justify-between items-center py-2 bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded font-extrabold text-emerald-900 dark:text-emerald-200">
                    <span>مجمل الربح (Gross Profit)</span>
                    <span>{fmt(incomeStatement?.grossProfit)} ريال</span>
                  </div>

                  <div className="space-y-1 pt-2">
                    <p className="font-bold text-slate-700 dark:text-slate-300">خصم: المصروفات التشغيلية والتنفيذية (-)</p>
                    {incomeStatement?.expensesList?.map((e: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-400 pl-4 py-1 border-b border-slate-50 dark:border-slate-800/50 text-[11px]">
                        <span>• {e.category}</span>
                        <span>{fmt(e.total)} ريال</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-rose-600 pt-2">
                      <span>إجمالي المصروفات التشغيلية</span>
                      <span>{fmt(incomeStatement?.totalExpenses)} ريال</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-3 bg-indigo-900 text-white p-3 rounded-xl font-black text-sm shadow-md">
                    <span>صافي الربح النهائي (Net Profit)</span>
                    <span className="text-emerald-400">{fmt(incomeStatement?.netProfit)} ريال</span>
                  </div>
                </CardContent>
              </Card>

              {/* Balance Sheet */}
              <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Scale className="w-4 h-4 text-indigo-600" />
                      الميزانية العمومية (Balance Sheet)
                    </CardTitle>
                    <Badge className={balanceSheet?.isBalanced ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}>
                      {balanceSheet?.isBalanced ? "الميزانية متزنة" : "غير متزنة"}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="h-7 text-[10px] gap-1 bg-slate-50 dark:bg-slate-800 border-slate-200">
                    <Printer className="w-3 h-3" />
                    طباعة التقرير
                  </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-4 text-xs">
                  {/* Assets */}
                  <div>
                    <h4 className="font-bold text-indigo-600 dark:text-indigo-400 mb-2 border-b pb-1">أولاً: الأصول (Assets)</h4>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• النقدية بالصناديق والخزائن</span>
                        <span className="font-bold">{fmt(balanceSheet?.currentAssets?.cashInSafes)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• النقدية بالحسابات البنكية</span>
                        <span className="font-bold">{fmt(balanceSheet?.currentAssets?.cashInBanks)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• الذمم المدينة (العملاء)</span>
                        <span className="font-bold">{fmt(balanceSheet?.currentAssets?.receivables)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• تقييم المخزون المتاح</span>
                        <span className="font-bold">{fmt(balanceSheet?.currentAssets?.inventoryValuation)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• صافي الأصول الثابتة</span>
                        <span className="font-bold">{fmt(balanceSheet?.fixedAssets?.netFixedAssets)} ريال</span>
                      </div>
                    </div>
                    <div className="flex justify-between font-extrabold text-indigo-900 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded mt-2">
                      <span>إجمالي الأصول</span>
                      <span>{fmt(balanceSheet?.totalAssets)} ريال</span>
                    </div>
                  </div>

                  {/* Liabilities & Equity */}
                  <div>
                    <h4 className="font-bold text-purple-600 dark:text-purple-400 mb-2 border-b pb-1">ثانياً: الالتزامات وحقوق الملكية</h4>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• الذمم الدائنة (الموردين)</span>
                        <span className="font-bold">{fmt(balanceSheet?.liabilities?.payables)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• رأس المال المعتمد</span>
                        <span className="font-bold">{fmt(balanceSheet?.equity?.capital)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• الأرباح المبقاة والاحتياطيات</span>
                        <span className="font-bold">{fmt(balanceSheet?.equity?.retainedEarnings)} ريال</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>• صافي أرباح الفترة الحالية</span>
                        <span className="font-bold text-emerald-600">{fmt(balanceSheet?.equity?.netIncome)} ريال</span>
                      </div>
                    </div>
                    <div className="flex justify-between font-extrabold text-purple-900 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2 rounded mt-2">
                      <span>إجمالي الالتزامات وحقوق الملكية</span>
                      <span>{fmt(balanceSheet?.totalLiabilitiesAndEquity)} ريال</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 1: NEW VOUCHER (سند جديد) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showNewVoucherDlg} onOpenChange={setShowNewVoucherDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                إصدار سند مالي معتمد جديد
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">نوع السند</label>
                  <Select value={voucherForm.type} onValueChange={(v) => setVoucherForm({ ...voucherForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receipt">سند قبض (استلام أموال)</SelectItem>
                      <SelectItem value="payment">سند صرف (دفع أموال)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-bold mb-1 block">الطرف المستهدف</label>
                  <Select value={voucherForm.party_type} onValueChange={(v: any) => setVoucherForm({ ...voucherForm, party_type: v, party_id: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">مستخدم (كاشير / محاسب / مدير نظام)</SelectItem>
                      <SelectItem value="customer">عميل</SelectItem>
                      <SelectItem value="supplier">مورد</SelectItem>
                      <SelectItem value="employee">موظف</SelectItem>
                      <SelectItem value="general">جهة عامة / أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {voucherForm.party_type !== "general" && (
                <div>
                  <label className="font-bold mb-1 block">اختر الشخص / الجهة</label>
                  <Select value={voucherForm.party_id} onValueChange={(v) => setVoucherForm({ ...voucherForm, party_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر من القائمة..." /></SelectTrigger>
                    <SelectContent>
                      {voucherForm.party_type === "user" && systemUsers.filter((u: any) => u.role !== 'developer' && u.username !== 'developer' && !String(u.name || '').includes('مطور')).map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.role === 'admin' ? 'مدير نظام' : u.role === 'accountant' ? 'محاسب' : u.role === 'manager' ? 'مدير فرع' : 'كاشير'})</SelectItem>
                      ))}
                      {voucherForm.party_type === "customer" && customers.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                      {voucherForm.party_type === "supplier" && suppliers.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                      {voucherForm.party_type === "employee" && employees.map((e: any) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="font-bold mb-1 block">اسم المستلم / المدفوع له (إن لم يختر من القائمة)</label>
                <Input value={voucherForm.received_from} onChange={(e) => setVoucherForm({ ...voucherForm, received_from: e.target.value })} placeholder="مثال: شركة المقاولات أو الأستاذ أحمد" className="text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">المبلغ المالي</label>
                  <Input type="number" value={voucherForm.amount} onChange={(e) => setVoucherForm({ ...voucherForm, amount: e.target.value })} placeholder="0.00" className="text-xs font-bold" />
                </div>

                <div>
                  <label className="font-bold mb-1 block">طريقة الدفع</label>
                  <Select value={voucherForm.payment_method} onValueChange={(v) => setVoucherForm({ ...voucherForm, payment_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقداً (Cash)</SelectItem>
                      <SelectItem value="bank_transfer">تحويل بنكي / بطاقة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Source Account Selection */}
              <div>
                <label className="font-bold mb-1 block">الصندوق / الخزينة المأخوذ منه أو المودع فيه</label>
                <Select value={voucherForm.safe_id} onValueChange={(v) => setVoucherForm({ ...voucherForm, safe_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الخزينة..." /></SelectTrigger>
                  <SelectContent>
                    {safes.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name} (رصيد: {fmt(s.balance)} ريال)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold mb-1 block">مقابل (السبب والبيان)</label>
                <Input value={voucherForm.payment_against} onChange={(e) => setVoucherForm({ ...voucherForm, payment_against: e.target.value })} placeholder="مثال: سداد الدفعة الأولى أو شراء مواد خام" className="text-xs" />
              </div>

              <div>
                <label className="font-bold mb-1 block">ملاحظات إضافية</label>
                <Input value={voucherForm.notes} onChange={(e) => setVoucherForm({ ...voucherForm, notes: e.target.value })} className="text-xs" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewVoucherDlg(false)} className="text-xs">إلغاء</Button>
              <Button
                onClick={() => createVoucherMutation.mutate(voucherForm)}
                disabled={createVoucherMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                حفظ وإصدار السند
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 2: VOUCHER PRINT & VIEW */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={!!viewVoucher} onOpenChange={() => setViewVoucher(null)}>
          <DialogContent className="max-w-xl dir-rtl" dir="rtl">
            {viewVoucher && (
              <div className="space-y-4 p-4 border border-slate-200 rounded-xl bg-white text-slate-900" id="printable-voucher">
                <div className="flex justify-between items-center border-b pb-3">
                  <div className="flex items-center gap-3">
                    <img src={docForm.logoUrl || omnisystemLogo} alt="Logo" className="w-12 h-12 object-contain" />
                    <div>
                      <h2 className="font-black text-sm text-slate-900">{docForm.companyName}</h2>
                      <p className="text-[10px] text-slate-500">{docForm.companySubtitle}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <Badge className={viewVoucher.type === "receipt" ? "bg-emerald-600 text-white text-sm font-bold px-3 py-1" : "bg-rose-600 text-white text-sm font-bold px-3 py-1"}>
                      {viewVoucher.type === "receipt" ? "سند قبض" : "سند صرف"}
                    </Badge>
                    <p className="text-xs font-mono font-bold mt-1">#{viewVoucher.voucher_number}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border">
                  <div>
                    <span className="text-slate-500 block">التاريخ:</span>
                    <span className="font-bold">{viewVoucher.created_at?.slice(0, 10)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">المبلغ:</span>
                    <span className="font-extrabold text-indigo-700 text-sm">{fmt(viewVoucher.amount)} {viewVoucher.currency || "ريال"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">الطرف المستلم / المدفوع له:</span>
                    <span className="font-bold text-slate-900 text-sm">{viewVoucher.party_name}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">وذلك مقابل:</span>
                    <span className="font-semibold text-slate-800">{viewVoucher.payment_against || "—"}</span>
                  </div>
                </div>

                <div className="pt-6 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-600 border-t mt-4">
                  <div>
                    <p className="font-bold">أمين الصندوق</p>
                    <p className="mt-6">__________________</p>
                  </div>
                  <div>
                    <p className="font-bold">المحاسب المسؤول</p>
                    <p className="mt-6">__________________</p>
                  </div>
                  <div>
                    <p className="font-bold">استلمت بواسطة / المستلم</p>
                    <p className="mt-6">__________________</p>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-400 pt-2">
                  {docForm.voucherFooterText}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewVoucher(null)} className="text-xs">إغلاق</Button>
              <Button onClick={() => window.print()} className="bg-slate-900 text-white text-xs gap-1.5">
                <Printer className="w-4 h-4" />
                طباعة السند
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 3: NEW MANUAL JOURNAL ENTRY (قيد يومية يدوي) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showNewJournalDlg} onOpenChange={setShowNewJournalDlg}>
          <DialogContent className="max-w-2xl dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-600" />
                إنشاء وتسجيل قيد يومية مزدوج جديد
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">تاريخ القيد</label>
                  <Input type="date" value={journalForm.entry_date} onChange={(e) => setJournalForm({ ...journalForm, entry_date: e.target.value })} className="text-xs" />
                </div>
                <div>
                  <label className="font-bold mb-1 block">البيان والشرح الإجمالي للقيد</label>
                  <Input value={journalForm.description} onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })} placeholder="مثال: تسوية إقفال العهدة النقدية" className="text-xs" />
                </div>
              </div>

              {/* Lines table */}
              <div className="space-y-2 border p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-900 dark:text-white">بنود القيد المحاسبي (مدين ودائن)</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setJournalForm({
                      ...journalForm,
                      lines: [...journalForm.lines, { account_code: "11100", debit: "", credit: "", description: "" }]
                    })}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة طرف
                  </Button>
                </div>

                {journalForm.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Select value={line.account_code} onValueChange={(val) => {
                        const newLines = [...journalForm.lines];
                        newLines[idx].account_code = val;
                        setJournalForm({ ...journalForm, lines: newLines });
                      }}>
                        <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {accountsList.map((a: any) => (
                            <SelectItem key={a.id} value={a.code}>{a.code} - {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder="مدين (Debit)"
                        value={line.debit}
                        onChange={(e) => {
                          const newLines = [...journalForm.lines];
                          newLines[idx].debit = e.target.value;
                          setJournalForm({ ...journalForm, lines: newLines });
                        }}
                        className="text-xs h-8 font-bold text-emerald-600"
                      />
                    </div>

                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder="دائن (Credit)"
                        value={line.credit}
                        onChange={(e) => {
                          const newLines = [...journalForm.lines];
                          newLines[idx].credit = e.target.value;
                          setJournalForm({ ...journalForm, lines: newLines });
                        }}
                        className="text-xs h-8 font-bold text-blue-600"
                      />
                    </div>

                    <div className="col-span-2 text-center">
                      {journalForm.lines.length > 2 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const newLines = journalForm.lines.filter((_, i) => i !== idx);
                            setJournalForm({ ...journalForm, lines: newLines });
                          }}
                          className="h-8 text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-2 border-t font-bold text-xs">
                  <span>إجمالي الطرف المدين: <span className="text-emerald-600">{fmt(journalDebitSum)} ريال</span></span>
                  <span>إجمالي الطرف الدائن: <span className="text-blue-600">{fmt(journalCreditSum)} ريال</span></span>
                  <Badge className={isJournalBalanced ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}>
                    {isJournalBalanced ? "متزن" : "غير متزن"}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewJournalDlg(false)} className="text-xs">إلغاء</Button>
              <Button
                onClick={() => createJournalMutation.mutate(journalForm)}
                disabled={!isJournalBalanced || createJournalMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                ترحيل القيد للميزانية
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 4: NEW BANK ACCOUNT */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showBankDlg} onOpenChange={setShowBankDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Landmark className="w-5 h-5 text-purple-600" />
                إضافة حساب بنكي جديد
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold mb-1 block">اسم البنك / المصرف</label>
                <Input value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} placeholder="مثال: البنك الأهلي أو بنك الراجحي" className="text-xs" />
              </div>

              <div>
                <label className="font-bold mb-1 block">رقم الحساب البنكي</label>
                <Input value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} placeholder="1029384756" className="text-xs font-mono" />
              </div>

              <div>
                <label className="font-bold mb-1 block">رقم الآيبان (IBAN)</label>
                <Input value={bankForm.iban} onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })} placeholder="SA00000000000000000" className="text-xs font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">الرصيد الافتتاحي</label>
                  <Input type="number" value={bankForm.balance} onChange={(e) => setBankForm({ ...bankForm, balance: e.target.value })} className="text-xs font-bold" />
                </div>
                <div>
                  <label className="font-bold mb-1 block">العملة</label>
                  <Input value={bankForm.currency} onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })} className="text-xs" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBankDlg(false)} className="text-xs">إلغاء</Button>
              <Button onClick={() => createBankMutation.mutate(bankForm)} className="bg-purple-600 text-white text-xs gap-2">حفظ البنك</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 5: INTER-ACCOUNT TRANSFER */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showTransferDlg} onOpenChange={setShowTransferDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                تحويل مالي بين الحسابات والخزائن
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">جهة المصدر (من)</label>
                  <Select value={transferForm.from_type} onValueChange={(v) => setTransferForm({ ...transferForm, from_type: v, from_id: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="safe">صندوق / خزينة</SelectItem>
                      <SelectItem value="bank">حساب بنكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-bold mb-1 block">جهة الاستلام (إلى)</label>
                  <Select value={transferForm.to_type} onValueChange={(v) => setTransferForm({ ...transferForm, to_type: v, to_id: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">حساب بنكي</SelectItem>
                      <SelectItem value="safe">صندوق / خزينة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">اختر المصدر</label>
                  <Select value={transferForm.from_id} onValueChange={(v) => setTransferForm({ ...transferForm, from_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>
                      {transferForm.from_type === "safe" ? safes.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name} ({fmt(s.balance)} ريال)</SelectItem>
                      )) : bankAccounts.map((b: any) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.bank_name} ({fmt(b.balance)} ريال)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-bold mb-1 block">اختر المستلم</label>
                  <Select value={transferForm.to_id} onValueChange={(v) => setTransferForm({ ...transferForm, to_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                    <SelectContent>
                      {transferForm.to_type === "safe" ? safes.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name} ({fmt(s.balance)} ريال)</SelectItem>
                      )) : bankAccounts.map((b: any) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.bank_name} ({fmt(b.balance)} ريال)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-bold mb-1 block">المبلغ المحول</label>
                <Input type="number" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} placeholder="0.00" className="text-xs font-bold" />
              </div>

              <div>
                <label className="font-bold mb-1 block">ملاحظات التحويل</label>
                <Input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} className="text-xs" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTransferDlg(false)} className="text-xs">إلغاء</Button>
              <Button onClick={() => createTransferMutation.mutate(transferForm)} className="bg-indigo-600 text-white text-xs gap-2">تنفيذ التحويل المالي</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 6: NEW FIXED ASSET */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showAssetDlg} onOpenChange={setShowAssetDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                إضافة أصل ثابت جديد
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold mb-1 block">اسم الأصل الثابت</label>
                <Input value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="مثال: سيارة دليفري أو فرن آلي إيطالي" className="text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">الفئة</label>
                  <Select value={assetForm.category} onValueChange={(v) => setAssetForm({ ...assetForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="أجهزة ومعدات">أجهزة ومعدات</SelectItem>
                      <SelectItem value="وسائل نقل">وسائل نقل</SelectItem>
                      <SelectItem value="أثاث وديكور">أثاث وديكور</SelectItem>
                      <SelectItem value="مباني وعقارات">مباني وعقارات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="font-bold mb-1 block">تاريخ الشراء</label>
                  <Input type="date" value={assetForm.purchase_date} onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })} className="text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold mb-1 block">تكلفة الشراء</label>
                  <Input type="number" value={assetForm.purchase_cost} onChange={(e) => setAssetForm({ ...assetForm, purchase_cost: e.target.value })} placeholder="0.00" className="text-xs font-bold" />
                </div>
                <div>
                  <label className="font-bold mb-1 block">القيمة المتبقية (خردة)</label>
                  <Input type="number" value={assetForm.salvage_value} onChange={(e) => setAssetForm({ ...assetForm, salvage_value: e.target.value })} placeholder="0.00" className="text-xs" />
                </div>
                <div>
                  <label className="font-bold mb-1 block">العمر الإنتاجي (سنوات)</label>
                  <Input type="number" value={assetForm.useful_life_years} onChange={(e) => setAssetForm({ ...assetForm, useful_life_years: e.target.value })} className="text-xs" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssetDlg(false)} className="text-xs">إلغاء</Button>
              <Button onClick={() => createAssetMutation.mutate(assetForm)} className="bg-indigo-600 text-white text-xs gap-2">تسجيل وقيد الأصل</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>





        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 8: ACCOUNT LEDGER VIEW */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={!!selectedLedgerAccount} onOpenChange={() => setSelectedLedgerAccount(null)}>
          <DialogContent className="max-w-2xl dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                كشف حركة الحساب المحاسبي — {selectedLedgerAccount?.code} ({selectedLedgerAccount?.name})
              </DialogTitle>
            </DialogHeader>

            <div className="p-0 overflow-x-auto max-h-96">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b">
                  <tr>
                    <th className="p-2.5">رقم القيد</th>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">البيان</th>
                    <th className="p-2.5">مدين</th>
                    <th className="p-2.5">دائن</th>
                    <th className="p-2.5">الرصيد الجاري</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ledgerData?.ledger?.map((line: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-indigo-600 font-bold">{line.entry_number}</td>
                      <td className="p-2.5 text-slate-500">{line.entry_date}</td>
                      <td className="p-2.5 text-slate-900 font-semibold">{line.journal_desc}</td>
                      <td className="p-2.5 text-emerald-600 font-bold">{line.debit > 0 ? fmt(line.debit) : "—"}</td>
                      <td className="p-2.5 text-rose-600 font-bold">{line.credit > 0 ? fmt(line.credit) : "—"}</td>
                      <td className="p-2.5 font-extrabold text-indigo-700">{fmt(line.running_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedLedgerAccount(null)} className="text-xs">إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 9: ADD NEW ACCOUNT (إضافة حساب جديد) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showAddAccountDlg} onOpenChange={setShowAddAccountDlg}>
          <DialogContent className="max-w-md dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                إضافة حساب جديد لدليل الحسابات
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold mb-1 block">رمز الحساب (Code)</label>
                  <Input 
                    value={accountForm.code} 
                    onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })} 
                    placeholder="مثال: 11100" 
                    className="text-xs font-mono font-bold" 
                  />
                </div>
                <div>
                  <label className="font-bold mb-1 block">نوع الحساب</label>
                  <Select value={accountForm.type} onValueChange={(v) => setAccountForm({ ...accountForm, type: v })}>
                    <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">أصول (Assets)</SelectItem>
                      <SelectItem value="liability">التزامات (Liabilities)</SelectItem>
                      <SelectItem value="equity">حقوق ملكية (Equity)</SelectItem>
                      <SelectItem value="revenue">إيرادات (Revenue)</SelectItem>
                      <SelectItem value="expense">مصروفات (Expenses)</SelectItem>
                      <SelectItem value="cogs">تكلفة مبيعات (COGS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-bold mb-1 block">اسم الحساب المحاسبي</label>
                <Input 
                  value={accountForm.name} 
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} 
                  placeholder="مثال: الصندوق الرئيسي أو مبيعات المعجنات" 
                  className="text-xs font-semibold" 
                />
              </div>

              <div>
                <label className="font-bold mb-1 block">الحساب الأب (إن وجد)</label>
                <Select value={accountForm.parent_code} onValueChange={(v) => setAccountForm({ ...accountForm, parent_code: v })}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="اختر الحساب الأب..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— حساب رئيسي (بدون أب) —</SelectItem>
                    {accountsList
                      .filter((a: any) => a.code.length <= 4)
                      .map((a: any) => (
                        <SelectItem key={a.id} value={a.code}>{a.code} - {a.name}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddAccountDlg(false)} className="text-xs">إلغاء</Button>
              <Button
                onClick={() => createAccountMutation.mutate(accountForm)}
                disabled={!accountForm.code || !accountForm.name || createAccountMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2"
              >
                {createAccountMutation.isPending ? "جاري الحفظ..." : "حفظ الحساب الجديد"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* MODAL 10: STATEMENT PRINT PREVIEW */}
        {/* ───────────────────────────────────────────────────────────── */}
        <Dialog open={showStatementPrintModal} onOpenChange={setShowStatementPrintModal}>
          <DialogContent className="max-w-3xl dir-rtl max-h-[90vh] overflow-y-auto" dir="rtl">
            {showStatementPrintModal && (
              <style>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #printable-statement, #printable-statement * {
                    visibility: visible;
                  }
                  #printable-statement {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                }
              `}</style>
            )}
            <DialogHeader className="print:hidden">
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  معاينة وطباعة كشف الحساب
                </span>
                <Button onClick={() => window.print()} className="bg-slate-900 text-white text-xs gap-1.5">
                  <Printer className="w-4 h-4" />
                  طباعة الآن
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div className="p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-white space-y-6" id="printable-statement">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-lg font-black">{docForm.companyName}</h1>
                  <p className="text-xs text-slate-500">{docForm.companySubtitle}</p>
                </div>
                <div className="text-center">
                  <h2 className="text-base font-bold text-indigo-900 dark:text-indigo-300">
                    كشف حساب {statementPartyType === "customer" ? "عميل" : statementPartyType === "supplier" ? "مورد" : statementPartyType === "employee" ? "موظف" : "حساب عام"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">الفترة: {stmtStartDate || "البداية"} إلى {stmtEndDate || "اليوم"}</p>
                </div>
                <div className="text-left text-xs font-mono">
                  <div>تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA")}</div>
                </div>
              </div>

              {/* Party Info */}
              {statementData?.party && (
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border text-xs grid grid-cols-2 gap-2">
                  <div><span className="text-slate-500">اسم الطرف / الحساب: </span><strong>{statementData.party.name}</strong></div>
                  <div><span className="text-slate-500">رقم الهاتف: </span><strong>{statementData.party.phone || "—"}</strong></div>
                  <div><span className="text-slate-500">الرصيد السابق: </span><strong>{fmt(statementData.previousBalance)} ريال</strong></div>
                  <div><span className="text-slate-500">الرصيد الحالي المستحق: </span><strong className="text-indigo-600">{fmt(statementData.currentBalance)} ريال</strong></div>
                </div>
              )}

              {/* Transactions Table */}
              <table className="w-full text-right text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-300">
                    <th className="p-2 border border-slate-300">التاريخ</th>
                    <th className="p-2 border border-slate-300">البيان والشرح</th>
                    <th className="p-2 border border-slate-300">مدين (له)</th>
                    <th className="p-2 border border-slate-300">دائن (عليه)</th>
                    <th className="p-2 border border-slate-300">الرصيد التراكمي</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData?.transactions?.map((t: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-2 font-mono border border-slate-300">{t.date}</td>
                      <td className="p-2 font-semibold border border-slate-300">{t.description}</td>
                      <td className="p-2 font-bold text-emerald-700 border border-slate-300">{t.debit > 0 ? `${fmt(t.debit)} ريال` : "—"}</td>
                      <td className="p-2 font-bold text-rose-700 border border-slate-300">{t.credit > 0 ? `${fmt(t.credit)} ريال` : "—"}</td>
                      <td className="p-2 font-extrabold text-indigo-700 border border-slate-300">{fmt(t.running_balance)} ريال</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer Signatures */}
              <div className="grid grid-cols-3 pt-8 text-center text-xs font-bold">
                <div>
                  <p>محضِّر الحساب</p>
                  <div className="h-12 border-b border-dashed border-slate-400 mt-4"></div>
                </div>
                <div>
                  <p>المدير المالي</p>
                  <div className="h-12 border-b border-dashed border-slate-400 mt-4"></div>
                </div>
                <div>
                  <p>ختم واعتماد الشركة</p>
                  <div className="h-12 border-b border-dashed border-slate-400 mt-4"></div>
                </div>
              </div>
            </div>

            <DialogFooter className="print:hidden">
              <Button variant="outline" onClick={() => setShowStatementPrintModal(false)} className="text-xs">إغلاق</Button>
              <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2">
                <Printer className="w-4 h-4" />
                طباعة كشف الحساب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AdminLayout>
  );
}

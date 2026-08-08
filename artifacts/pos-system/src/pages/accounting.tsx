import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Eye, Search, FileText, Printer, Sliders, Palette, RefreshCw, Upload, Sparkles, User, FileSpreadsheet, Wallet, Edit, BookOpen, HelpCircle, ArrowUpDown, CheckCircle, AlertTriangle } from "lucide-react";

// Helper for authenticating API requests
function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); }

function fmt(n?: number) { return Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function Accounting() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("statements");

  /* ─── Queries ─── */
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees-list"], queryFn: () => apiGet("/api/hr/employees") });
  const { data: customers = [] } = useQuery({ queryKey: ["customers-list"], queryFn: () => apiGet("/api/customers") });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-list"], queryFn: () => apiGet("/api/suppliers").catch(() => []) });
  const { data: vouchers = [], refetch: refetchVouchers } = useQuery({ queryKey: ["vouchers-list"], queryFn: () => apiGet("/api/accounting/vouchers") });
  const { data: currenciesList = [] } = useQuery({ queryKey: ["currencies-list"], queryFn: () => apiGet("/api/currencies").catch(() => []) });
  const { data: docPrintSettings, refetch: refetchDocSettings } = useQuery({ queryKey: ["document-print-settings"], queryFn: () => apiGet("/api/document-print-settings") });

  /* ─── Global Document Print Settings Dialog State ─── */
  const [showDocSettingsDlg, setShowDocSettingsDlg] = useState(false);
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

  /* ─── Account Statement State ─── */
  const [statementPartyType, setStatementPartyType] = useState<"employee" | "customer">("employee");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [stmtStartDate, setStmtStartDate] = useState<string>("");
  const [stmtEndDate, setStmtEndDate] = useState<string>("");

  const { data: statementData, isFetching: loadingStatement, refetch: refetchStatement } = useQuery({
    queryKey: ["party-statement", statementPartyType, selectedPartyId, stmtStartDate, stmtEndDate],
    queryFn: () => apiGet(`/api/accounting/statement/${statementPartyType}/${selectedPartyId}?start_date=${stmtStartDate}&end_date=${stmtEndDate}`),
    enabled: !!selectedPartyId,
  });

  /* ─── Manual Entry State ─── */
  const [showManualDlg, setShowManualDlg] = useState(false);
  const [manualForm, setManualForm] = useState({
    description: "",
    debit: "0",
    credit: "0",
    entry_date: new Date().toISOString().slice(0, 10),
    notes: ""
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
      toast({ title: "تم تسجيل القيد بنجاح" });
      setShowManualDlg(false);
      setManualForm({ description: "", debit: "0", credit: "0", entry_date: new Date().toISOString().slice(0, 10), notes: "" });
      refetchStatement();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة القيد", description: e.message }),
  });

  const deleteManualMutation = useMutation({
    mutationFn: (id: number) => apiDel(`/api/accounting/manual-entries/${id}`),
    onSuccess: () => {
      toast({ title: "تم حذف القيد اليدوي" });
      refetchStatement();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل حذف القيد", description: e.message }),
  });

  /* ─── Vouchers Management State ─── */
  const [voucherSearch, setVoucherSearch] = useState("");
  const [showNewVoucherDlg, setShowNewVoucherDlg] = useState(false);
  const [viewVoucher, setViewVoucher] = useState<any>(null);

  // Default Customizable Options for Vouchers (syncs automatically with system-wide settings)
  const [voucherConfig, setVoucherConfig] = useState({
    header_title: "مخابز الشام للخبز العربي",
    header_subtitle: "Maamil Al Sham",
    logo_url: "/omnisystem-logo.png",
    accent_color: "#ef4444", // RED from image
    bottom_text: "جودة الخبز ... سر ثقة عملائنا",
    currency: "دينار"
  });

  // Sync with global system document settings when loaded
  useEffect(() => {
    if (docPrintSettings && !docPrintSettings.error) {
      setVoucherConfig((prev) => ({
        ...prev,
        header_title: docPrintSettings.companyName || prev.header_title,
        header_subtitle: docPrintSettings.companySubtitle || prev.header_subtitle,
        logo_url: docPrintSettings.logoUrl || prev.logo_url,
        accent_color: docPrintSettings.accentColor || prev.accent_color,
        bottom_text: docPrintSettings.voucherFooterText || prev.bottom_text,
      }));
      setDocForm(docPrintSettings);
    }
  }, [docPrintSettings]);

  const saveDocSettingsMutation = useMutation({
    mutationFn: (data: any) =>
      fetchAuth("/api/document-print-settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      toast({ title: "تم حفظ إعدادات الهيدر والشعار للوثائق والسندات بنجاح" });
      setShowDocSettingsDlg(false);
      refetchDocSettings();
    },
    onError: (e: any) =>
      toast({ variant: "destructive", title: "فشل حفظ الإعدادات", description: e.message }),
  });

  const [voucherForm, setVoucherForm] = useState({
    type: "receipt", // receipt or payment
    party_type: "employee" as "employee" | "customer" | "supplier" | "general",
    party_id: "",
    amount: "",
    received_from: "",
    payment_against: "",
    payment_method: "cash",
    amount_text: "",
    notes: "",
    safe_id: ""
  });

  /* ─── Safes Management State & Queries ─── */
  const [showSafeDlg, setShowSafeDlg] = useState(false);
  const [editingSafe, setEditingSafe] = useState<any>(null);
  const [safeForm, setSafeForm] = useState({ name: "", balance: "0", currency: "ريال", notes: "", active: true });

  const { data: safes = [], refetch: refetchSafes } = useQuery({ queryKey: ["safes-list"], queryFn: () => apiGet("/api/safes") });

  /* ─── Chart of Accounts, Journal & Trial Balance State ─── */
  const [innerGuideTab, setInnerGuideTab] = useState("concepts");
  const [showAddAccountDlg, setShowAddAccountDlg] = useState(false);
  const [accountForm, setAccountForm] = useState({ code: "", name: "", type: "asset", parent_code: "" });
  const [accountSearch, setAccountSearch] = useState("");

  const { data: accountsList = [], refetch: refetchAccounts } = useQuery({
    queryKey: ["accounts-list"],
    queryFn: () => apiGet("/api/accounting/accounts"),
    enabled: activeTab === "chart"
  });

  const { data: trialBalance, refetch: refetchTrialBalance } = useQuery({
    queryKey: ["trial-balance-data"],
    queryFn: () => apiGet("/api/accounting/trial-balance"),
    enabled: activeTab === "chart"
  });

  const { data: journalEntries = [], refetch: refetchJournal } = useQuery({
    queryKey: ["journal-entries-list"],
    queryFn: () => apiGet("/api/accounting/journal-entries"),
    enabled: activeTab === "chart"
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/accounts", {
      ...data,
      parent_code: data.parent_code || null
    }),
    onSuccess: () => {
      toast({ title: "تم إضافة الحساب الجديد بنجاح" });
      setShowAddAccountDlg(false);
      setAccountForm({ code: "", name: "", type: "asset", parent_code: "" });
      refetchAccounts();
      refetchTrialBalance();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة الحساب", description: e.message })
  });

  const addSafeMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/safes", data),
    onSuccess: () => {
      toast({ title: "تم إضافة الصندوق بنجاح" });
      setShowSafeDlg(false);
      refetchSafes();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إضافة الصندوق", description: e.message })
  });

  const editSafeMutation = useMutation({
    mutationFn: (data: any) => fetchAuth(`/api/safes/${data.id}`, { method: "PUT", body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "تم تعديل الصندوق بنجاح" });
      setShowSafeDlg(false);
      refetchSafes();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل تعديل الصندوق", description: e.message })
  });

  const deleteSafeMutation = useMutation({
    mutationFn: (id: number) => apiDel(`/api/safes/${id}`),
    onSuccess: () => {
      toast({ title: "تم حذف الصندوق بنجاح" });
      refetchSafes();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل حذف الصندوق", description: e.message })
  });

  const createVoucherMutation = useMutation({
    mutationFn: (data: any) => apiPost("/api/accounting/vouchers", {
      ...data,
      party_type: data.party_type || "general",
      party_id: Number(data.party_id) || 0,
      party_name: data.received_from || data.party_name || "عام",
      amount: Number(data.amount || 0),
      currency: voucherConfig.currency,
      header_title: voucherConfig.header_title,
      header_subtitle: voucherConfig.header_subtitle,
      logo_url: voucherConfig.logo_url,
      accent_color: voucherConfig.accent_color,
      bottom_text: voucherConfig.bottom_text,
      safe_id: data.safe_id ? Number(data.safe_id) : undefined
    }),
    onSuccess: (data) => {
      toast({ title: "تم إنشاء السند بنجاح" });
      setShowNewVoucherDlg(false);
      refetchVouchers();
      refetchSafes();
      if (selectedPartyId && String(data.party_id) === selectedPartyId && data.party_type === statementPartyType) {
        refetchStatement();
      }
      // Open the voucher view immediately
      setViewVoucher(data);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل إنشاء السند", description: e.message }),
  });

  const deleteVoucherMutation = useMutation({
    mutationFn: (id: number) => apiDel(`/api/accounting/vouchers/${id}`),
    onSuccess: () => {
      toast({ title: "تم حذف السند" });
      refetchVouchers();
      refetchSafes();
      if (selectedPartyId) refetchStatement();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل حذف السند" }),
  });

  const handleVoucherPartyChange = (pt: "employee" | "customer" | "supplier" | "general", pid: string) => {
    let name = "";
    if (pt === "employee") {
      name = employees.find((e: any) => String(e.id) === pid)?.name || "";
    } else if (pt === "customer") {
      name = customers.find((c: any) => String(c.id) === pid)?.name || "";
    } else if (pt === "supplier") {
      name = suppliers.find((s: any) => String(s.id) === pid)?.name || "";
    }
    setVoucherForm(v => ({
      ...v,
      party_type: pt,
      party_id: pid,
      received_from: name || v.received_from
    }));
  };

  const handlePrint = (areaId: string) => {
    const printContent = document.getElementById(areaId);
    if (!printContent) return;
    
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>طباعة</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body {
              font-family: 'Cairo', sans-serif;
              direction: rtl;
              padding: 20px;
              background-color: white;
            }
            .dashed-line {
              border-bottom: 2px dashed #ccc;
              height: 1px;
              width: 100%;
              margin-top: 15px;
            }
            @media print {
              body { padding: 0; margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="max-w-4xl mx-auto">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    win.document.close();
  };

  const filteredVouchers = vouchers.filter((v: any) => {
    if (!voucherSearch.trim()) return true;
    const s = voucherSearch.toLowerCase();
    return (
      v.voucher_number.toLowerCase().includes(s) ||
      v.party_name.toLowerCase().includes(s) ||
      (v.received_from && v.received_from.toLowerCase().includes(s)) ||
      (v.payment_against && v.payment_against.toLowerCase().includes(s))
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">نظام الحسابات والمالية</h1>
            <p className="text-sm text-muted-foreground mt-1">كشوف الحسابات التفصيلية وسندات القبض والصرف الفورية ومتابعة الأرصدة</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowDocSettingsDlg(true)} variant="outline" className="gap-2 border-slate-300 hover:bg-slate-100 text-slate-800 font-bold">
              <Palette className="w-4 h-4 text-amber-500" />
              تصميم وتخصيص الهيدر والشعار
            </Button>
            <Button onClick={() => setShowNewVoucherDlg(true)} className="gap-2 bg-red-600 hover:bg-red-700 text-white font-bold">
              <Plus className="w-4 h-4" />سند جديد
            </Button>
          </div>
        </div>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" dir="rtl">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-muted/60">
            <TabsTrigger value="statements" className="text-sm font-semibold gap-2">
              <FileSpreadsheet className="w-4 h-4" /> كشوف الحسابات
            </TabsTrigger>
            <TabsTrigger value="vouchers" className="text-sm font-semibold gap-2">
              <FileText className="w-4 h-4" /> السندات والدفعات
            </TabsTrigger>
            <TabsTrigger value="safes" className="text-sm font-semibold gap-2">
              <Wallet className="w-4 h-4" /> الصناديق والخزائن
            </TabsTrigger>
            <TabsTrigger value="chart" className="text-sm font-semibold gap-2">
              <Sliders className="w-4 h-4" /> الدليل والتهيئة المحاسبية
            </TabsTrigger>
          </TabsList>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 1: ACCOUNT STATEMENTS (كشوف الحسابات) */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="statements" className="space-y-6 mt-4">
            {/* Filter Card */}
            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  {/* Party Type Select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600">نوع الكشف</label>
                    <Select
                      value={statementPartyType}
                      onValueChange={(val: "employee" | "customer") => {
                        setStatementPartyType(val);
                        setSelectedPartyId("");
                      }}
                    >
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">كشف حساب موظف</SelectItem>
                        <SelectItem value="customer">كشف حساب عميل</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Party Select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600">
                      {statementPartyType === "employee" ? "اختر الموظف" : "اختر العميل"}
                    </label>
                    <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder={statementPartyType === "employee" ? "اختر موظفاً..." : "اختر عميلاً..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {statementPartyType === "employee"
                          ? employees.map((e: any) => (
                              <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.employee_number})</SelectItem>
                            ))
                          : customers.map((c: any) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.phone ? `(${c.phone})` : ""}</SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date range inputs */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600">من تاريخ</label>
                    <Input type="date" value={stmtStartDate} onChange={e => setStmtStartDate(e.target.value)} className="h-10 bg-white" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600">إلى تاريخ</label>
                    <Input type="date" value={stmtEndDate} onChange={e => setStmtEndDate(e.target.value)} className="h-10 bg-white" />
                  </div>
                </div>

                {selectedPartyId && (
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-dashed">
                    <div className="flex gap-2">
                      <Button onClick={() => setShowManualDlg(true)} variant="outline" className="gap-1.5 h-9 text-xs">
                        <Plus className="w-3.5 h-3.5" />إضافة قيد يدوي / تعديل رصيد
                      </Button>
                      <Button onClick={() => handlePrint("statement-print-area")} variant="secondary" className="gap-1.5 h-9 text-xs bg-slate-100 hover:bg-slate-200">
                        <Printer className="w-3.5 h-3.5" /> طباعة كشف الحساب (A4)
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">تحديث فوري للرصيد والبيانات</span>
                      <Button onClick={() => refetchStatement()} variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Statement Output (Exact matching of Image 2) */}
            {selectedPartyId ? (
              loadingStatement ? (
                <div className="text-center py-12 text-muted-foreground">جاري تحميل كشف الحساب وتجميع القيود والعمليات...</div>
              ) : statementData ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Ledger display (Interactive & Print-ready) */}
                  <div className="lg:col-span-3 space-y-4">
                    <div id="statement-print-area" className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm print-ready-statement relative overflow-hidden" dir="rtl">
                      {/* RED Wave Accent on top (matches image header waves) */}
                      <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-red-600 via-red-500 to-orange-500" />
                      
                      {/* Image Header with Logo */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="space-y-1 pt-2">
                          <h2 className="text-2xl font-black leading-tight" style={{ color: voucherConfig.accent_color }}>
                            {docPrintSettings?.companyName || voucherConfig.header_title}
                          </h2>
                          <p className="text-base font-bold text-gray-700 tracking-wider">
                            {docPrintSettings?.companySubtitle || voucherConfig.header_subtitle}
                          </p>
                        </div>
                        {/* Company Logo */}
                        <div className="w-24 h-24 rounded-full border-4 overflow-hidden flex items-center justify-center bg-white shadow" style={{ borderColor: voucherConfig.accent_color }}>
                          <img
                            src={docPrintSettings?.logoUrl || voucherConfig.logo_url}
                            alt="Company Logo"
                            className="w-20 h-20 object-contain"
                            onError={(e) => { e.currentTarget.src = "/omnisystem-logo.png"; }}
                          />
                        </div>
                      </div>

                      {/* Header Subtitle Banner */}
                      <div className="w-full text-center py-2 rounded-lg text-white font-black text-lg mb-6 shadow-sm flex items-center justify-center gap-2" style={{ backgroundColor: voucherConfig.accent_color }}>
                        <span>
                          {statementPartyType === "employee"
                            ? (docPrintSettings?.employeeHeaderText || "كشف حساب موظف")
                            : (docPrintSettings?.customerHeaderText || "كشف حساب عميل")}
                        </span>
                        <div className="w-4 h-1.5 bg-yellow-400 rounded-full" />
                      </div>

                      {/* Info Boxes (Matches Left orange box, right gray box) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Left Box (Orange Border / Orange Tint) */}
                        <div className="border border-amber-300 bg-amber-50/30 rounded-xl p-4 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-amber-900 w-24">اسم {statementPartyType === "employee" ? "الموظف" : "العميل"}:</span>
                            <span className="text-gray-800 font-extrabold">{statementData.party?.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-amber-900 w-24">رقم {statementPartyType === "employee" ? "الموظف" : "الهاتف"}:</span>
                            <span className="text-gray-800 font-mono font-bold">
                              {statementPartyType === "employee" ? statementData.party?.employee_number : (statementData.party?.phone || "—")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-amber-900 w-24">القسم / العنوان:</span>
                            <span className="text-gray-800 font-bold">
                              {statementPartyType === "employee" ? (statementData.party?.department_name || "—") : (statementData.party?.address || "—")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-amber-900 w-24">تاريخ الكشف:</span>
                            <span className="text-gray-800 font-mono font-bold">{new Date().toLocaleDateString("ar-SA")}</span>
                          </div>
                        </div>

                        {/* Right Box (Gray Border / Subtle BG) */}
                        <div className="border border-gray-300 bg-gray-50/50 rounded-xl p-4 space-y-2 flex flex-col justify-center">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-gray-600 w-24">الشهر:</span>
                            <span className="text-gray-800 font-bold">{new Date().toLocaleString("ar-SA", { month: "long" })}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-gray-600 w-24">سنة:</span>
                            <span className="text-gray-800 font-mono font-bold">{new Date().getFullYear()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-gray-600 w-24">رقم الكشف:</span>
                            <span className="text-gray-800 font-mono font-bold">STMT-{String(statementData.party?.id).padStart(4, "0")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Main Ledger Table (Styled exactly like image 2) */}
                      <div className="border border-gray-300 rounded-xl overflow-hidden mb-6">
                        <table className="w-full text-right border-collapse text-sm">
                          <thead>
                            <tr className="bg-red-600 text-white font-extrabold text-xs">
                              <th className="p-2 border-l border-red-700 w-10 text-center">م</th>
                              <th className="p-2 border-l border-red-700 w-24 text-center">التاريخ</th>
                              <th className="p-2 border-l border-red-700">البيان</th>
                              <th className="p-2 border-l border-red-700 w-28 text-center bg-red-700">مدين (خصم/سحب)</th>
                              <th className="p-2 border-l border-red-700 w-28 text-center">دائن (إضافة/دفع)</th>
                              <th className="p-2 w-32 text-center bg-red-700">الرصيد</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {/* Previous Balance Row */}
                            <tr className="bg-amber-50/20 font-bold text-gray-700">
                              <td className="p-2 text-center border-l border-gray-200 font-mono">—</td>
                              <td className="p-2 text-center border-l border-gray-200 font-mono">
                                {stmtStartDate ? stmtStartDate : "—"}
                              </td>
                              <td className="p-2 border-l border-gray-200 font-bold">الرصيد الافتتاحي / السابق في المدة</td>
                              <td className="p-2 text-center border-l border-gray-200 font-mono">—</td>
                              <td className="p-2 text-center border-l border-gray-200 font-mono">—</td>
                              <td className="p-2 text-center font-mono text-amber-800 bg-amber-50/10 font-black">
                                {fmt(statementData.previousBalance)}
                              </td>
                            </tr>

                            {/* Live Transactions */}
                            {statementData.transactions?.map((t: any, index: number) => (
                              <tr key={index} className="hover:bg-gray-50/60 text-xs text-gray-800">
                                <td className="p-2 text-center border-l border-gray-200 font-mono font-bold bg-amber-100/40">{index + 1}</td>
                                <td className="p-2 text-center border-l border-gray-200 font-mono whitespace-nowrap">{t.date}</td>
                                <td className="p-2 border-l border-gray-200 font-bold text-gray-900">
                                  <div className="flex justify-between items-center">
                                    <span>{t.description}</span>
                                    {t.source === "manual" && (
                                      <button
                                        onClick={() => confirm("حذف هذا القيد اليدوي؟") && deleteManualMutation.mutate(t.source_id)}
                                        className="no-print text-destructive hover:text-red-800 opacity-60 hover:opacity-100 p-0.5"
                                        title="حذف القيد اليدوي"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  {t.notes && <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{t.notes}</div>}
                                </td>
                                <td className="p-2 text-center border-l border-gray-200 font-mono font-semibold text-red-600 bg-red-50/20">
                                  {t.debit > 0 ? fmt(t.debit) : "—"}
                                </td>
                                <td className="p-2 text-center border-l border-gray-200 font-mono font-semibold text-emerald-600">
                                  {t.credit > 0 ? fmt(t.credit) : "—"}
                                </td>
                                <td className="p-2 text-center font-mono font-bold bg-amber-50/10 text-gray-900">
                                  {fmt(t.running_balance)}
                                </td>
                              </tr>
                            ))}

                            {statementData.transactions?.length === 0 && (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground italic bg-gray-50/20">
                                  لا توجد حركات مسجلة للطرف المحدد خلال الفترة المحددة.
                                </td>
                              </tr>
                            )}
                          </tbody>
                          {/* Total row (exactly matching shaded red total row in image) */}
                          <tfoot>
                            <tr className="bg-red-600 text-white font-extrabold text-xs">
                              <td colSpan={3} className="p-2.5 text-right border-l border-red-700">الإجمــــالـي</td>
                              <td className="p-2.5 text-center border-l border-red-700 font-mono bg-red-700">
                                {fmt(statementData.totalDebit)}
                              </td>
                              <td className="p-2.5 text-center border-l border-red-700 font-mono">
                                {fmt(statementData.totalCredit)}
                              </td>
                              <td className="p-2.5 text-center font-mono bg-red-700">
                                {fmt(statementData.currentBalance)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Lower Balance Cards (Matches الرصيد السابق / إجمالي الحركة / الرصيد الحالي boxes) */}
                      <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                        <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/30">
                          <div className="text-xs text-gray-500 font-bold mb-1">الرصيد السابق</div>
                          <div className="text-sm font-black font-mono text-gray-800">{fmt(statementData.previousBalance)}</div>
                        </div>
                        <div className="border border-red-200 rounded-xl p-3 bg-red-50/10">
                          <div className="text-xs text-red-600 font-bold mb-1">إجمالي الحركة (الصافي)</div>
                          <div className="text-sm font-black font-mono text-red-600">{fmt(statementData.netChange)}</div>
                        </div>
                        <div className="border border-amber-300 rounded-xl p-3 bg-amber-50/50">
                          <div className="text-xs text-amber-800 font-bold mb-1">الرصيد الحالي المستحق</div>
                          <div className="text-base font-black font-mono text-amber-900">{fmt(statementData.currentBalance)}</div>
                        </div>
                      </div>

                      {/* Notes Box with dotted lines (Exactly as in image 2) */}
                      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/30 text-xs">
                        <span className="font-extrabold text-gray-700">ملاحظات الكشف:</span>
                        <div className="mt-2 space-y-2">
                          <div className="dashed-line"></div>
                          <div className="dashed-line"></div>
                        </div>
                      </div>

                      {/* Bottom Slogan Wave Banner (Matches image 2 bottom footer wave) */}
                      <div className="mt-8 pt-4 border-t border-red-100 flex justify-between items-center text-xs font-bold text-red-600">
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>جودة الخبز ... سر ثقة عملائنا</span>
                        </div>
                        <span className="text-gray-400 font-mono">أنشئ بواسطة نظام الحسابات المعتمد</span>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Balance Widget */}
                  <div className="space-y-4">
                    <Card className="bg-slate-900 text-white border-0 shadow-lg">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <User className="w-4 h-4 text-amber-400" /> ملخص حساب الطرف
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-2">
                        <div>
                          <div className="text-xs text-slate-400 font-bold">الرصيد المستحق الحالي</div>
                          <div className="text-3xl font-black font-mono tracking-tight text-amber-400 mt-1">
                            {fmt(statementData.currentBalance)} <span className="text-xs font-bold">{voucherConfig.currency}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-bold">إجمالي السحوبات والخصم:</span>
                            <span className="font-bold font-mono text-red-400">-{fmt(statementData.totalDebit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-bold">إجمالي المستحقات والإيداع:</span>
                            <span className="font-bold font-mono text-emerald-400">+{fmt(statementData.totalCredit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-bold">حالة الحساب:</span>
                            <Badge className={statementData.currentBalance >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}>
                              {statementData.currentBalance >= 0 ? "دائن (له مستحقات)" : "مدين (عليه مستحقات)"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quick Voucher Print Card */}
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">سندات سريعة</CardTitle></CardHeader>
                      <CardContent className="space-y-2 pt-2">
                        <Button
                          onClick={() => {
                            setVoucherForm({
                              type: "payment",
                              party_type: statementPartyType,
                              party_id: selectedPartyId,
                              amount: "",
                              received_from: statementData.party?.name || "",
                              payment_against: "دفعة مسحوبة من الرصيد",
                              payment_method: "cash",
                              amount_text: "",
                              notes: "",
                              safe_id: ""
                            });
                            setShowNewVoucherDlg(true);
                          }}
                          className="w-full text-xs justify-start h-9 bg-red-600 hover:bg-red-700"
                        >
                          <Plus className="w-3.5 h-3.5 ml-1.5" /> إنشاء سند صرف (دفع له)
                        </Button>
                        <Button
                          onClick={() => {
                            setVoucherForm({
                              type: "receipt",
                              party_type: statementPartyType,
                              party_id: selectedPartyId,
                              amount: "",
                              received_from: statementData.party?.name || "",
                              payment_against: "دفعة سداد للحساب",
                              payment_method: "cash",
                              amount_text: "",
                              notes: "",
                              safe_id: ""
                            });
                            setShowNewVoucherDlg(true);
                          }}
                          className="w-full text-xs justify-start h-9 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Plus className="w-3.5 h-3.5 ml-1.5" /> إنشاء سند قبض (استلام منه)
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : null
            ) : (
              <div className="text-center py-16 border border-dashed rounded-2xl bg-white/50 space-y-3">
                <FileSpreadsheet className="w-12 h-12 text-muted-foreground/60 mx-auto" />
                <h3 className="font-bold text-gray-700">لم يتم اختيار جهة بعد</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">اختر موظفاً أو عميلاً من القائمة في الأعلى لتوليد كشف حسابه التفصيلي ومراجعة ميزان المدين والدائن الخاص به.</p>
              </div>
            )}
          </TabsContent>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 2: VOUCHERS LIST & DESIGNER (السندات والدفعات والتحكم بها) */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="vouchers" className="space-y-6 mt-4">
            <Card className="border border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-2 w-full md:max-w-md">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                      value={voucherSearch}
                      onChange={e => setVoucherSearch(e.target.value)}
                      placeholder="ابحث برقم السند، اسم الطرف، المقابل أو المحتويات..."
                      className="h-10 bg-white"
                    />
                  </div>
                  <Button onClick={() => setShowNewVoucherDlg(true)} className="gap-2 bg-red-600 hover:bg-red-700 text-white w-full md:w-auto h-10">
                    <Plus className="w-4 h-4" />إنشاء سند صرف أو قبض جديد
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Vouchers Table */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr className="text-slate-600 font-bold">
                    <th className="p-3 text-right">رقم السند</th>
                    <th className="p-3 text-right">نوع السند</th>
                    <th className="p-3 text-right">الطرف</th>
                    <th className="p-3 text-right">مستلم من / مدفوع لـ</th>
                    <th className="p-3 text-right">المبلغ</th>
                    <th className="p-3 text-right">مقابل / لأجل</th>
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 w-32"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredVouchers.map((v: any) => (
                    <tr key={v.id} className="hover:bg-muted/30 text-slate-800">
                      <td className="p-3 font-mono font-black text-gray-900">#{v.voucher_number}</td>
                      <td className="p-3">
                        <Badge className={v.type === "receipt" ? "bg-emerald-500/10 text-emerald-700 border-0" : "bg-red-500/10 text-red-700 border-0"}>
                          {v.type === "receipt" ? "سند قبض" : "سند صرف"}
                        </Badge>
                      </td>
                      <td className="p-3 font-semibold">
                        {v.party_type === "employee" ? "موظف" : "عميل"}
                      </td>
                      <td className="p-3 font-extrabold">{v.party_name}</td>
                      <td className="p-3 font-mono font-bold text-gray-950">
                        {fmt(v.amount)} <span className="text-xs font-bold text-muted-foreground">{v.currency}</span>
                      </td>
                      <td className="p-3 text-slate-600 font-medium truncate max-w-[200px]">{v.payment_against || "—"}</td>
                      <td className="p-3 font-mono text-xs">{v.created_at?.slice(0, 10)}</td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => setViewVoucher(v)} className="gap-1 text-xs">
                            <Eye className="w-3.5 h-3.5" /> عرض السند
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => confirm("حذف هذا السند نهائياً؟") && deleteVoucherMutation.mutate(v.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredVouchers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground italic">
                        لا توجد سندات مسجلة مطابقة لمعايير البحث.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 3: SAFES & TREASURY BOXES (الصناديق والخزائن) */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="safes" className="space-y-6 mt-4">
            <div className="flex justify-between items-center bg-white p-4 border rounded-xl shadow-sm">
              <div>
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Wallet className="w-5 h-5 text-red-600" />الصناديق المالية المتوفرة</h3>
                <p className="text-xs text-muted-foreground mt-1">التحكم بالصناديق من إضافة وحذف وتعديل ومراقبة رصيدها الفعلي والعملات المهيئة</p>
              </div>
              <Button onClick={() => {
                setEditingSafe(null);
                setSafeForm({ name: "", balance: "0", currency: "ريال", notes: "", active: true });
                setShowSafeDlg(true);
              }} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                <Plus className="w-4 h-4" /> إضافة صندوق مالي جديد
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {safes.map((s: any) => (
                <Card key={s.id} className="border shadow-sm hover:border-red-200 transition-all">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex justify-between items-center">
                      <span className="font-bold text-slate-800">{s.name}</span>
                      <Badge variant={s.active ? "default" : "secondary"}>
                        {s.active ? "نشط" : "معطل"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">الرصيد المتوفر:</span>
                      <span className="text-2xl font-black text-red-600 font-mono">
                        {fmt(s.balance)} <span className="text-xs font-bold text-slate-500">{s.currency}</span>
                      </span>
                    </div>
                    {s.notes && (
                      <p className="text-xs text-muted-foreground bg-slate-50 p-2 rounded border border-dashed">
                        {s.notes}
                      </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditingSafe(s);
                        setSafeForm({ name: s.name, balance: String(s.balance), currency: s.currency, notes: s.notes ?? "", active: s.active === 1 });
                        setShowSafeDlg(true);
                      }} className="gap-1 text-xs">
                        <Edit className="w-3.5 h-3.5" /> تعديل
                      </Button>
                      <Button variant="ghost" size="sm" disabled={s.name === "الصندوق الرئيسي"} onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف صندوق "${s.name}"؟`)) {
                          deleteSafeMutation.mutate(s.id);
                        }
                      }} className="text-destructive gap-1 text-xs">
                        <Trash2 className="w-3.5 h-3.5" /> حذف
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {safes.length === 0 && (
                <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed text-muted-foreground italic">
                  لا توجد صناديق مالية مهيأة بعد.
                </div>
              )}
            </div>
          </TabsContent>

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB 4: CHART OF ACCOUNTS & SYSTEM GUIDE */}
          {/* ──────────────────────────────────────────────────────── */}
          <TabsContent value="chart" className="space-y-6 mt-4">
            {/* Inner navigation for chart of accounts and guides */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <Button
                  variant={innerGuideTab === "concepts" ? "default" : "ghost"}
                  onClick={() => setInnerGuideTab("concepts")}
                  className="text-xs h-8 font-bold gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" /> الدليل المحاسبي الشامل
                </Button>
                <Button
                  variant={innerGuideTab === "coa" ? "default" : "ghost"}
                  onClick={() => setInnerGuideTab("coa")}
                  className="text-xs h-8 font-bold gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" /> شجرة الحسابات
                </Button>
                <Button
                  variant={innerGuideTab === "trial" ? "default" : "ghost"}
                  onClick={() => setInnerGuideTab("trial")}
                  className="text-xs h-8 font-bold gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> ميزان المراجعة
                </Button>
                <Button
                  variant={innerGuideTab === "journal" ? "default" : "ghost"}
                  onClick={() => setInnerGuideTab("journal")}
                  className="text-xs h-8 font-bold gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" /> دفتر اليومية العامة
                </Button>
              </div>

              {innerGuideTab === "coa" && (
                <Button onClick={() => setShowAddAccountDlg(true)} className="gap-2 bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-bold">
                  <Plus className="w-3.5 h-3.5" /> إضافة حساب جديد
                </Button>
              )}
            </div>

            {/* Inner Tab 1: Concepts & Guides */}
            {innerGuideTab === "concepts" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Right side categories sidebar */}
                <div className="lg:col-span-1 space-y-4">
                  <Card className="border shadow-sm bg-slate-50/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-red-600" />
                        فهرس دليل الاستخدام المحاسبي
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <p className="text-muted-foreground leading-relaxed">
                        يحتوي هذا الدليل المالي على شروحات عميقة لكافة الحركات المحاسبية التلقائية التي يقوم بها نظام أومني برو الذكي لربط عمليات الصالة والمطبخ والمخازن بالدفاتر المالية والقيود المزدوجة.
                      </p>
                      <div className="pt-2 border-t space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 py-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          <span>1. هيكلية الحسابات (COA)</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 py-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          <span>2. قيود المبيعات ومرتجعاتها</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 py-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          <span>3. دورة ضريبة القيمة المضافة</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 py-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          <span>4. حركة الخزائن والتحويل المالي</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 py-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          <span>5. حسابات الرواتب وسلف الموظفين</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 py-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          <span>6. تسوية عجز وزيادة الكاشيرية</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 py-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                          <span>7. إتلاف المكونات ومصروف المطبخ</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Main guide content area */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Part 1 */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3 bg-red-50/20 border-b">
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs">1</span>
                        هيكلية الدليل المحاسبي (Chart of Accounts)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 text-sm text-slate-700 leading-relaxed">
                      <p>
                        يتبنى النظام دليلاً محاسبياً متكاملاً مبنياً على الترميز الخماسي لتنظيم الحسابات وتوزيعها على القوائم المالية الرئيسية:
                      </p>
                      <ul className="list-disc list-inside space-y-2 pr-2 text-xs">
                        <li><strong className="text-slate-900">الأصول (Assets) - تبدأ بالرقم 1:</strong> تشمل النقدية بالصناديق (11100)، ذمم العملاء (11200)، والمخزون الغذائي (11300). طبيعتها <span className="font-bold text-green-700">مدينة</span>.</li>
                        <li><strong className="text-slate-900">الالتزامات (Liabilities) - تبدأ بالرقم 2:</strong> تشمل الموردين (21100)، ومستحقات الموظفين (21200)، وضريبة المبيعات المستحقة (21300). طبيعتها <span className="font-bold text-red-700">دائنة</span>.</li>
                        <li><strong className="text-slate-900">حقوق الملكية (Equity) - تبدأ بالرقم 3:</strong> تشمل رأس المال (31000) والأرباح المبقاة (32000). طبيعتها <span className="font-bold text-red-700">دائنة</span>.</li>
                        <li><strong className="text-slate-900">الإيرادات (Revenue) - تبدأ بالرقم 4:</strong> تشمل إيرادات مبيعات المطعم والخدمات (41000). طبيعتها <span className="font-bold text-red-700">دائنة</span>.</li>
                        <li><strong className="text-slate-900">تكلفة المبيعات (COGS) - تبدأ بالرقم 5:</strong> تمثل تكلفة المواد الخام المستخدمة في تحضير الأطباق (51000). طبيعتها <span className="font-bold text-green-700">مدينة</span>.</li>
                        <li><strong className="text-slate-900">المصروفات (Expenses) - تبدأ بالرقم 6:</strong> تشمل مصاريف الكهرباء والتشغيل (61000)، مصروف التوالف (62000) ورواتب العمالة (63000). طبيعتها <span className="font-bold text-green-700">مدينة</span>.</li>
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Part 2 */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3 bg-red-50/20 border-b">
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs">2</span>
                        التسجيل الآلي لقيود المبيعات ومرتجع المبيعات
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4 text-sm text-slate-700">
                      <div>
                        <h4 className="font-bold text-slate-900 mb-1.5 text-xs">أولاً: قيد فاتورة المبيعات (عند الدفع نقداً)</h4>
                        <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] space-y-1 select-all" dir="ltr">
                          <div>[DEBIT]  11100 - الصندوق الرئيسي              : 115.00 SAR</div>
                          <div>[CREDIT] 41000 - إيرادات مبيعات المطعم       : 100.00 SAR</div>
                          <div>[CREDIT] 21300 - ضريبة القيمة المضافة المستحقة :  15.00 SAR</div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          يقوم النظام بتوجيه القيمة الإجمالية شاملة الضريبة إلى حساب الصندوق المختار، بينما يفصل قيمة الإيراد الصافي عن ضريبة القيمة المضافة (15%).
                        </p>
                      </div>

                      <div className="pt-2 border-t">
                        <h4 className="font-bold text-slate-900 mb-1.5 text-xs">ثانياً: قيد فاتورة مرتجع المبيعات</h4>
                        <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] space-y-1 select-all" dir="ltr">
                          <div>[DEBIT]  41000 - إيرادات مبيعات المطعم       : 100.00 SAR</div>
                          <div>[DEBIT]  21300 - ضريبة القيمة المضافة المستحقة :  15.00 SAR</div>
                          <div>[CREDIT] 11100 - الصندوق الرئيسي              : 115.00 SAR</div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          عند ارجاع الطلب، يتم عكس القيد لخفض الإيرادات وتخفيض الالتزام الضريبي وإرجاع النقدية للعميل.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Part 3 */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3 bg-red-50/20 border-b">
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs">3</span>
                        دورة الصناديق والتحويلات المالية والتسويات
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 text-sm text-slate-700">
                      <p>
                        يمكنك تهيئة عدة صناديق مالية (صندوق الصالة، صندوق الكاشير، صندوق الإدارة). يتم ضبط حركة الصناديق كالتالي:
                      </p>
                      <ul className="list-disc list-inside space-y-2 pr-2 text-xs">
                        <li><strong className="text-slate-900">التحويل المالي بين الصناديق:</strong> عند تحويل أموال من كاشير الصالة إلى الصندوق الرئيسي، يسجل النظام قيداً يعكس استلام صندوق الإدارة [DEBIT] وخصمه من صندوق كاشير الصالة [CREDIT].</li>
                        <li><strong className="text-slate-900">عجز وزيادة الصندوق (Reconciliation Adjustment):</strong> في نهاية وردية الكاشير، وعند حدوث فارق بين الرصيد الفعلي والرصيد الدفتري:
                          <ul className="list-decimal list-inside pr-4 mt-1.5 space-y-1 text-slate-600">
                            <li><strong className="text-slate-800">حالة العجز:</strong> يقيد الفارق كـ [DEBIT] في حساب خسائر عجز الصناديق (61000) و [CREDIT] في حساب الصندوق لخفض رصيده الدفتري ليطابق الفعلي.</li>
                            <li><strong className="text-slate-800">حالة الزيادة:</strong> يقيد الفارق كـ [DEBIT] في حساب الصندوق لزيادة رصيده و [CREDIT] في حساب أرباح فروقات الصناديق (41000).</li>
                          </ul>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Part 4 */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3 bg-red-50/20 border-b">
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs">4</span>
                        معالجة الرواتب والأجور وسلف الموظفين
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 text-sm text-slate-700">
                      <p>
                        تتبع الرواتب دورة محاسبية منظمة لضمان التطابق المالي:
                      </p>
                      <ul className="list-disc list-inside space-y-2 pr-2 text-xs">
                        <li><strong className="text-slate-900">قيد استحقاق الراتب الشهري (نهاية الشهر):</strong> يتم تسجيل مصروف الرواتب كالتزام مستحق:
                          <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-[11px] my-1.5" dir="ltr">
                            [DEBIT]  63000 - مصروف الرواتب والأجور       : 3,000.00 SAR<br/>
                            [CREDIT] 21200 - رواتب وأجور مستحقة          : 3,000.00 SAR
                          </div>
                        </li>
                        <li><strong className="text-slate-900">قيد صرف الراتب الفعلي (عبر سند صرف):</strong> عند تحويل الراتب للموظف، يتم خفض الالتزام والنقدية:
                          <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-[11px] my-1.5" dir="ltr">
                            [DEBIT]  21200 - رواتب وأجور مستحقة          : 3,000.00 SAR<br/>
                            [CREDIT] 11100 - الصندوق الرئيسي              : 3,000.00 SAR
                          </div>
                        </li>
                        <li><strong className="text-slate-900">سلف وقروض الموظفين:</strong> عند إعطاء سلفة لموظف، تسجل كـ [DEBIT] في حسابه (أصل متداول كذمم موظفين) وتخصم من راتبه عند الاستحقاق.</li>
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Part 5 */}
                  <Card className="border shadow-sm">
                    <CardHeader className="pb-3 bg-red-50/20 border-b">
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs">5</span>
                        إتلاف المواد والفاقد بالمطبخ (Kitchen Wastage)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3 text-sm text-slate-700">
                      <p>
                        لحساب الهدر الغذائي المباشر في المطبخ بدقة، يوفر النظام قيد الإتلاف التلقائي عند تسجيل هدر في قائمة المخزون:
                      </p>
                      <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] space-y-1" dir="ltr">
                        <div>[DEBIT]  62000 - مصروف تالف ومفقودات المطبخ : 150.00 SAR</div>
                        <div>[CREDIT] 11300 - المخزون والسلع الغذائية     : 150.00 SAR</div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        يضمن هذا القيد خفض رصيد المخزون الفعلي بالجرام أو الوحدة، وتحميل قيمة المواد التالفة مباشرة على حساب مصروفات الهدر التشغيلي لحساب صافي الربح والخسارة بدقة متناهية.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Inner Tab 2: Chart of Accounts List */}
            {innerGuideTab === "coa" && (
              <Card className="border shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">دليل شجرة الحسابات الفعال</CardTitle>
                    <p className="text-xs text-muted-foreground">استعرض كافة الحسابات المعتمدة ورموزها وأرصدتها الحالية في النظام المحاسبي</p>
                  </div>
                  <div className="w-64">
                    <div className="relative">
                      <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={accountSearch}
                        onChange={e => setAccountSearch(e.target.value)}
                        placeholder="ابحث برمز أو اسم الحساب..."
                        className="pr-9 h-9 bg-white"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="border-b bg-slate-50/70 text-slate-700 font-bold h-10">
                          <th className="px-4">رمز الحساب</th>
                          <th className="px-4">اسم الحساب</th>
                          <th className="px-4">نوع الحساب</th>
                          <th className="px-4 text-center">طبيعة الحساب</th>
                          <th className="px-4 text-left">الرصيد الحالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {((accountsList || []).filter((acc: any) => {
                          if (!accountSearch.trim()) return true;
                          const s = accountSearch.toLowerCase();
                          return acc.code.toLowerCase().includes(s) || acc.name.toLowerCase().includes(s);
                        })).map((acc: any) => {
                          const isDebitNormal = ["asset", "expense", "cogs", "wastage"].includes(acc.type);
                          return (
                            <tr key={acc.id} className="hover:bg-slate-50/50 h-10">
                              <td className="px-4 font-mono font-bold text-slate-900">{acc.code}</td>
                              <td className="px-4 font-bold text-slate-800">{acc.name}</td>
                              <td className="px-4">
                                <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                  {acc.type === "asset" && "أصول (Asset)"}
                                  {acc.type === "liability" && "التزامات (Liability)"}
                                  {acc.type === "equity" && "حقوق ملكية (Equity)"}
                                  {acc.type === "revenue" && "إيرادات (Revenue)"}
                                  {acc.type === "cogs" && "تكلفة مبيعات (COGS)"}
                                  {acc.type === "expense" && "مصروفات (Expense)"}
                                </span>
                              </td>
                              <td className="px-4 text-center">
                                <span className={isDebitNormal ? "text-green-700 font-bold" : "text-blue-700 font-bold"}>
                                  {isDebitNormal ? "مدين" : "دائن"}
                                </span>
                              </td>
                              <td className="px-4 text-left font-mono font-black text-slate-900">
                                {fmt(acc.balance)} ريال
                              </td>
                            </tr>
                          );
                        })}
                        {accountsList.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-muted-foreground italic">
                              جاري تحميل شجرة الحسابات...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Inner Tab 3: Trial Balance */}
            {innerGuideTab === "trial" && (
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle>ميزان المراجعة بالأرصدة</CardTitle>
                  <p className="text-xs text-muted-foreground">كشف إجمالي لمطابقة وتوازن حركة الحسابات الدفترية في النظام</p>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="border-b bg-slate-50 text-slate-700 font-bold h-10">
                          <th className="px-4">رمز الحساب</th>
                          <th className="px-4">اسم الحساب</th>
                          <th className="px-4 text-left">أرصدة مدينة (Debit)</th>
                          <th className="px-4 text-left">أرصدة دائنة (Credit)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(trialBalance?.accounts || []).map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-slate-50/50 h-10">
                            <td className="px-4 font-mono font-semibold">{acc.code}</td>
                            <td className="px-4 font-bold text-slate-800">{acc.name}</td>
                            <td className="px-4 text-left font-mono text-green-700 font-bold">{acc.debit > 0 ? fmt(acc.debit) : "—"}</td>
                            <td className="px-4 text-left font-mono text-blue-700 font-bold">{acc.credit > 0 ? fmt(acc.credit) : "—"}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-black h-12 text-slate-900 border-t-2">
                          <td colSpan={2} className="px-4 text-base">المجموع المتوازن (Grand Totals)</td>
                          <td className="px-4 text-left font-mono text-green-800 text-sm">{fmt(trialBalance?.totalDebit)} ريال</td>
                          <td className="px-4 text-left font-mono text-blue-800 text-sm">{fmt(trialBalance?.totalCredit)} ريال</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {trialBalance?.totalDebit === trialBalance?.totalCredit && trialBalance?.totalDebit > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 p-3 rounded-lg text-xs font-bold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>النظام متوازن محاسبياً بالكامل! ميزان المراجعة متطابق (الجانب المدين يساوي الجانب الدائن).</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Inner Tab 4: General Ledger Journal Log */}
            {innerGuideTab === "journal" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">دفتر قيود اليومية العامة (System General Journal)</h3>
                    <p className="text-xs text-muted-foreground">سجل تاريخي تفصيلي لكافة قيود الحركات المباشرة والتلقائية الصادرة عن الكاشير والمخازن</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {(journalEntries || []).map((entry: any) => (
                    <Card key={entry.id} className="border shadow-sm bg-white overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 border-b flex justify-between items-center text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900">رقم القيد: #{entry.id}</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-600 font-semibold">{entry.entry_date}</span>
                        </div>
                        <span className="font-black text-slate-800">{entry.description}</span>
                      </div>
                      <CardContent className="p-0">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="border-b bg-slate-50/30 text-slate-500 font-bold h-8">
                              <th className="px-4">رمز الحساب</th>
                              <th className="px-4">اسم الحساب</th>
                              <th className="px-4 text-left">مدين (Debit)</th>
                              <th className="px-4 text-left">دائن (Credit)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y font-mono">
                            {(entry.lines || []).map((line: any) => (
                              <tr key={line.id} className="h-9 hover:bg-slate-50/30">
                                <td className="px-4 font-bold text-slate-700">{line.account_code}</td>
                                <td className="px-4 font-bold text-slate-800">{line.account_name}</td>
                                <td className="px-4 text-left text-green-700 font-bold">{line.debit > 0 ? fmt(line.debit) : "—"}</td>
                                <td className="px-4 text-left text-blue-700 font-bold">{line.credit > 0 ? fmt(line.credit) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  ))}
                  {(journalEntries || []).length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed text-muted-foreground italic text-xs">
                      لا توجد قيود يومية مسجلة بعد.
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ──────────────────────────────────────────────────────── */}
          {/* DIALOG: ADD NEW ACCOUNT (إضافة حساب جديد بالدليل) */}
          {/* ──────────────────────────────────────────────────────── */}
          <Dialog open={showAddAccountDlg} onOpenChange={setShowAddAccountDlg}>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-slate-900">
                  <Sliders className="w-5 h-5 text-red-600" />
                  إضافة حساب فرعي جديد بالدليل المحاسبي
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-gray-700">نوع الحساب الرئيسي *</label>
                  <Select
                    value={accountForm.type}
                    onValueChange={(val: any) => setAccountForm(f => ({ ...f, type: val }))}
                  >
                    <SelectTrigger className="mt-1 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">أصول (Assets)</SelectItem>
                      <SelectItem value="liability">التزامات (Liabilities)</SelectItem>
                      <SelectItem value="equity">حقوق الملكية (Equity)</SelectItem>
                      <SelectItem value="revenue">إيرادات (Revenues)</SelectItem>
                      <SelectItem value="cogs">تكلفة المبيعات (COGS)</SelectItem>
                      <SelectItem value="expense">مصروفات (Expenses)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-700">رمز الحساب الفرعي *</label>
                    <Input
                      value={accountForm.code}
                      onChange={e => setAccountForm(f => ({ ...f, code: e.target.value }))}
                      placeholder="مثال: 11105"
                      className="mt-1 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700">اسم الحساب الفرعي *</label>
                    <Input
                      value={accountForm.name}
                      onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="مثال: عهدة كاشير وردية ب"
                      className="mt-1 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700">رمز الحساب الأب (اختياري)</label>
                  <Input
                    value={accountForm.parent_code}
                    onChange={e => setAccountForm(f => ({ ...f, parent_code: e.target.value }))}
                    placeholder="مثال: 11000"
                    className="mt-1 bg-white"
                  />
                </div>
              </div>
              <DialogFooter className="pt-4 gap-2">
                <Button variant="outline" onClick={() => setShowAddAccountDlg(false)}>إلغاء</Button>
                <Button
                  onClick={() => createAccountMutation.mutate(accountForm)}
                  disabled={!accountForm.code || !accountForm.name || createAccountMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  حفظ الحساب
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Tabs>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* DIALOG: NEW MANUAL ENTRY (قيد يدوي / رصيد افتتاحي) */}
      {/* ──────────────────────────────────────────────────────── */}
      <Dialog open={showManualDlg} onOpenChange={setShowManualDlg}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-slate-900"><Plus className="w-5 h-5 text-red-600" />إضافة قيد يدوي / تسوية رصيد</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-gray-700">البيان / الوصف القصير *</label>
              <Input
                value={manualForm.description}
                onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))}
                placeholder="مثال: رصيد افتتاحي للعميل، خصم سلفة..."
                className="mt-1 bg-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700">مدين (سحب / خصم / مبيعات)</label>
                <Input
                  type="number"
                  value={manualForm.debit}
                  onChange={e => setManualForm(f => ({ ...f, debit: e.target.value }))}
                  placeholder="0"
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">دائن (إيداع / إضافة / سداد)</label>
                <Input
                  type="number"
                  value={manualForm.credit}
                  onChange={e => setManualForm(f => ({ ...f, credit: e.target.value }))}
                  placeholder="0"
                  className="mt-1 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700">التاريخ</label>
                <Input
                  type="date"
                  value={manualForm.entry_date}
                  onChange={e => setManualForm(f => ({ ...f, entry_date: e.target.value }))}
                  className="mt-1 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">ملاحظات إضافية</label>
                <Input
                  value={manualForm.notes}
                  onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="اختيارية"
                  className="mt-1 bg-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 gap-2">
            <Button variant="outline" onClick={() => setShowManualDlg(false)}>إلغاء</Button>
            <Button
              onClick={() => addManualMutation.mutate(manualForm)}
              disabled={!manualForm.description || addManualMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              حفظ القيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────── */}
      {/* DIALOG: NEW VOUCHER CREATION WITH CONTROLS (إنشاء سند جديد) */}
      {/* ──────────────────────────────────────────────────────── */}
      <Dialog open={showNewVoucherDlg} onOpenChange={setShowNewVoucherDlg}>
        <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col p-0" dir="rtl">
          <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Plus className="w-5 h-5 text-red-600" /> إنشاء سند قبض أو صرف جديد ومعايرته
            </DialogTitle>
            <Button variant="ghost" onClick={() => setShowNewVoucherDlg(false)} className="text-gray-500 font-bold hover:text-gray-900">إغلاق</Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-100/40">
            {/* Left: Input Form (5 cols) */}
            <div className="lg:col-span-5 bg-white border rounded-xl p-5 space-y-4 shadow-sm">
              <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-red-600" /> بيانات ومعطيات السند
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">نوع السند</label>
                  <Select value={voucherForm.type} onValueChange={(val: any) => setVoucherForm(v => ({ ...v, type: val }))}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receipt">سند قبض (استلام)</SelectItem>
                      <SelectItem value="payment">سند صرف (دفع)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">فئة الطرف</label>
                  <Select
                    value={voucherForm.party_type}
                    onValueChange={(val: any) => {
                      setVoucherForm(v => ({ ...v, party_type: val, party_id: "", received_from: "" }));
                    }}
                  >
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">الموظفين</SelectItem>
                      <SelectItem value="customer">العملاء</SelectItem>
                      <SelectItem value="supplier">الموردين</SelectItem>
                      <SelectItem value="general">عام / طرف آخر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {voucherForm.party_type !== "general" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">اختيار الشخص / الجهة من النظام</label>
                  <Select
                    value={voucherForm.party_id}
                    onValueChange={(val) => handleVoucherPartyChange(voucherForm.party_type, val)}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="اختر شخصاً أو جهة..." />
                    </SelectTrigger>
                    <SelectContent>
                      {voucherForm.party_type === "employee"
                        ? employees.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)
                        : voucherForm.party_type === "customer"
                        ? customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)
                        : suppliers.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">الصندوق المالي المستهدف *</label>
                <Select
                  value={voucherForm.safe_id}
                  onValueChange={val => {
                    setVoucherForm(v => ({ ...v, safe_id: val }));
                    const chosen = safes.find((s: any) => String(s.id) === val);
                    if (chosen && chosen.currency) {
                      setVoucherConfig(vc => ({ ...vc, currency: chosen.currency }));
                    }
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="اختر الصندوق..." />
                  </SelectTrigger>
                  <SelectContent>
                    {safes.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({fmt(s.balance)} {s.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">المبلغ بالأرقام *</label>
                  <Input
                    type="number"
                    value={voucherForm.amount}
                    onChange={e => setVoucherForm(v => ({ ...v, amount: e.target.value }))}
                    placeholder="0.00"
                    className="bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>عملة السند *</span>
                  </label>
                  <div className="flex gap-1.5">
                    <Select
                      value={voucherConfig.currency}
                      onValueChange={val => setVoucherConfig(v => ({ ...v, currency: val }))}
                    >
                      <SelectTrigger className="w-24 bg-white text-xs">
                        <SelectValue placeholder="العملة" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="ريال">ريال</SelectItem>
                        <SelectItem value="ر.س">ر.س</SelectItem>
                        <SelectItem value="دولار">دولار ($)</SelectItem>
                        <SelectItem value="دينار">دينار</SelectItem>
                        <SelectItem value="ريال يمني">ريال يمني</SelectItem>
                        <SelectItem value="EUR">يورو (€)</SelectItem>
                        <SelectItem value="AED">درهم إماراتي</SelectItem>
                        {currenciesList.map((c: any) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={voucherConfig.currency}
                      onChange={e => setVoucherConfig(v => ({ ...v, currency: e.target.value }))}
                      placeholder="أو اكتب..."
                      className="bg-white flex-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              {voucherForm.safe_id && (() => {
                const selectedSafe = safes.find((s: any) => String(s.id) === voucherForm.safe_id);
                if (!selectedSafe) return null;
                const isMatched = voucherConfig.currency === selectedSafe.currency;
                return isMatched ? (
                  <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>عملة السند (<b>{voucherConfig.currency}</b>) مطابقة لعملة الصندوق المختار (<b>{selectedSafe.name}</b>).</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>تنبيه: عملة السند (<b>{voucherConfig.currency}</b>) تختلف عن عملة الصندوق الأصلية (<b>{selectedSafe.name}</b> - {selectedSafe.currency}).</span>
                  </div>
                );
              })()}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">استلمنا من السيد / مدفوع للسيد</label>
                <Input
                  value={voucherForm.received_from}
                  onChange={e => setVoucherForm(v => ({ ...v, received_from: e.target.value }))}
                  placeholder="الاسم كامل"
                  className="bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">مبلغ وقدره كتابةً</label>
                <Input
                  value={voucherForm.amount_text}
                  onChange={e => setVoucherForm(v => ({ ...v, amount_text: e.target.value }))}
                  placeholder="مثال: ألف وخمسمائة دينار فقط لا غير"
                  className="bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">وذلك مقابل</label>
                  <Input
                    value={voucherForm.payment_against}
                    onChange={e => setVoucherForm(v => ({ ...v, payment_against: e.target.value }))}
                    placeholder="سبب الصرف أو القبض"
                    className="bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">طريقة الدفع</label>
                  <Select value={voucherForm.payment_method} onValueChange={val => setVoucherForm(v => ({ ...v, payment_method: val }))}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقداً</SelectItem>
                      <SelectItem value="card">شبكة</SelectItem>
                      <SelectItem value="bank">تحويل بنكي</SelectItem>
                      <SelectItem value="cheque">شيك</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">ملاحظات السند (للمراجعة الداخلية)</label>
                <Input
                  value={voucherForm.notes}
                  onChange={e => setVoucherForm(v => ({ ...v, notes: e.target.value }))}
                  placeholder="اختيارية"
                  className="bg-white"
                />
              </div>
            </div>

            {/* Middle: Customizer controls (3 cols) */}
            <div className="lg:col-span-3 bg-white border rounded-xl p-5 space-y-4 shadow-sm">
              <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-500" /> مظهر وتفاصيل السند
              </h3>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">عنوان الهيدر الرئيسي</label>
                <Input
                  value={voucherConfig.header_title}
                  onChange={e => setVoucherConfig(v => ({ ...v, header_title: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">عنوان فرعي / إنجليزي</label>
                <Input
                  value={voucherConfig.header_subtitle}
                  onChange={e => setVoucherConfig(v => ({ ...v, header_subtitle: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">شعار / صورة الترويسة (Logo)</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={voucherConfig.logo_url}
                    onChange={e => setVoucherConfig(v => ({ ...v, logo_url: e.target.value }))}
                    placeholder="/omnisystem-logo.png أو رابط صورة"
                    className="text-xs flex-1"
                  />
                  <label className="cursor-pointer shrink-0 bg-slate-100 hover:bg-slate-200 border text-slate-700 px-2.5 py-1.5 rounded-md font-bold flex items-center gap-1 text-xs">
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                    ادراج من الملفات
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setVoucherConfig((v) => ({ ...v, logo_url: event.target!.result as string }));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">اللون المميز (Accent)</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVoucherConfig(v => ({ ...v, accent_color: "#ef4444" }))}
                    className="w-6 h-6 rounded-full bg-red-500 border border-black/10"
                    title="أحمر الشام"
                  />
                  <button
                    onClick={() => setVoucherConfig(v => ({ ...v, accent_color: "#1d4ed8" }))}
                    className="w-6 h-6 rounded-full bg-blue-700 border border-black/10"
                    title="أزرق"
                  />
                  <button
                    onClick={() => setVoucherConfig(v => ({ ...v, accent_color: "#15803d" }))}
                    className="w-6 h-6 rounded-full bg-green-700 border border-black/10"
                    title="أخضر"
                  />
                  <button
                    onClick={() => setVoucherConfig(v => ({ ...v, accent_color: "#ca8a04" }))}
                    className="w-6 h-6 rounded-full bg-yellow-600 border border-black/10"
                    title="ذهبي"
                  />
                </div>
                <Input
                  value={voucherConfig.accent_color}
                  onChange={e => setVoucherConfig(v => ({ ...v, accent_color: e.target.value }))}
                  placeholder="#ef4444"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">شعار ذيل السند</label>
                <Input
                  value={voucherConfig.bottom_text}
                  onChange={e => setVoucherConfig(v => ({ ...v, bottom_text: e.target.value }))}
                />
              </div>
            </div>

            {/* Right: Real-time Live Preview matching Image 1 (4 cols) */}
            <div className="lg:col-span-4 bg-white border rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-500" /> معاينة السند الفورية
                </h3>
                
                {/* Image 1 Replica Card container */}
                <div className="border border-gray-300 rounded-xl p-4 bg-white relative overflow-hidden" dir="rtl" style={{ borderColor: voucherConfig.accent_color + "40" }}>
                  {/* Top Arc Header with Logo */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-black" style={{ color: voucherConfig.accent_color }}>{voucherConfig.header_title}</div>
                      <div className="text-[9px] font-bold text-gray-500 leading-none">{voucherConfig.header_subtitle}</div>
                      
                      {/* Title: "سند" with decorative wheat/accent */}
                      <div className="pt-2 text-center flex flex-col items-center">
                        <span className="text-lg font-black tracking-widest leading-none" style={{ color: voucherConfig.accent_color }}>
                          {voucherForm.type === "receipt" ? "سند قـبـض" : "سند صـرف"}
                        </span>
                        <div className="w-12 h-1 mt-1 rounded-full" style={{ backgroundColor: voucherConfig.accent_color }} />
                      </div>
                    </div>
                    
                    {/* Rounded Logo */}
                    <div className="w-14 h-14 rounded-full border-2 overflow-hidden flex items-center justify-center shadow-sm" style={{ borderColor: voucherConfig.accent_color }}>
                      <img src={voucherConfig.logo_url} className="w-12 h-12 object-contain" onError={(e)=>{e.currentTarget.src='https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=100'}} />
                    </div>
                  </div>

                  {/* Voucher Number & Date */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                    <div className="border rounded px-2 py-1 flex justify-between bg-slate-50/50" style={{ borderColor: voucherConfig.accent_color }}>
                      <span className="font-bold">رقم السند:</span>
                      <span className="font-bold">#</span>
                    </div>
                    <div className="border-b border-dashed py-1 text-left">
                      <span className="text-gray-500 font-bold ml-1">التاريخ:</span>
                      <span className="font-bold font-mono">{new Date().toLocaleDateString("ar-SA")}</span>
                    </div>
                  </div>

                  {/* Main Voucher Body Block */}
                  <div className="border rounded-xl p-3 bg-white space-y-2" style={{ borderColor: voucherConfig.accent_color + "50" }}>
                    {/* Amount & Currency */}
                    <div className="flex rounded overflow-hidden text-xs max-w-[150px] border shadow-sm" style={{ borderColor: voucherConfig.accent_color }}>
                      <div className="text-white font-extrabold px-2.5 py-1 flex items-center justify-center" style={{ backgroundColor: voucherConfig.accent_color }}>
                        المبلغ
                      </div>
                      <div className="bg-amber-50/30 text-gray-900 font-bold px-3 py-1 font-mono flex-1 flex items-center justify-center">
                        {voucherForm.amount || "0.00"} {voucherConfig.currency}
                      </div>
                    </div>

                    {/* Dotted lines for fields */}
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-gray-500 shrink-0">استلمنا من السيد /</span>
                        <span className="font-extrabold text-gray-900 border-b border-dashed border-gray-300 flex-1 py-0.5 truncate min-h-[16px]">
                          {voucherForm.received_from || "—"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="font-bold text-gray-500 shrink-0">مبلغ وقدره /</span>
                        <span className="font-semibold text-gray-900 border-b border-dashed border-gray-300 flex-1 py-0.5 truncate min-h-[16px]">
                          {voucherForm.amount_text || "—"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="font-bold text-gray-500 shrink-0">وذلك مقابل /</span>
                        <span className="font-semibold text-gray-900 border-b border-dashed border-gray-300 flex-1 py-0.5 truncate min-h-[16px]">
                          {voucherForm.payment_against || "—"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="font-bold text-gray-500 shrink-0">طريقة الدفع /</span>
                        <span className="font-bold text-gray-900 border-b border-dashed border-gray-300 flex-1 py-0.5 min-h-[16px]">
                          {voucherForm.payment_method === "cash" ? "نقداً" : voucherForm.payment_method === "card" ? "شبكة" : voucherForm.payment_method === "bank" ? "تحويل" : "شيك"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Signatures & Notes row */}
                  <div className="grid grid-cols-4 gap-1.5 mt-3 text-[8px] text-center">
                    <div className="border border-gray-200 bg-gray-50/30 rounded p-1.5 flex flex-col justify-between min-h-[40px]">
                      <span className="font-bold text-gray-500">ملاحظات</span>
                      <span className="text-gray-400">................</span>
                    </div>
                    <div className="border border-gray-200 bg-gray-50/30 rounded p-1.5 flex flex-col justify-between min-h-[40px]">
                      <span className="font-bold text-gray-500">المحاسب</span>
                      <span className="text-gray-400">التوقيع</span>
                    </div>
                    <div className="border border-gray-200 bg-gray-50/30 rounded p-1.5 flex flex-col justify-between min-h-[40px]">
                      <span className="font-bold text-gray-500">المستلم</span>
                      <span className="text-gray-400">التوقيع</span>
                    </div>
                    <div className="border border-amber-200 bg-amber-50/30 rounded p-1.5 flex flex-col justify-between min-h-[40px]">
                      <span className="font-bold text-amber-800">المبلغ كتابةً</span>
                      <span className="text-amber-900 leading-tight font-semibold truncate">{voucherForm.amount_text || "—"}</span>
                    </div>
                  </div>

                  {/* Wave footer */}
                  <div className="mt-3 pt-1 border-t flex justify-between items-center text-[8px] font-bold" style={{ color: voucherConfig.accent_color }}>
                    <span>{voucherConfig.bottom_text}</span>
                    <span className="text-gray-400">صنع بثقة</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-dashed mt-4 space-y-2">
                <Button
                  onClick={() => createVoucherMutation.mutate(voucherForm)}
                  disabled={!voucherForm.party_id || !voucherForm.amount || createVoucherMutation.isPending}
                  className="w-full text-white font-extrabold h-11 shadow"
                  style={{ backgroundColor: voucherConfig.accent_color }}
                >
                  حفظ وتوليد السند وطباعته
                </Button>
                <Button variant="outline" onClick={() => setShowNewVoucherDlg(false)} className="w-full h-10">إلغاء</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────── */}
      {/* DIALOG: VIEW & PRINT SINGLE VOUCHER (عرض وطباعة السند المختار) */}
      {/* ──────────────────────────────────────────────────────── */}
      <Dialog open={!!viewVoucher} onOpenChange={(v) => { if (!v) setViewVoucher(null); }}>
        <DialogContent className="max-w-2xl p-6" dir="rtl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex justify-between items-center text-gray-900">
              <span className="font-black text-lg">
                معاينة السند التفصيلي — {viewVoucher?.type === "receipt" ? "سند قبض" : "سند صرف"} #{viewVoucher?.voucher_number}
              </span>
              <Button onClick={() => handlePrint("voucher-print-area")} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs">
                <Printer className="w-4 h-4" /> طباعة السند (A4)
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* High Fidelity A4 scalable representation of the Voucher */}
          <div className="py-6 flex justify-center">
            <div id="voucher-print-area" className="w-full border-2 rounded-2xl p-8 bg-white shadow-sm relative overflow-hidden" style={{ borderColor: viewVoucher?.accent_color }}>
              {/* Top Wave Bar */}
              <div className="absolute top-0 right-0 left-0 h-2" style={{ backgroundColor: viewVoucher?.accent_color }} />
              
              {/* Header block */}
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-black" style={{ color: viewVoucher?.accent_color }}>{viewVoucher?.header_title}</h2>
                  <p className="text-sm font-bold text-gray-500 leading-none">{viewVoucher?.header_subtitle}</p>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black tracking-widest" style={{ color: viewVoucher?.accent_color }}>
                    {viewVoucher?.type === "receipt" ? "سند قـبـض" : "سند صـرف"}
                  </span>
                  <div className="w-20 h-1 mt-1 rounded-full" style={{ backgroundColor: viewVoucher?.accent_color }} />
                </div>

                <div className="w-20 h-20 rounded-full border-2 overflow-hidden flex items-center justify-center bg-white shadow-sm" style={{ borderColor: viewVoucher?.accent_color }}>
                  <img src={viewVoucher?.logo_url} className="w-16 h-16 object-contain" onError={(e)=>{e.currentTarget.src='https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=100'}} />
                </div>
              </div>

              {/* Number and Date box */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="border rounded-lg px-4 py-2 flex justify-between bg-slate-50" style={{ borderColor: viewVoucher?.accent_color }}>
                  <span className="font-bold text-gray-600">رقم السند :</span>
                  <span className="font-black font-mono text-gray-900">{viewVoucher?.voucher_number}</span>
                </div>
                <div className="border-b border-dashed border-gray-300 py-2 flex items-center justify-end">
                  <span className="text-gray-500 font-bold ml-2">التاريخ :</span>
                  <span className="font-black font-mono text-gray-900">{viewVoucher?.created_at?.slice(0, 10)}</span>
                </div>
              </div>

              {/* Main amount & details section */}
              <div className="border rounded-2xl p-6 bg-white space-y-4 mb-6" style={{ borderColor: viewVoucher?.accent_color + "50" }}>
                {/* Amount block */}
                <div className="flex rounded-lg overflow-hidden border-2 max-w-[200px]" style={{ borderColor: viewVoucher?.accent_color }}>
                  <div className="text-white font-black px-4 py-1.5 text-sm flex items-center justify-center" style={{ backgroundColor: viewVoucher?.accent_color }}>
                    المبلغ
                  </div>
                  <div className="bg-amber-50/20 text-gray-900 font-extrabold px-4 py-1.5 font-mono text-sm flex-1 flex items-center justify-center">
                    {fmt(viewVoucher?.amount)} {viewVoucher?.currency}
                  </div>
                </div>

                {/* Dotted lines details exactly like Image 1 */}
                <div className="space-y-3.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-600 shrink-0">استلمنا من السيد /</span>
                    <span className="font-extrabold text-gray-900 border-b border-dashed border-gray-400 flex-1 py-0.5 truncate">
                      {viewVoucher?.received_from || "—"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-600 shrink-0">مبلغ وقدره /</span>
                    <span className="font-semibold text-gray-900 border-b border-dashed border-gray-400 flex-1 py-0.5 truncate">
                      {viewVoucher?.amount_text || "—"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-600 shrink-0">وذلك مقابل /</span>
                    <span className="font-semibold text-gray-900 border-b border-dashed border-gray-400 flex-1 py-0.5 truncate">
                      {viewVoucher?.payment_against || "—"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-600 shrink-0">طريقة الدفع /</span>
                    <span className="font-bold text-gray-900 border-b border-dashed border-gray-400 flex-1 py-0.5">
                      {viewVoucher?.payment_method === "cash" ? "نقداً" : viewVoucher?.payment_method === "card" ? "شبكة" : viewVoucher?.payment_method === "bank" ? "تحويل بنكي" : "شيك مقبول الدفع"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lower footer grid block */}
              <div className="grid grid-cols-4 gap-4 text-xs text-center">
                <div className="border border-gray-200 bg-gray-50/50 rounded-xl p-3 flex flex-col justify-between min-h-[60px]">
                  <span className="font-bold text-gray-600">ملاحظات</span>
                  <span className="text-gray-400 truncate">{viewVoucher?.notes || "................"}</span>
                </div>
                <div className="border border-gray-200 bg-gray-50/50 rounded-xl p-3 flex flex-col justify-between min-h-[60px]">
                  <span className="font-bold text-gray-600">المحاسب</span>
                  <span className="text-gray-400 font-mono text-[10px]">التوقيع : .............</span>
                </div>
                <div className="border border-gray-200 bg-gray-50/50 rounded-xl p-3 flex flex-col justify-between min-h-[60px]">
                  <span className="font-bold text-gray-600">المستلم</span>
                  <span className="text-gray-400 font-mono text-[10px]">التوقيع : .............</span>
                </div>
                <div className="border border-amber-200 bg-amber-50/30 rounded-xl p-3 flex flex-col justify-between min-h-[60px]">
                  <span className="font-bold text-amber-800">المبلغ كتابةً</span>
                  <span className="text-amber-900 leading-tight font-extrabold text-[11px]">{viewVoucher?.amount_text || "—"}</span>
                </div>
              </div>

              {/* Slogan Banner footer wave line */}
              <div className="mt-8 pt-4 border-t border-red-100 flex justify-between items-center text-xs font-bold" style={{ color: viewVoucher?.accent_color }}>
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{viewVoucher?.bottom_text}</span>
                </div>
                <span className="text-gray-400 font-mono">الرقم المالي المعتمد</span>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setViewVoucher(null)}>إغلاق المعاينة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────── */}
      {/* DIALOG: ADD/EDIT SAFE BOX (إضافة أو تعديل صندوق مالي) */}
      {/* ──────────────────────────────────────────────────────── */}
      <Dialog open={showSafeDlg} onOpenChange={setShowSafeDlg}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Wallet className="w-5 h-5 text-red-600" />
              {editingSafe ? "تعديل بيانات الصندوق المالي" : "إضافة صندوق مالي جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-gray-700">اسم الصندوق المالي *</label>
              <Input
                value={safeForm.name}
                onChange={e => setSafeForm(f => ({ ...f, name: e.target.value }))}
                placeholder="مثال: خزينة المبيعات اليومية، صندوق النثريات"
                className="mt-1 bg-white"
                disabled={editingSafe?.name === "الصندوق الرئيسي"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700">الرصيد الافتتاحي / الحالي *</label>
                <Input
                  type="number"
                  value={safeForm.balance}
                  onChange={e => setSafeForm(f => ({ ...f, balance: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">العملة الافتراضية *</label>
                <div className="flex gap-1.5 mt-1">
                  <Select
                    value={safeForm.currency}
                    onValueChange={val => setSafeForm(f => ({ ...f, currency: val }))}
                  >
                    <SelectTrigger className="w-24 bg-white text-xs">
                      <SelectValue placeholder="اختر" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="ريال">ريال</SelectItem>
                      <SelectItem value="ر.س">ر.س</SelectItem>
                      <SelectItem value="دولار">دولار ($)</SelectItem>
                      <SelectItem value="دينار">دينار</SelectItem>
                      <SelectItem value="ريال يمني">ريال يمني</SelectItem>
                      <SelectItem value="EUR">يورو (€)</SelectItem>
                      <SelectItem value="AED">درهم إماراتي</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={safeForm.currency}
                    onChange={e => setSafeForm(f => ({ ...f, currency: e.target.value }))}
                    placeholder="أو اكتب العملة..."
                    className="bg-white flex-1 text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700">ملاحظات الصندوق (اختياري)</label>
              <Input
                value={safeForm.notes}
                onChange={e => setSafeForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="أي ملاحظات حول استخدامات الصندوق"
                className="mt-1 bg-white"
              />
            </div>

            {editingSafe && (
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="safe-active-check"
                  checked={safeForm.active}
                  onCheckedChange={(val: boolean) => setSafeForm(f => ({ ...f, active: val }))}
                />
                <label htmlFor="safe-active-check" className="text-sm font-bold text-gray-700 cursor-pointer">
                  صندوق مالي نشط ويقبل المعاملات
                </label>
              </div>
            )}
          </div>
          <DialogFooter className="pt-4 gap-2">
            <Button variant="outline" onClick={() => setShowSafeDlg(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                if (editingSafe) {
                  editSafeMutation.mutate({ id: editingSafe.id, ...safeForm });
                } else {
                  addSafeMutation.mutate(safeForm);
                }
              }}
              disabled={!safeForm.name || addSafeMutation.isPending || editSafeMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {editingSafe ? "تحديث الصندوق" : "حفظ الصندوق"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────── */}
      {/* DIALOG: GLOBAL DOCUMENT PRINT & BRANDING SETTINGS (التحكم في تصميم ومحتوى الكشوفات والسندات) */}
      {/* ──────────────────────────────────────────────────────── */}
      <Dialog open={showDocSettingsDlg} onOpenChange={setShowDocSettingsDlg}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <Palette className="w-5 h-5 text-amber-500" />
              التحكم الموحد في تصميم ومحتوى السندات والكشوفات والشعار
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2 text-xs">
            <p className="text-muted-foreground">
              يتم هنا ضبط اسم الشعار والمؤسسة والنصوص المعتمدة مرة واحدة ليتم تطبيقها تلقائياً على سائر الكشوفات والسندات في النظام وفي بيئة OmniSystem Pro.
            </p>

            {/* General Header & Logo */}
            <div className="border rounded-xl p-4 bg-slate-50/50 space-y-3">
              <h4 className="font-extrabold text-slate-900 border-b pb-2 flex items-center gap-2 text-sm">
                <Sliders className="w-4 h-4 text-red-600" /> الهوية البصرية الرئيسية والترويسة
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700">اسم المؤسسة / الشركة (الهيدر الرئيسي) *</label>
                  <Input
                    value={docForm.companyName}
                    onChange={(e) => setDocForm((f) => ({ ...f, companyName: e.target.value }))}
                    className="mt-1 bg-white font-bold"
                    placeholder="مثال: مخابز الشام للخبز العربي"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700">العنوان الفرعي / الوصف بالإنجليزية *</label>
                  <Input
                    value={docForm.companySubtitle}
                    onChange={(e) => setDocForm((f) => ({ ...f, companySubtitle: e.target.value }))}
                    className="mt-1 bg-white"
                    placeholder="مثال: Maamil Al Sham"
                  />
                </div>
              </div>

              {/* Logo Upload / URL */}
              <div>
                <label className="font-bold text-gray-700">شعار المؤسسة (رابط الصورة أو رفع ملف)</label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-14 h-14 border rounded-lg overflow-hidden flex items-center justify-center bg-white shrink-0 shadow-sm">
                    {docForm.logoUrl ? (
                      <img src={docForm.logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-slate-400">لا شعار</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={docForm.logoUrl}
                      onChange={(e) => setDocForm((f) => ({ ...f, logoUrl: e.target.value }))}
                      className="bg-white text-xs font-mono"
                      placeholder="/omnisystem-logo.png أو رابط صورة"
                    />
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer bg-white border hover:bg-slate-100 text-slate-700 px-3 py-1 rounded-md font-bold flex items-center gap-1.5 text-xs shadow-sm">
                        <Upload className="w-3.5 h-3.5 text-amber-500" />
                        ادراج شعار من الملفات
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                if (event.target?.result) {
                                  setDocForm((f) => ({ ...f, logoUrl: event.target!.result as string }));
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      <span className="text-[11px] text-muted-foreground">يدعم PNG, JPG, WebP</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700">اللون المميز (Accent Color) للسندات والتقارير</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="color"
                    value={docForm.accentColor || "#ef4444"}
                    onChange={(e) => setDocForm((f) => ({ ...f, accentColor: e.target.value }))}
                    className="w-10 h-9 p-0.5 rounded border cursor-pointer bg-white"
                  />
                  <Input
                    value={docForm.accentColor}
                    onChange={(e) => setDocForm((f) => ({ ...f, accentColor: e.target.value }))}
                    className="bg-white font-mono w-32"
                    placeholder="#ef4444"
                  />
                  <span className="text-xs text-muted-foreground">يظهر في الترويسات والحدود والإجماليات</span>
                </div>
              </div>
            </div>

            {/* Vouchers Print Settings */}
            <div className="border rounded-xl p-4 bg-slate-50/50 space-y-3">
              <h4 className="font-extrabold text-slate-900 border-b pb-2 flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-blue-600" /> إعدادات سندات القبض والصرف
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700">عنوان سند القبض</label>
                  <Input
                    value={docForm.voucherReceiptTitle}
                    onChange={(e) => setDocForm((f) => ({ ...f, voucherReceiptTitle: e.target.value }))}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700">عنوان سند الصرف</label>
                  <Input
                    value={docForm.voucherPaymentTitle}
                    onChange={(e) => setDocForm((f) => ({ ...f, voucherPaymentTitle: e.target.value }))}
                    className="mt-1 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-gray-700">شعار / نص الترويسة السفلية للسند (Footer Slogan)</label>
                <Input
                  value={docForm.voucherFooterText}
                  onChange={(e) => setDocForm((f) => ({ ...f, voucherFooterText: e.target.value }))}
                  className="mt-1 bg-white font-bold"
                  placeholder="جودة الخبز ... سر ثقة عملائنا"
                />
              </div>
            </div>

            {/* Account Statements Settings */}
            <div className="border rounded-xl p-4 bg-slate-50/50 space-y-3">
              <h4 className="font-extrabold text-slate-900 border-b pb-2 flex items-center gap-2 text-sm">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> إعدادات كشوف الحسابات المعتمدة
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700">ترويسة كشف حساب العملاء</label>
                  <Input
                    value={docForm.customerHeaderText}
                    onChange={(e) => setDocForm((f) => ({ ...f, customerHeaderText: e.target.value }))}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700">تذييل كشف حساب العملاء</label>
                  <Input
                    value={docForm.customerFooterText}
                    onChange={(e) => setDocForm((f) => ({ ...f, customerFooterText: e.target.value }))}
                    className="mt-1 bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700">ترويسة كشف حساب الموظفين</label>
                  <Input
                    value={docForm.employeeHeaderText}
                    onChange={(e) => setDocForm((f) => ({ ...f, employeeHeaderText: e.target.value }))}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700">تذييل كشف حساب الموظفين</label>
                  <Input
                    value={docForm.employeeFooterText}
                    onChange={(e) => setDocForm((f) => ({ ...f, employeeFooterText: e.target.value }))}
                    className="mt-1 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 gap-2">
            <Button variant="outline" onClick={() => setShowDocSettingsDlg(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => saveDocSettingsMutation.mutate(docForm)}
              disabled={saveDocSettingsMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-extrabold gap-2 px-6"
            >
              <CheckCircle className="w-4 h-4" />
              {saveDocSettingsMutation.isPending ? "جاري الحفظ..." : "حفظ واعتماد في كامل النظام"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

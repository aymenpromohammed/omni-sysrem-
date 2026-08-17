import { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useGetSalesReport, useGetPrintersList } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Printer, Download, TrendingUp, ShoppingBag, Users, Tag } from "lucide-react";

const COLORS = ["#1e3a5f", "#3b82f6", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444", "#06b6d4"];

type Tab = "sales" | "cashier" | "product" | "category" | "payment" | "purchases" | "inventory" | "expenses" | "shifts" | "tax" | "waste";

const TAB_LABELS: Record<Tab, string> = {
  sales: "المبيعات اليومية",
  cashier: "بالكاشير",
  product: "بالمنتج",
  category: "بالفئة",
  payment: "بطريقة الدفع",
  purchases: "المشتريات والموردون",
  inventory: "تقييم المخزون",
  expenses: "المصروفات التشغيلية",
  shifts: "المناوبات وتصفيات الصندوق",
  tax: "الإقرار الضريبي (VAT)",
  waste: "الهدر والتالف",
};

function fetchWithAuth<T>(url: string): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

function fmt(n: number) { return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function Reports() {
  const now = new Date();
  const [startDate, setStartDate] = useState(now.toISOString().slice(0, 7) + "-01");
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [groupBy, setGroupBy] = useState<"day" | "month" | "year">("day");
  const [tab, setTab] = useState<Tab>("sales");
  const [showPrintDlg, setShowPrintDlg] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState("__window__");
  const printRef = useRef<HTMLDivElement>(null);

  const dateParams = `?startDate=${startDate}&endDate=${endDate}`;
  const { data: salesRows = [], isLoading: isSalesLoading } = useGetSalesReport({ startDate, endDate, groupBy });
  const { data: cashierRows = [] } = useQuery<any[]>({ queryKey: ["reports-cashier", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/by-cashier${dateParams}`) });
  const { data: productRows = [] } = useQuery<any[]>({ queryKey: ["reports-product", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/by-product${dateParams}&limit=30`) });
  const { data: categoryRows = [] } = useQuery<any[]>({ queryKey: ["reports-category", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/by-category${dateParams}`) });
  const { data: paymentRows = [] } = useQuery<any[]>({ queryKey: ["reports-payment", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/by-payment${dateParams}`) });
  
  const { data: purchasesData } = useQuery<any>({ queryKey: ["reports-purchases", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/purchases${dateParams}`) });
  const { data: inventoryData } = useQuery<any>({ queryKey: ["reports-inventory"], queryFn: () => fetchWithAuth(`/api/reports/inventory`) });
  const { data: expensesData } = useQuery<any>({ queryKey: ["reports-expenses", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/expenses${dateParams}`) });
  const { data: shiftsData } = useQuery<any>({ queryKey: ["reports-shifts", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/shifts${dateParams}`) });
  const { data: taxData } = useQuery<any>({ queryKey: ["reports-tax", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/tax${dateParams}`) });
  const { data: wasteData } = useQuery<any>({ queryKey: ["reports-waste", startDate, endDate], queryFn: () => fetchWithAuth(`/api/reports/waste${dateParams}`) });

  const { data: printers = [] } = useGetPrintersList();

  const totalSales = salesRows.reduce((s, r) => s + r.total, 0);
  const totalOrders = salesRows.reduce((s, r) => s + r.orders, 0);
  const totalDiscount = salesRows.reduce((s, r) => s + ((r as any).discount ?? 0), 0);
  const totalTax = salesRows.reduce((s, r) => s + ((r as any).tax ?? 0), 0);

  // Category totals
  const categoryTotalOrders = categoryRows.reduce((s, r: any) => s + (r.orderCount || 0), 0);
  const categoryTotalQty = categoryRows.reduce((s, r: any) => s + (r.totalQty || 0), 0);
  const categoryTotalRevenue = categoryRows.reduce((s, r: any) => s + (r.totalRevenue || 0), 0);

  // Cashier totals
  const cashierTotalOrders = cashierRows.reduce((s, r: any) => s + (r.orders || 0), 0);
  const cashierGrossTotal = cashierRows.reduce((s, r: any) => s + (r.grossTotal ?? r.total), 0);
  const cashierTotalReturns = cashierRows.reduce((s, r: any) => s + (r.returnsTotal || 0), 0);
  const cashierNetTotal = cashierRows.reduce((s, r: any) => s + (r.total || 0), 0);
  const cashierTotalDiscount = cashierRows.reduce((s, r: any) => s + (r.discount || 0), 0);
  const cashierTotalTax = cashierRows.reduce((s, r: any) => s + (r.tax || 0), 0);

  // Payment totals
  const paymentTotalOrders = paymentRows.reduce((s, r: any) => s + (r.orders || 0), 0);
  const paymentTotal = paymentRows.reduce((s, r: any) => s + (r.total || 0), 0);

  // Product totals
  const productTotalQty = productRows.reduce((s, r: any) => s + (r.totalQty || 0), 0);
  const productTotalOrders = productRows.reduce((s, r: any) => s + (r.orderCount || 0), 0);
  const productTotalRevenue = productRows.reduce((s, r: any) => s + (r.totalRevenue || 0), 0);
  const productTotalProfit = productRows.reduce((s, r: any) => s + (r.totalProfit || 0), 0);

  const handlePrint = () => {
    if (selectedPrinter === "__window__") {
      window.print();
      setShowPrintDlg(false);
    } else {
      window.print();
      setShowPrintDlg(false);
    }
  };

  const paymentLabel = (m: string) => m === "cash" ? "نقداً" : m === "card" ? "شبكة" : m === "mixed" ? "مختلط" : m;

  return (
    <AdminLayout>
      {/* Hidden print area */}
      <div className="hidden-print-container" ref={printRef}>
        <div id="report-print-area" style={{ fontFamily: "Arial, sans-serif", direction: "rtl", padding: "16px", maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>تقرير مفصّل — {TAB_LABELS[tab]}</h2>
          <p style={{ textAlign: "center", fontSize: "12px", color: "#666", marginBottom: "16px" }}>من {startDate} إلى {endDate}</p>
          {tab === "sales" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead><tr style={{ background: "#f1f5f9" }}>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>الفترة</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الفواتير</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الإجمالي</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الضريبة</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الخصم</th>
              </tr></thead>
              <tbody>
                {salesRows.map((r, i) => <tr key={i}>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{r.period}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{r.orders}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(r.total)}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt((r as any).tax ?? 0)}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt((r as any).discount ?? 0)}</td>
                </tr>)}
              </tbody>
              <tfoot><tr style={{ background: "#f8fafc", fontWeight: "bold" }}>
                <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>الإجمالي</td>
                <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>{totalOrders}</td>
                <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(totalSales)}</td>
                <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(totalTax)}</td>
                <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(totalDiscount)}</td>
              </tr></tfoot>
            </table>
          )}
          {tab === "cashier" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead><tr style={{ background: "#f1f5f9" }}>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>الكاشير</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الفواتير</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الإجمالي</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الخصم</th>
              </tr></thead>
              <tbody>
                {cashierRows.map((r: any, i) => <tr key={i}>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{r.userName}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{r.orders}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(r.total)}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left" }}>{fmt(r.discount)}</td>
                </tr>)}
              </tbody>
              {cashierRows.length > 0 && (
                <tfoot><tr style={{ background: "#f8fafc", fontWeight: "bold" }}>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>الإجمالي</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>{cashierTotalOrders}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(cashierNetTotal)}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(cashierTotalDiscount)}</td>
                </tr></tfoot>
              )}
            </table>
          )}
          {tab === "product" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead><tr style={{ background: "#f1f5f9" }}>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>المنتج</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>الفئة</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الكمية</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الإيراد</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الربح</th>
              </tr></thead>
              <tbody>
                {productRows.map((r: any, i) => <tr key={i}>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{r.productName}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{r.categoryName ?? "-"}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{r.totalQty}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(r.totalRevenue)}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", color: "#16a34a" }}>{fmt(r.totalProfit)}</td>
                </tr>)}
              </tbody>
              {productRows.length > 0 && (
                <tfoot><tr style={{ background: "#f8fafc", fontWeight: "bold" }}>
                  <td colSpan={2} style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>الإجمالي</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>{productTotalQty}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(productTotalRevenue)}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(productTotalProfit)}</td>
                </tr></tfoot>
              )}
            </table>
          )}
          {tab === "category" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead><tr style={{ background: "#f1f5f9" }}>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>الفئة</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الفواتير</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الكمية</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الإيراد</th>
              </tr></thead>
              <tbody>
                {categoryRows.map((r: any, i) => <tr key={i}>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{r.categoryName}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{r.orderCount}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{r.totalQty}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(r.totalRevenue)}</td>
                </tr>)}
              </tbody>
              {categoryRows.length > 0 && (
                <tfoot><tr style={{ background: "#f8fafc", fontWeight: "bold" }}>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>الإجمالي</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>{categoryTotalOrders}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>{categoryTotalQty}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(categoryTotalRevenue)}</td>
                </tr></tfoot>
              )}
            </table>
          )}
          {tab === "payment" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead><tr style={{ background: "#f1f5f9" }}>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>طريقة الدفع</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>الفواتير</th>
                <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>الإجمالي</th>
              </tr></thead>
              <tbody>
                {paymentRows.map((r: any, i) => <tr key={i}>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px" }}>{paymentLabel(r.paymentMethod)}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "center" }}>{r.orders}</td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "5px 8px", textAlign: "left", fontWeight: "bold" }}>{fmt(r.total)}</td>
                </tr>)}
              </tbody>
              {paymentRows.length > 0 && (
                <tfoot><tr style={{ background: "#f8fafc", fontWeight: "bold" }}>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>الإجمالي</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>{paymentTotalOrders}</td>
                  <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>{fmt(paymentTotal)}</td>
                </tr></tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-2xl font-bold">تقارير تفصيلية</h1>
          <div className="flex gap-2 flex-wrap items-center">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36 text-sm" />
            <span className="text-muted-foreground text-sm">إلى</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36 text-sm" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPrintDlg(true)}>
              <Printer className="w-4 h-4" />
              طباعة التقرير
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50" 
              onClick={() => {
                let headers: string[] = [];
                let rows: (string | number)[][] = [];

                if (tab === "sales") {
                  headers = ["الفترة", "عدد الفواتير", "الإجمالي", "الضريبة", "الخصم"];
                  rows = salesRows.map(r => [r.period, r.orders, r.total, (r as any).tax ?? 0, (r as any).discount ?? 0]);
                } else if (tab === "cashier") {
                  headers = ["اسم الكاشير", "عدد الفواتير", "إجمالي المبيعات"];
                  rows = cashierRows.map(r => [r.cashierName || r.username || "غير محدد", r.orders, r.total]);
                } else if (tab === "product") {
                  headers = ["اسم المنتج", "الكمية المباعة", "الإجمالي"];
                  rows = productRows.map(r => [r.productName || r.name, r.quantity || r.count, r.total]);
                } else if (tab === "category") {
                  headers = ["اسم الفئة", "عدد الاصناف المباعة", "الإجمالي"];
                  rows = categoryRows.map(r => [r.categoryName || r.name, r.itemCount || r.count, r.total]);
                } else if (tab === "payment") {
                  headers = ["طريقة الدفع", "عدد العمليات", "الإجمالي"];
                  rows = paymentRows.map(r => [paymentLabel(r.method), r.count, r.total]);
                } else if (tab === "purchases") {
                  headers = ["رقم الفاتورة", "المورد", "التاريخ", "الإجمالي", "المدفوع", "المتبقي"];
                  rows = (purchasesData?.rows || []).map((r: any) => [r.invoiceNumber, r.supplierName, r.invoiceDate, r.total, r.paidAmount, r.remainingAmount]);
                } else if (tab === "inventory") {
                  headers = ["اسم الصنف", "الفئة", "الرصيد الحالي", "التكلفة الفردية", "إجمالي التقييم"];
                  rows = (inventoryData?.products || []).map((p: any) => [p.name, p.categoryName || "-", p.stock, p.cost, p.totalCostValuation]);
                } else if (tab === "expenses") {
                  headers = ["تصنيف المصروف", "عدد السجلات", "إجمالي المبلغ"];
                  rows = (expensesData?.categories || []).map((c: any) => [c.category, c.count, c.totalAmount]);
                } else if (tab === "shifts") {
                  headers = ["اسم الكاشير", "افتتاح الصندوق", "المبيعات النقدية", "المبيعات الشبكة", "المتوقع", "الفعلي", "الفارق"];
                  rows = (shiftsData?.shifts || []).map((s: any) => [s.cashierName || "-", s.opening_balance, s.cash_sales, s.card_sales, s.expected_cash, s.actual_cash, s.variance]);
                } else if (tab === "tax") {
                  headers = ["بيان الإقرار الضريبي", "القيمة الإجمالية"];
                  rows = [
                    ["المبيعات الخاضعة للضريبة", taxData?.taxableSales || 0],
                    ["ضريبة المخرجات (15%)", taxData?.outputTax || 0],
                    ["المشتريات الخاضعة للضريبة", taxData?.taxablePurchases || 0],
                    ["ضريبة المدخلات (15%)", taxData?.inputTax || 0],
                    ["صافي الضريبة المستحقة للسداد", taxData?.netTaxPayable || 0]
                  ];
                } else if (tab === "waste") {
                  headers = ["اسم المنتج", "الكمية التالفة", "التكلفة الإجمالية", "السبب", "التاريخ"];
                  rows = (wasteData?.records || []).map((w: any) => [w.productName, w.quantity, w.cost, w.reason, w.waste_date]);
                }

                const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `report-${tab}-${startDate}-to-${endDate}.csv`);
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                  URL.revokeObjectURL(url);
                  document.body.removeChild(link);
                }, 1000);
              }}
            >
              <Download className="w-4 h-4" />
              تصدير CSV
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg"><TrendingUp className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">إجمالي المبيعات</p><p className="text-lg font-bold text-amber-600">{fmt(totalSales)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg"><ShoppingBag className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">عدد الفواتير</p><p className="text-lg font-bold">{totalOrders}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-500/10 text-green-600 rounded-lg"><Tag className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">إجمالي الضريبة</p><p className="text-lg font-bold text-green-600">{fmt(totalTax)}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Tag className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">إجمالي الخصم</p><p className="text-lg font-bold text-red-500">{fmt(totalDiscount)}</p></div>
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border flex-wrap">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Tab: Sales */}
        {tab === "sales" && (
          <div className="space-y-4">
            <div className="flex gap-1 border rounded-lg overflow-hidden w-fit">
              {(["day","month","year"] as const).map(g => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${groupBy === g ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                  {g === "day" ? "يومي" : g === "month" ? "شهري" : "سنوي"}
                </button>
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">مبيعات حسب الفترة</CardTitle></CardHeader>
              <CardContent className="h-64">
                {isSalesLoading ? <div className="flex items-center justify-center h-full text-muted-foreground text-sm">جاري التحميل...</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesRows} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [fmt(v), "المبيعات"]} />
                      <Bar dataKey="total" name="المبيعات" fill="#1e3a5f" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">تفصيل البيانات</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">الفترة</th>
                      <th className="text-center p-3 font-semibold">الفواتير</th>
                      <th className="text-left p-3 font-semibold">الإجمالي</th>
                      <th className="text-left p-3 font-semibold">الضريبة</th>
                      <th className="text-left p-3 font-semibold">الخصم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {salesRows.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{r.period}</td>
                        <td className="p-3 text-center">{r.orders}</td>
                        <td className="p-3 text-left font-bold text-amber-600">{fmt(r.total)}</td>
                        <td className="p-3 text-left text-green-600">{fmt((r as any).tax ?? 0)}</td>
                        <td className="p-3 text-left text-red-500">{fmt((r as any).discount ?? 0)}</td>
                      </tr>
                    ))}
                    {salesRows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">لا توجد بيانات</td></tr>}
                  </tbody>
                  {salesRows.length > 0 && (
                    <tfoot className="bg-muted/50 border-t font-bold">
                      <tr>
                        <td className="p-3">الإجمالي</td>
                        <td className="p-3 text-center">{totalOrders}</td>
                        <td className="p-3 text-left text-amber-600">{fmt(totalSales)}</td>
                        <td className="p-3 text-left text-green-600">{fmt(totalTax)}</td>
                        <td className="p-3 text-left text-red-500">{fmt(totalDiscount)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: By Cashier */}
        {tab === "cashier" && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">مبيعات حسب الكاشير</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashierRows} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="userName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [fmt(v), "المبيعات"]} />
                    <Bar dataKey="total" name="المبيعات" fill="#1e3a5f" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">المستخدم / الكاشير</th>
                      <th className="text-center p-3 font-semibold">الفواتير</th>
                      <th className="text-left p-3 font-semibold">إجمالي المبيعات</th>
                      <th className="text-left p-3 font-semibold text-rose-600">المرتجعات</th>
                      <th className="text-left p-3 font-semibold text-emerald-600">صافي المبيعات</th>
                      <th className="text-left p-3 font-semibold">الخصم الممنوح</th>
                      <th className="text-left p-3 font-semibold">الضريبة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cashierRows.map((r: any, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{r.userName?.charAt(0)}</div>
                          <div>
                            <div>{r.userName}</div>
                            {r.userRole && <div className="text-[10px] text-muted-foreground font-normal">{r.userRole === 'admin' ? 'مدير نظام' : r.userRole === 'accountant' ? 'محاسب' : 'كاشير'}</div>}
                          </div>
                        </td>
                        <td className="p-3 text-center">{r.orders}</td>
                        <td className="p-3 text-left font-semibold text-amber-600">{fmt(r.grossTotal ?? r.total)}</td>
                        <td className="p-3 text-left font-semibold text-rose-600">
                          {r.returnsTotal > 0 ? `-${fmt(r.returnsTotal)}` : "0"}
                        </td>
                        <td className="p-3 text-left font-bold text-emerald-600">{fmt(r.total)}</td>
                        <td className="p-3 text-left text-red-500">{fmt(r.discount)}</td>
                        <td className="p-3 text-left text-green-600">{fmt(r.tax)}</td>
                      </tr>
                    ))}
                    {cashierRows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">لا توجد بيانات</td></tr>}
                  </tbody>
                  {cashierRows.length > 0 && (
                    <tfoot className="bg-muted/50 border-t font-bold">
                      <tr>
                        <td className="p-3">الإجمالي</td>
                        <td className="p-3 text-center">{cashierTotalOrders}</td>
                        <td className="p-3 text-left text-amber-600">{fmt(cashierGrossTotal)}</td>
                        <td className="p-3 text-left text-rose-600">{cashierTotalReturns > 0 ? `-${fmt(cashierTotalReturns)}` : "0"}</td>
                        <td className="p-3 text-left text-emerald-600">{fmt(cashierNetTotal)}</td>
                        <td className="p-3 text-left text-red-500">{fmt(cashierTotalDiscount)}</td>
                        <td className="p-3 text-left text-green-600">{fmt(cashierTotalTax)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: By Product */}
        {tab === "product" && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">أكثر 10 منتجات مبيعاً (بالكمية)</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productRows.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="productName" width={115} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [v, "الكمية"]} />
                    <Bar dataKey="totalQty" name="الكمية" fill="#1e3a5f" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-center p-3 font-semibold w-10">#</th>
                      <th className="text-right p-3 font-semibold">المنتج</th>
                      <th className="text-right p-3 font-semibold">الفئة</th>
                      <th className="text-center p-3 font-semibold">الكمية</th>
                      <th className="text-center p-3 font-semibold">الفواتير</th>
                      <th className="text-left p-3 font-semibold">الإيراد</th>
                      <th className="text-left p-3 font-semibold">الربح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {productRows.map((r: any, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 text-center text-muted-foreground font-mono text-xs">{i + 1}</td>
                        <td className="p-3 font-semibold">{r.productName}</td>
                        <td className="p-3 text-muted-foreground">{r.categoryName ?? "-"}</td>
                        <td className="p-3 text-center font-bold">{r.totalQty}</td>
                        <td className="p-3 text-center">{r.orderCount}</td>
                        <td className="p-3 text-left font-bold text-amber-600">{fmt(r.totalRevenue)}</td>
                        <td className="p-3 text-left font-bold text-green-600">{fmt(r.totalProfit)}</td>
                      </tr>
                    ))}
                    {productRows.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">لا توجد بيانات</td></tr>}
                  </tbody>
                  {productRows.length > 0 && (
                    <tfoot className="bg-muted/50 border-t font-bold">
                      <tr>
                        <td colSpan={3} className="p-3">الإجمالي</td>
                        <td className="p-3 text-center">{productTotalQty}</td>
                        <td className="p-3 text-center">{productTotalOrders}</td>
                        <td className="p-3 text-left text-amber-600">{fmt(productTotalRevenue)}</td>
                        <td className="p-3 text-left text-green-600">{fmt(productTotalProfit)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: By Category */}
        {tab === "category" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">المبيعات بالفئة</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryRows} dataKey="totalRevenue" nameKey="categoryName" cx="50%" cy="50%" outerRadius={90} label={(entry: any) => `${entry.categoryName} (${(entry.percent * 100).toFixed(0)}%)`}>
                        {categoryRows.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [fmt(v), "الإيراد"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">الكمية بالفئة</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryRows} margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="categoryName" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="totalQty" name="الكمية" fill="#f59e0b" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">الفئة</th>
                      <th className="text-center p-3 font-semibold">الفواتير</th>
                      <th className="text-center p-3 font-semibold">إجمالي الكمية</th>
                      <th className="text-left p-3 font-semibold">الإيراد</th>
                      <th className="text-left p-3 font-semibold">النسبة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categoryRows.map((r: any, i) => {
                      const totalRev = categoryRows.reduce((s: number, x: any) => s + x.totalRevenue, 0);
                      const pct = totalRev > 0 ? ((r.totalRevenue / totalRev) * 100).toFixed(1) : "0";
                      return (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="p-3 font-semibold flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            {r.categoryName}
                          </td>
                          <td className="p-3 text-center">{r.orderCount}</td>
                          <td className="p-3 text-center font-bold">{r.totalQty}</td>
                          <td className="p-3 text-left font-bold text-amber-600">{fmt(r.totalRevenue)}</td>
                          <td className="p-3 text-left">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-muted rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} /></div>
                              <span className="text-xs text-muted-foreground w-10 text-left">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {categoryRows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">لا توجد بيانات</td></tr>}
                  </tbody>
                  {categoryRows.length > 0 && (
                    <tfoot className="bg-muted/50 border-t font-bold">
                      <tr>
                        <td className="p-3">الإجمالي</td>
                        <td className="p-3 text-center">{categoryTotalOrders}</td>
                        <td className="p-3 text-center text-amber-600">{categoryTotalQty}</td>
                        <td className="p-3 text-left text-amber-600">{fmt(categoryTotalRevenue)}</td>
                        <td className="p-3 text-left"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: By Payment */}
        {tab === "payment" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">توزيع طرق الدفع</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentRows} dataKey="total" nameKey="paymentMethod" cx="50%" cy="50%" outerRadius={90}
                        label={(entry: any) => `${paymentLabel(entry.paymentMethod)} (${(entry.percent * 100).toFixed(0)}%)`}>
                        {paymentRows.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [fmt(v), "الإجمالي"]} labelFormatter={paymentLabel} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 gap-3 content-start">
                {paymentRows.map((r: any, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-3 h-8 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">{paymentLabel(r.paymentMethod)}</p>
                        <p className="text-xl font-bold text-amber-600">{fmt(r.total)}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-muted-foreground">الفواتير</p>
                        <p className="text-lg font-bold">{r.orders}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {paymentRows.length === 0 && <p className="text-center text-muted-foreground py-10">لا توجد بيانات</p>}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Purchases */}
        {tab === "purchases" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">إجمالي المشتريات</p>
                <p className="text-xl font-bold text-blue-600">{fmt(purchasesData?.totals?.totalPurchases || 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">المدفوع للموردين</p>
                <p className="text-xl font-bold text-emerald-600">{fmt(purchasesData?.totals?.totalPaid || 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">المتبقي (التزامات الموردين)</p>
                <p className="text-xl font-bold text-rose-600">{fmt(purchasesData?.totals?.totalRemaining || 0)}</p>
              </CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">فواتير المشتريات خلال الفترة</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">رقم الفاتورة</th>
                      <th className="text-right p-3 font-semibold">المورد</th>
                      <th className="text-center p-3 font-semibold">التاريخ</th>
                      <th className="text-left p-3 font-semibold">الإجمالي</th>
                      <th className="text-left p-3 font-semibold">المدفوع</th>
                      <th className="text-left p-3 font-semibold">المتبقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(purchasesData?.rows || []).map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{r.invoiceNumber}</td>
                        <td className="p-3 font-semibold">{r.supplierName}</td>
                        <td className="p-3 text-center">{r.invoiceDate}</td>
                        <td className="p-3 text-left font-bold">{fmt(r.total)}</td>
                        <td className="p-3 text-left text-emerald-600">{fmt(r.paidAmount)}</td>
                        <td className="p-3 text-left text-rose-500 font-bold">{fmt(r.remainingAmount)}</td>
                      </tr>
                    ))}
                    {(!purchasesData?.rows || purchasesData.rows.length === 0) && (
                      <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">لا توجد فواتير مشتريات للفترة المحددة</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Inventory */}
        {tab === "inventory" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">إجمالي الأصناف</p>
                <p className="text-xl font-bold">{inventoryData?.totals?.totalItems || 0}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">إجمالي عدد الوحدات بالمخزن</p>
                <p className="text-xl font-bold text-blue-600">{fmt(inventoryData?.totals?.totalStockUnits || 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">تقييم المخزون والتكلفة</p>
                <p className="text-xl font-bold text-amber-600">{fmt(inventoryData?.totals?.totalCostValuation || 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">أصناف قريبة من النفاد</p>
                <p className="text-xl font-bold text-rose-600">{inventoryData?.totals?.lowStockCount || 0}</p>
              </CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">سجل المخزون والتقييم المالي</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">الصنف</th>
                      <th className="text-right p-3 font-semibold">الفئة</th>
                      <th className="text-center p-3 font-semibold">الرصيد الحالي</th>
                      <th className="text-left p-3 font-semibold">التكلفة الفردية</th>
                      <th className="text-left p-3 font-semibold">إجمالي التقييم (التكلفة)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(inventoryData?.products || []).map((p: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold">{p.name}</td>
                        <td className="p-3 text-muted-foreground">{p.categoryName || "-"}</td>
                        <td className={`p-3 text-center font-bold ${p.stock <= p.minStock ? "text-rose-600" : ""}`}>{p.stock}</td>
                        <td className="p-3 text-left">{fmt(p.cost)}</td>
                        <td className="p-3 text-left font-bold text-amber-600">{fmt(p.totalCostValuation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Expenses */}
        {tab === "expenses" && (
          <div className="space-y-4">
            <Card><CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">إجمالي المصروفات التشغيلية للفترة</p>
                <p className="text-2xl font-bold text-rose-600">{fmt(expensesData?.totalExpense || 0)} ر.س</p>
              </div>
            </CardContent></Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">توزيع المصروفات حسب التصنيف</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-right p-3 font-semibold">التصنيف</th>
                        <th className="text-center p-3 font-semibold">العدد</th>
                        <th className="text-left p-3 font-semibold">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(expensesData?.categories || []).map((c: any, i: number) => (
                        <tr key={i}>
                          <td className="p-3 font-semibold">{c.category}</td>
                          <td className="p-3 text-center">{c.count}</td>
                          <td className="p-3 text-left font-bold text-rose-600">{fmt(c.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">آخر قيود المصروفات</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-right p-2 font-semibold">التصنيف</th>
                        <th className="text-left p-2 font-semibold">المبلغ</th>
                        <th className="text-center p-2 font-semibold">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(expensesData?.details || []).slice(0, 10).map((d: any, i: number) => (
                        <tr key={i}>
                          <td className="p-2">{d.category} - {d.notes || ""}</td>
                          <td className="p-2 text-left font-bold text-rose-600">{fmt(d.amount)}</td>
                          <td className="p-2 text-center text-muted-foreground">{d.expense_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Tab: Shifts */}
        {tab === "shifts" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">إجمالي النقدية المحصلة بالمناوبات</p>
                <p className="text-xl font-bold text-emerald-600">{fmt(shiftsData?.totalCashSales || 0)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">صافي فروقات الجرد والتصفية</p>
                <p className={`text-xl font-bold ${(shiftsData?.totalVariance || 0) < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {fmt(shiftsData?.totalVariance || 0)}
                </p>
              </CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">سجل إغلاق المناوبات والصناديق</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">الكاشير</th>
                      <th className="text-center p-3 font-semibold">الافتتاح</th>
                      <th className="text-center p-3 font-semibold">المبيعات النقدية</th>
                      <th className="text-center p-3 font-semibold">المبيعات الشبكة</th>
                      <th className="text-center p-3 font-semibold">المحسوب متوقع</th>
                      <th className="text-center p-3 font-semibold">الفردي الفعلي</th>
                      <th className="text-left p-3 font-semibold">الفرق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(shiftsData?.shifts || []).map((s: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold">{s.cashierName || "غير معروف"}</td>
                        <td className="p-3 text-center">{fmt(s.opening_balance)}</td>
                        <td className="p-3 text-center text-emerald-600 font-bold">{fmt(s.cash_sales)}</td>
                        <td className="p-3 text-center text-blue-600">{fmt(s.card_sales)}</td>
                        <td className="p-3 text-center">{fmt(s.expected_cash)}</td>
                        <td className="p-3 text-center font-bold">{fmt(s.actual_cash)}</td>
                        <td className={`p-3 text-left font-bold ${s.variance < 0 ? "text-rose-600" : s.variance > 0 ? "text-emerald-600" : ""}`}>
                          {fmt(s.variance)}
                        </td>
                      </tr>
                    ))}
                    {(!shiftsData?.shifts || shiftsData.shifts.length === 0) && (
                      <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">لا توجد سجلات مناوبات إغلاق للفترة المحددة</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Tax / VAT */}
        {tab === "tax" && (
          <div className="space-y-4">
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader><CardTitle className="text-base text-amber-900">ملخص الإقرار الضريبي للقيمة المضافة (ZATCA 15%)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-lg border space-y-1">
                    <p className="text-xs text-muted-foreground">ضريبة المخرجات (المبيعات)</p>
                    <p className="text-2xl font-bold text-emerald-600">{fmt(taxData?.outputTax || 0)} ر.س</p>
                    <p className="text-xs text-muted-foreground">المبيعات الخاضعة: {fmt(taxData?.taxableSales || 0)} ر.س</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg border space-y-1">
                    <p className="text-xs text-muted-foreground">ضريبة المدخلات (المشتريات)</p>
                    <p className="text-2xl font-bold text-blue-600">{fmt(taxData?.inputTax || 0)} ر.س</p>
                    <p className="text-xs text-muted-foreground">المشتريات الخاضعة: {fmt(taxData?.taxablePurchases || 0)} ر.س</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg border space-y-1">
                    <p className="text-xs text-muted-foreground">صافي الضريبة المستحقة للسداد</p>
                    <p className="text-2xl font-bold text-amber-600">{fmt(taxData?.netTaxPayable || 0)} ر.س</p>
                    <p className="text-xs text-muted-foreground">(الفرق بين مخرجات ومدخلات الضريبة)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab: Waste */}
        {tab === "waste" && (
          <div className="space-y-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">إجمالي تكلفة الهدر والتالف للفترة</p>
              <p className="text-2xl font-bold text-rose-600">{fmt(wasteData?.totalCost || 0)} ر.س</p>
            </CardContent></Card>
            <Card>
              <CardHeader><CardTitle className="text-base">سجل تفاصيل الهدر والتالف</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">المنتج</th>
                      <th className="text-center p-3 font-semibold">الكمية التالفة</th>
                      <th className="text-left p-3 font-semibold">التكلفة</th>
                      <th className="text-right p-3 font-semibold">السبب</th>
                      <th className="text-center p-3 font-semibold">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(wasteData?.records || []).map((w: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold">{w.productName || "منتج تالف"}</td>
                        <td className="p-3 text-center font-bold text-rose-600">{w.quantity}</td>
                        <td className="p-3 text-left font-bold">{fmt(w.cost)}</td>
                        <td className="p-3">{w.reason || "تالف/منتهي الصلاحية"}</td>
                        <td className="p-3 text-center text-muted-foreground">{w.waste_date}</td>
                      </tr>
                    ))}
                    {(!wasteData?.records || wasteData.records.length === 0) && (
                      <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">لا توجد سجلات هدر تالف في هذه الفترة</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Print dialog */}
      <Dialog open={showPrintDlg} onOpenChange={setShowPrintDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Printer className="w-5 h-5" /> طباعة التقرير</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">التقرير: <strong>{TAB_LABELS[tab]}</strong></p>
            <p className="text-sm text-muted-foreground">الفترة: {startDate} — {endDate}</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">اختر الطابعة</label>
              <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر طابعة..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__window__">طابعة افتراضية (نافذة الطباعة)</SelectItem>
                  {printers.map((p: any) => (
                    <SelectItem key={p.name} value={p.name}>{p.name} {p.isDefault ? "(افتراضية)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {printers.length === 0 && (
                <p className="text-xs text-muted-foreground">لم يتم الكشف عن طابعات متصلة — سيتم استخدام نافذة الطباعة</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 gap-1.5" onClick={handlePrint}>
                <Printer className="w-4 h-4" /> طباعة
              </Button>
              <Button variant="outline" onClick={() => setShowPrintDlg(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

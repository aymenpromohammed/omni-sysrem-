import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, Briefcase, ClipboardList, AlertCircle, FileSpreadsheet, CheckCircle2, Building, Calendar, ShieldCheck, UserCheck } from "lucide-react";
import { apiGet, fmt } from "./api";
import defaultLogo from "@/assets/images/omnisystem_pro_logo_1784250216808.png";

export function ReportsTab({ initialTab }: { initialTab?: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab || "employee_statement");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Fetch company & document print settings from system configuration
  const { data: docSettings } = useQuery({
    queryKey: ["document-print-settings"],
    queryFn: () => apiGet("/api/document-print-settings").catch(() => ({
      companyName: "OmniSystem Pro",
      companySubtitle: "نظام نقاط البيع وإدارة الموارد",
      logoUrl: defaultLogo,
      employeeHeaderText: "كشف حساب ومسير رواتب موظف معتمد",
      employeeFooterText: "إدارة الموارد البشرية - التوقيع والاعتماد",
      accentColor: "#2563eb",
      reportHeaderText: "تقرير عام شامل",
      reportFooterText: "طبع بواسطة نظام OmniSystem Pro",
    })),
  });

  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });
  const { data: depts = [] } = useQuery({ queryKey: ["hr-depts"], queryFn: () => apiGet("/api/hr/departments") });

  // Detailed Employee Statement State
  const [statementEmpId, setStatementEmpId] = useState("");
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statementData, setStatementData] = useState<any | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Other report states
  const { data: custodiesReport = [] } = useQuery({ queryKey: ["hr-report-custodies"], queryFn: () => apiGet("/api/hr/custodies") });
  const { data: movementsReport = [] } = useQuery({ queryKey: ["hr-report-movements"], queryFn: () => apiGet("/api/hr/tools/movements") });
  const { data: leavesReport = [] } = useQuery({ queryKey: ["hr-report-leaves"], queryFn: () => apiGet("/api/hr/leaves") });
  const { data: penaltiesReport = [] } = useQuery({ queryKey: ["hr-report-penalties"], queryFn: () => apiGet("/api/hr/penalties") });
  const { data: notesReport = [] } = useQuery({ queryKey: ["hr-report-notes"], queryFn: () => apiGet("/api/hr/notes") });

  const fetchStatement = async () => {
    if (!statementEmpId) {
      toast({ variant: "destructive", title: "الرجاء اختيار الموظف أولاً" });
      return;
    }
    setLoadingStatement(true);
    try {
      const res = await apiGet(`/api/hr/reports/statement?employee_id=${statementEmpId}&month=${statementMonth}`);
      setStatementData(res);
      toast({ title: "تم توليد الكشف المالي بنجاح", description: `الموظف: ${res.employee?.name || ""}` });
    } catch (e: any) {
      console.error("Error generating HR statement:", e);
      toast({ variant: "destructive", title: "فشل في جلب البيانات", description: e?.message || "تعذر تحميل بيانات كشف الحساب" });
    } finally {
      setLoadingStatement(false);
    }
  };

  const printArea = (elementId: string) => {
    const printContent = document.getElementById(elementId)?.innerHTML;
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <title>${docSettings?.employeeHeaderText || "كشف حساب ومسير رواتب موظف معتمد"} - ${statementData?.employee?.name || ""}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: 'Tajawal', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
              padding: 0; 
              margin: 0;
              color: #0f172a; 
              background: #fff; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-container {
              padding: 24px;
              max-width: 900px;
              margin: 0 auto;
            }
            @media print {
              body { padding: 0; }
              .print-container { padding: 0; max-width: 100%; }
              @page { size: A4 portrait; margin: 10mm; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">${printContent}</div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => { window.close(); }, 700);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  const accent = docSettings?.accentColor || "#2563eb";
  const logo = docSettings?.logoUrl || defaultLogo;
  const companyName = docSettings?.companyName || "OmniSystem Pro";
  const companySubtitle = docSettings?.companySubtitle || "نظام نقاط البيع وإدارة الموارد";
  const headerTitle = docSettings?.employeeHeaderText || "كشف حساب ومسير رواتب موظف معتمد";
  const footerText = docSettings?.employeeFooterText || "إدارة الموارد البشرية - التوقيع والاعتماد";

  const basicSalary = Number(statementData?.employee?.basic_salary) || 0;
  const overtimeSum = Number(statementData?.overtimeTotal) || 0;
  const entitlementsSum = Number(statementData?.entitlementsTotal) || 0;
  const grossEntitlements = basicSalary + overtimeSum + entitlementsSum;

  const penaltiesSum = Number(statementData?.penaltiesTotal) || 0;
  const mealsSum = Number(statementData?.mealsTotal) || 0;
  const totalDeductions = penaltiesSum + mealsSum;
  const finalNetSalary = grossEntitlements - totalDeductions;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full gap-1 overflow-x-auto h-auto p-1 bg-muted">
          <TabsTrigger value="employee_statement" className="py-2 text-xs">كشف حساب موظف</TabsTrigger>
          <TabsTrigger value="custody_statement" className="py-2 text-xs">سجل العهد للموظفين</TabsTrigger>
          <TabsTrigger value="tools_movement" className="py-2 text-xs">حركة دخول وخروج الأدوات</TabsTrigger>
          <TabsTrigger value="leaves_report" className="py-2 text-xs">تقرير الإجازات</TabsTrigger>
          <TabsTrigger value="penalties_report" className="py-2 text-xs">تقرير المخالفات والجزاءات</TabsTrigger>
          <TabsTrigger value="notes_report" className="py-2 text-xs">سجل ملاحظات الأقسام</TabsTrigger>
        </TabsList>

        {/* 1. كشف حساب موظف تفصيلي */}
        <TabsContent value="employee_statement" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />توليد كشف حساب تفصيلي شامل للموظف</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 items-end flex-wrap">
              <div className="w-56">
                <label className="text-xs text-muted-foreground font-semibold">الموظف المعني</label>
                <Select value={statementEmpId} onValueChange={setStatementEmpId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                  <SelectContent>
                    {(employees as any[]).map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <label className="text-xs text-muted-foreground font-semibold">شهر الاستحقاق</label>
                <Input type="month" value={statementMonth} onChange={e => setStatementMonth(e.target.value)} className="mt-1" />
              </div>
              <Button onClick={fetchStatement} size="sm" disabled={loadingStatement}>
                {loadingStatement ? "جاري التوليد..." : "توليد الكشف المالي"}
              </Button>
              {statementData && (
                <Button onClick={() => printArea("employee-statement-sheet")} size="sm" variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/10">
                  <Printer className="w-4 h-4" /> طباعة كشف الحساب
                </Button>
              )}
            </CardContent>
          </Card>

          {statementData && (
            <div 
              id="employee-statement-sheet" 
              className="bg-white text-slate-900 p-8 rounded-xl border border-slate-200 shadow-md max-w-4xl mx-auto" 
              dir="rtl"
              style={{ fontFamily: "'Tajawal', sans-serif" }}
            >
              {/* 1. Official Header with Company Logo & System Branding */}
              <div className="border-b-2 pb-5 mb-6" style={{ borderColor: accent }}>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  {/* Right: Company Logo & Details */}
                  <div className="flex items-center gap-4">
                    {logo && (
                      <img 
                        src={logo} 
                        alt={companyName} 
                        className="h-16 w-auto max-w-[140px] object-contain rounded border p-1 bg-white shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div>
                      <h1 className="text-xl font-extrabold text-slate-900 leading-tight">{companyName}</h1>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{companySubtitle}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                        <Building className="w-3.5 h-3.5" />
                        <span>إدارة الموارد البشرية والرواتب</span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Statement Title & Period */}
                  <div className="text-center md:text-right">
                    <div 
                      className="inline-block px-4 py-1.5 rounded-lg text-white font-black text-sm shadow-sm mb-1"
                      style={{ backgroundColor: accent }}
                    >
                      {headerTitle}
                    </div>
                    <div className="text-xs font-semibold text-slate-600 flex items-center justify-center md:justify-start gap-1.5 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>شهر الاستحقاق المالي:</span>
                      <span className="font-bold text-slate-800 font-mono">{statementMonth}</span>
                    </div>
                  </div>

                  {/* Left: Document Info & Audit Ref */}
                  <div className="text-left text-xs text-slate-500 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-w-[180px]">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">رقم الكشف:</span>
                      <span className="font-mono font-bold text-slate-700">REF-HR-{statementData.employee?.id ?? "00"}-{statementMonth.replace('-', '')}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">تاريخ الإصدار:</span>
                      <span className="font-mono">{new Date().toISOString().slice(0, 10)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">الحالة:</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> كشف معتمد
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Employee Profile Details Bento Grid */}
              <div className="bg-slate-50/80 rounded-xl p-4 mb-6 border border-slate-200/80 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">اسم الموظف الرباعي:</span>
                    <div className="font-bold text-slate-900 text-sm">{statementData.employee?.name}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">الرقم الوظيفي / الكود:</span>
                    <div className="font-mono font-bold text-slate-800">{statementData.employee?.employee_code || `EMP-${statementData.employee?.id}`}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">القسم / الإدارة:</span>
                    <div className="font-semibold text-slate-800">{statementData.employee?.department_name || "القسم العام"}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">المسمى الوظيفي:</span>
                    <div className="font-semibold text-slate-800">{statementData.employee?.position || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">رقم الهاتف / الاتصال:</span>
                    <div className="font-mono font-medium text-slate-700">{statementData.employee?.phone || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">تاريخ المباشرة / التعيين:</span>
                    <div className="font-mono text-slate-700">{statementData.employee?.hire_date || "—"}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">الراتب الأساسي المعتمد:</span>
                    <div className="font-bold font-mono text-sm text-slate-900">{fmt(basicSalary)} ر.س</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">حالة التوظيف:</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                      <UserCheck className="w-3 h-3" /> على رأس العمل
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Financial Matrix: Entitlements vs Deductions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Entitlements (+) */}
                <div className="border rounded-xl p-4 bg-white shadow-xs" style={{ borderColor: `${accent}40` }}>
                  <div className="flex justify-between items-center pb-2.5 mb-3 border-b">
                    <h3 className="font-black text-sm flex items-center gap-1.5 text-emerald-700">
                      <span>الاستحقاقات والبدلات والعمل الإضافي (+)</span>
                    </h3>
                    <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                      مستحقات
                    </Badge>
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 text-slate-600 font-medium">الراتب الأساسي للشهر:</td>
                        <td className="py-2 text-left font-mono font-bold text-slate-800">+{fmt(basicSalary)} ر.س</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-600 font-medium">إجمالي ساعات العمل الإضافي ({statementData.overtime?.reduce((acc: number, o: any) => acc + (o.hours || 0), 0) || 0} ساعة):</td>
                        <td className="py-2 text-left font-mono font-bold text-emerald-600">+{fmt(overtimeSum)} ر.س</td>
                      </tr>
                      {entitlementsSum > 0 && (
                        <tr>
                          <td className="py-2 text-slate-600 font-medium">البدلات والمكافآت المعتمدة:</td>
                          <td className="py-2 text-left font-mono font-bold text-emerald-600">+{fmt(entitlementsSum)} ر.س</td>
                        </tr>
                      )}
                      <tr className="bg-emerald-50/50 font-bold">
                        <td className="py-2.5 px-2 text-emerald-900 font-black">إجمالي الاستحقاقات الإجمالية:</td>
                        <td className="py-2.5 px-2 text-left font-mono font-black text-emerald-700 text-sm">+{fmt(grossEntitlements)} ر.س</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Deductions (-) */}
                <div className="border rounded-xl p-4 bg-white shadow-xs border-rose-200/80">
                  <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-rose-100">
                    <h3 className="font-black text-sm flex items-center gap-1.5 text-rose-700">
                      <span>الاستقطاعات والجزاءات ومسحوبات الوجبات (-)</span>
                    </h3>
                    <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-200">
                      خصميات
                    </Badge>
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 text-slate-600 font-medium">إجمالي المخالفات والجزاءات المالية:</td>
                        <td className="py-2 text-left font-mono font-bold text-rose-600">-{fmt(penaltiesSum)} ر.س</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-600 font-medium">مسحوبات وجبات الطعام المفوترة:</td>
                        <td className="py-2 text-left font-mono font-bold text-rose-600">-{fmt(mealsSum)} ر.س</td>
                      </tr>
                      <tr className="bg-rose-50/50 font-bold">
                        <td className="py-2.5 px-2 text-rose-900 font-black">إجمالي الاستقطاعات والخصومات:</td>
                        <td className="py-2.5 px-2 text-left font-mono font-black text-rose-700 text-sm">-{fmt(totalDeductions)} ر.س</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Detailed Overtime & Penalties Ledger Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Overtime Details */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white">
                  <div className="flex justify-between items-center mb-2.5 border-b pb-2">
                    <h4 className="font-bold text-xs text-slate-800">سجل حركات العمل الإضافي المعتمدة</h4>
                    <span className="text-[11px] text-slate-400 font-mono">{(statementData.overtime as any[]).length} حركة</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b">
                          <th className="p-1.5 text-right">التاريخ</th>
                          <th className="p-1.5 text-right">الساعات</th>
                          <th className="p-1.5 text-right">المعدل</th>
                          <th className="p-1.5 text-left">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {(statementData.overtime as any[]).map((o: any) => (
                          <tr key={o.id} className="hover:bg-slate-50/50">
                            <td className="p-1.5 text-slate-700">{o.date}</td>
                            <td className="p-1.5">{o.hours} س</td>
                            <td className="p-1.5 text-slate-500">{fmt(o.rate ?? o.hourly_rate)}</td>
                            <td className="p-1.5 text-left font-bold text-emerald-600">+{fmt(o.total_amount)}</td>
                          </tr>
                        ))}
                        {(statementData.overtime as any[]).length === 0 && (
                          <tr><td colSpan={4} className="p-3 text-center text-slate-400 font-sans">لا توجد ساعات عمل إضافي مسجلة للشهر</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Penalties Details */}
                <div className="border border-slate-200 rounded-xl p-4 bg-white">
                  <div className="flex justify-between items-center mb-2.5 border-b pb-2">
                    <h4 className="font-bold text-xs text-slate-800">سجل الجزاءات والمخالفات الإدارية</h4>
                    <span className="text-[11px] text-slate-400 font-mono">{(statementData.penalties as any[]).length} جزاء</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b">
                          <th className="p-1.5 text-right">التاريخ</th>
                          <th className="p-1.5 text-right">نوع الجزاء / المخالفة</th>
                          <th className="p-1.5 text-left">مبلغ الخصم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(statementData.penalties as any[]).map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="p-1.5 text-slate-700 font-mono">{p.date}</td>
                            <td className="p-1.5 text-slate-800">{p.violation_name || p.notes || "جزاء إداري"}</td>
                            <td className="p-1.5 text-left font-mono font-bold text-rose-600">-{fmt(p.amount)}</td>
                          </tr>
                        ))}
                        {(statementData.penalties as any[]).length === 0 && (
                          <tr><td colSpan={3} className="p-3 text-center text-slate-400">لا توجد جزاءات أو خصومات مسجلة</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* 5. Loans & Advances Status */}
              {(statementData.loans as any[]).length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 bg-white mb-6">
                  <h4 className="font-bold text-xs text-slate-800 mb-2 border-b pb-1.5">موقف القروض والسلف والذمم المالية للموظف</h4>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b">
                        <th className="p-2 text-right">تاريخ الطلب</th>
                        <th className="p-2 text-right">نوع السلفة / المديونية</th>
                        <th className="p-2 text-right">مبلغ القرض / السلفة</th>
                        <th className="p-2 text-right">حالة الاعتماد والسداد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(statementData.loans as any[]).map((l: any) => (
                        <tr key={l.id}>
                          <td className="p-2 text-slate-700">{l.request_date}</td>
                          <td className="p-2 font-sans font-medium">{l.type === "loan" ? "قرض مستمر" : "سلفة مؤقتة"}</td>
                          <td className="p-2 font-bold text-slate-900">{fmt(l.amount)} ر.س</td>
                          <td className="p-2 font-sans">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                              {l.status === "approved" ? "معتمد وساري" : l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6. Net Payable Salary Hero Summary Banner */}
              <div 
                className="rounded-xl p-5 mb-8 text-white shadow-md flex flex-col md:flex-row justify-between items-center gap-4"
                style={{ 
                  background: `linear-gradient(135deg, ${accent} 0%, #0f172a 100%)`,
                }}
              >
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/80 font-bold">صافي الراتب المستحق للصرف النهائي:</div>
                  <div className="text-2xl md:text-3xl font-black font-mono mt-1 text-white tracking-tight">
                    {fmt(finalNetSalary)} <span className="text-sm font-sans font-normal text-white/80">ريال سعودي</span>
                  </div>
                  <div className="text-[11px] text-white/70 mt-1">
                    (إجمالي الاستحقاقات: {fmt(grossEntitlements)} ر.س) - (إجمالي الاستقطاعات: {fmt(totalDeductions)} ر.س)
                  </div>
                </div>

                <div className="text-center md:text-left bg-white/10 backdrop-blur-xs p-3 rounded-lg border border-white/20 min-w-[200px]">
                  <span className="text-[11px] text-white/80 block">المبلغ المعتمد للإيداع:</span>
                  <span className="font-mono font-black text-lg text-white block mt-0.5">{fmt(finalNetSalary)} ر.س</span>
                  <span className="text-[10px] text-white/70 block mt-0.5">جاهز للصرف والتحويل البنكي</span>
                </div>
              </div>

              {/* 7. Official Signatures Section */}
              <div className="border-t border-slate-300 pt-6 mb-6">
                <div className="grid grid-cols-3 gap-6 text-center text-xs">
                  <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-200">
                    <p className="font-bold text-slate-800 mb-1">الموظف المقر بالاستلام</p>
                    <p className="text-[10px] text-slate-400 mb-8">{statementData.employee?.name}</p>
                    <div className="border-b border-dashed border-slate-400 w-32 mx-auto"></div>
                    <p className="text-[10px] text-slate-400 mt-1.5">التوقيع والتاريخ</p>
                  </div>

                  <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-200">
                    <p className="font-bold text-slate-800 mb-1">المحاسب المالي المختص</p>
                    <p className="text-[10px] text-slate-400 mb-8">مراجعة الحسابات والمسيرات</p>
                    <div className="border-b border-dashed border-slate-400 w-32 mx-auto"></div>
                    <p className="text-[10px] text-slate-400 mt-1.5">التوقيع والاعتماد</p>
                  </div>

                  <div className="bg-slate-50/60 p-3 rounded-lg border border-slate-200">
                    <p className="font-bold text-slate-800 mb-1">اعتماد إدارة الموارد البشرية</p>
                    <p className="text-[10px] text-slate-400 mb-8">المدير المالي / المدير العام</p>
                    <div className="border-b border-dashed border-slate-400 w-32 mx-auto"></div>
                    <p className="text-[10px] text-slate-400 mt-1.5">الختم والتوقيع الرسمي</p>
                  </div>
                </div>
              </div>

              {/* 8. Official Custom Footer From System Configuration */}
              <div className="text-center pt-4 border-t border-slate-200 text-xs text-slate-500">
                <p className="font-bold text-slate-700 mb-1">{footerText}</p>
                <p className="text-[11px] text-slate-400">
                  تم استخراج وطباعة هذا المستند عبر نظام {companyName} في {new Date().toLocaleString("ar-SA")} - مستند مالي وإداري معتمد
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* 2. سجل عهد الموظفين */}
        <TabsContent value="custody_statement">
          <Card>
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><Briefcase className="w-4 h-4 text-amber-500" />سجل جرد ومطابقة عهد الموظفين</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr><th className="text-right p-3 font-semibold">الموظف</th><th className="text-right p-3 font-semibold">بيان العهدة</th><th className="text-right p-3 font-semibold">تاريخ التسليم</th><th className="text-right p-3 font-semibold">تاريخ الاسترداد</th><th className="text-right p-3 font-semibold">حالة العهدة</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(custodiesReport as any[]).map((c: any) => (
                    <tr key={c.id}>
                      <td className="p-3 font-medium">{c.employee_name}</td>
                      <td className="p-3 font-bold text-slate-700">{c.item_name}</td>
                      <td className="p-3 font-mono">{c.received_date}</td>
                      <td className="p-3 font-mono">{c.returned_date ?? "—"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${c.status === "held" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {c.status === "held" ? "مستمرة" : "تمت إعادتها"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. حركة دخول وخروج الأدوات */}
        <TabsContent value="tools_movement">
          <Card>
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-500" />سجل حركة خروج وعودة الأدوات</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr><th className="text-right p-3 font-semibold">الحركة</th><th className="text-right p-3 font-semibold">الأداة</th><th className="text-right p-3 font-semibold">الموظف</th><th className="text-right p-3 font-semibold">الكمية</th><th className="text-right p-3 font-semibold">تاريخ الحركة</th><th className="text-right p-3 font-semibold">ملاحظات</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(movementsReport as any[]).map((m: any) => (
                    <tr key={m.id}>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${m.type === "out" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                          {m.type === "out" ? "صرف" : "عودة للعهدة"}
                        </span>
                      </td>
                      <td className="p-3">{m.tool_name}</td>
                      <td className="p-3">{m.employee_name}</td>
                      <td className="p-3 font-mono font-bold">{m.quantity}</td>
                      <td className="p-3 text-muted-foreground font-mono">{m.date}</td>
                      <td className="p-3 text-xs text-muted-foreground">{m.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. تقرير الإجازات */}
        <TabsContent value="leaves_report">
          <Card>
            <CardHeader><CardTitle className="text-sm font-bold">تقرير تفصيلي بالإجازات المسجلة</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr><th className="text-right p-3 font-semibold">الموظف</th><th className="text-right p-3 font-semibold">نوع الإجازة</th><th className="text-right p-3 font-semibold">من تاريخ</th><th className="text-right p-3 font-semibold">إلى تاريخ</th><th className="text-right p-3 font-semibold">الحالة</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(leavesReport as any[]).map((l: any) => (
                    <tr key={l.id}>
                      <td className="p-3 font-semibold">{l.employee_name}</td>
                      <td className="p-3 font-medium text-blue-700">{l.type}</td>
                      <td className="p-3 font-mono">{l.start_date}</td>
                      <td className="p-3 font-mono">{l.end_date}</td>
                      <td className="p-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{l.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. تقرير المخالفات والجزاءات */}
        <TabsContent value="penalties_report">
          <Card>
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" />سجل الجزاءات المالية والمخالفات المرصودة</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr><th className="text-right p-3 font-semibold">الموظف</th><th className="text-right p-3 font-semibold">البيان</th><th className="text-right p-3 font-semibold font-mono">الخصم المالي</th><th className="text-right p-3 font-semibold">تاريخ المخالفة</th><th className="text-right p-3 font-semibold">ملاحظات</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(penaltiesReport as any[]).map((p: any) => (
                    <tr key={p.id}>
                      <td className="p-3 font-medium">{p.employee_name}</td>
                      <td className="p-3 font-bold text-red-600">{p.violation_name}</td>
                      <td className="p-3 font-mono font-black text-red-600">-{fmt(p.amount)}</td>
                      <td className="p-3 text-muted-foreground font-mono">{p.date}</td>
                      <td className="p-3 text-xs text-muted-foreground">{p.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. تقرير ملاحظات الأقسام */}
        <TabsContent value="notes_report">
          <Card>
            <CardHeader><CardTitle className="text-sm font-bold flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-purple-500" />سجل الملاحظات والطلبات التاريخية للأقسام</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr><th className="text-right p-3 font-semibold">القسم المعني</th><th className="text-right p-3 font-semibold">العنوان والبيان</th><th className="text-right p-3 font-semibold">تاريخ ووقت التسجيل</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(notesReport as any[]).map((n: any) => (
                    <tr key={n.id}>
                      <td className="p-3"><span className="font-bold px-2 py-1 bg-purple-50 text-purple-700 rounded-md">{n.department_name ?? "عام لكافة الأقسام"}</span></td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{n.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{n.content}</div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono">{new Date(n.created_at).toLocaleString("ar-SA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

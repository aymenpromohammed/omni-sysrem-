import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, FileText, Briefcase, ClipboardList, AlertCircle, FileSpreadsheet } from "lucide-react";
import { apiGet, fmt } from "./api";

export function ReportsTab({ initialTab }: { initialTab?: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab || "employee_statement");

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const { data: employees = [] } = useQuery({ queryKey: ["hr-employees"], queryFn: () => apiGet("/api/hr/employees") });
  const { data: depts = [] } = useQuery({ queryKey: ["hr-depts"], queryFn: () => apiGet("/api/hr/departments") });

  // Detailed Employee Statement State
  const [statementEmpId, setStatementEmpId] = useState("");
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statementData, setStatementData] = useState<any | null>(null);

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
    try {
      const res = await apiGet(`/api/hr/reports/statement?employee_id=${statementEmpId}&month=${statementMonth}`);
      setStatementData(res);
    } catch {
      toast({ variant: "destructive", title: "حدث خطأ أثناء جلب البيانات" });
    }
  };

  const printArea = (elementId: string) => {
    const printContent = document.getElementById(elementId)?.innerHTML;
    if (!printContent) return;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = `<div dir="rtl" style="font-family: 'Tajawal', sans-serif; padding: 20px;">${printContent}</div>`;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload(); // Quick restore React state
  };

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
              <Button onClick={fetchStatement} size="sm">توليد الكشف المالي</Button>
              {statementData && (
                <Button onClick={() => printArea("employee-statement-sheet")} size="sm" variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/10">
                  <Printer className="w-4 h-4" /> طباعة كشف الحساب
                </Button>
              )}
            </CardContent>
          </Card>

          {statementData && (
            <div id="employee-statement-sheet" className="bg-white text-black p-8 rounded-xl border shadow-sm max-w-4xl mx-auto" dir="rtl">
              {/* Header */}
              <div className="text-center border-b-2 border-slate-300 pb-4 mb-6">
                <h2 className="text-2xl font-black tracking-tight">مسودة كشف الحساب المالي والإداري للموظف</h2>
                <p className="text-sm text-slate-500 mt-1">المستحق لشهر: {statementMonth}</p>
              </div>

              {/* Grid employee details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
                <div><span className="font-bold text-slate-500">اسم الموظف:</span> <span className="font-bold">{statementData.employee?.name}</span></div>
                <div><span className="font-bold text-slate-500">رقم الهاتف:</span> <span className="font-mono">{statementData.employee?.phone ?? "—"}</span></div>
                <div><span className="font-bold text-slate-500">المنصب / المسمى:</span> <span>{statementData.employee?.position ?? "—"}</span></div>
                <div><span className="font-bold text-slate-500">المرتب الأساسي:</span> <span className="font-mono font-bold text-blue-700">{fmt(statementData.employee?.basic_salary)}</span></div>
              </div>

              {/* Two Column details: Overtime & Penalties */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Overtime Table */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold text-sm mb-2 border-b pb-1 text-green-700">العمل الإضافي والبدلات (+)</h3>
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 text-slate-600"><th className="text-right p-1">التاريخ</th><th className="text-right p-1">ساعات</th><th className="text-right p-1">المبلغ</th></tr></thead>
                    <tbody className="divide-y">
                      {(statementData.overtime as any[]).map((o: any) => (
                        <tr key={o.id}>
                          <td className="p-1">{o.date}</td>
                          <td className="p-1">{o.hours} ساعة</td>
                          <td className="p-1 text-green-600">+{fmt(o.total_amount)}</td>
                        </tr>
                      ))}
                      {(statementData.overtime as any[]).length === 0 && <tr><td colSpan={3} className="p-2 text-center text-slate-400">لا توجد ساعات عمل إضافي مسجلة</td></tr>}
                    </tbody>
                  </table>
                </div>

                {/* Penalties Table */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold text-sm mb-2 border-b pb-1 text-red-700">المخالفات والخصومات (-)</h3>
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 text-slate-600"><th className="text-right p-1">التاريخ</th><th className="text-right p-1">البيان</th><th className="text-right p-1">الخصم</th></tr></thead>
                    <tbody className="divide-y">
                      {(statementData.penalties as any[]).map((p: any) => (
                        <tr key={p.id}>
                          <td className="p-1">{p.date}</td>
                          <td className="p-1">{p.violation_name}</td>
                          <td className="p-1 text-red-600">-{fmt(p.amount)}</td>
                        </tr>
                      ))}
                      {(statementData.penalties as any[]).length === 0 && <tr><td colSpan={3} className="p-2 text-center text-slate-400">لا توجد غرامات أو جزاءات مسجلة</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Meal deductions and active loans */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold text-sm mb-2 border-b pb-1 text-amber-700">سحب وجبات الموظفين (-)</h3>
                  <div className="flex justify-between items-center text-xs font-bold pt-2">
                    <span>إجمالي سحب الوجبات المفوترة:</span>
                    <span className="text-red-600">-{fmt(statementData.mealsTotal)}</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold text-sm mb-2 border-b pb-1 text-blue-700">القروض والسلف والذمم المدنية</h3>
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 text-slate-600"><th className="text-right p-1">تاريخ</th><th className="text-right p-1">نوع المديونية</th><th className="text-right p-1">مبلغ السلفة</th></tr></thead>
                    <tbody className="divide-y">
                      {(statementData.loans as any[]).map((l: any) => (
                        <tr key={l.id}>
                          <td className="p-1">{l.request_date}</td>
                          <td className="p-1">{l.type === "loan" ? "قرض مستمر" : "سلفة مؤقتة"}</td>
                          <td className="p-1 font-bold">{fmt(l.amount)}</td>
                        </tr>
                      ))}
                      {(statementData.loans as any[]).length === 0 && <tr><td colSpan={3} className="p-2 text-center text-slate-400">لا توجد ديون مسجلة</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary net footer */}
              <div className="border-2 border-slate-800 rounded-xl p-4 bg-slate-50 flex justify-between items-center mb-8">
                <div>
                  <div className="font-black text-lg">المرتب الصافي المستحق:</div>
                  <div className="text-xs text-slate-500">(الأساسي + الإضافي) - (خصومات الوجبات والجزاءات وأقساط السداد المقدرة)</div>
                </div>
                <div className="text-2xl font-black text-green-700 font-mono">
                  {fmt(
                    statementData.employee?.basic_salary +
                    (statementData.overtime as any[]).reduce((s, o) => s + o.total_amount, 0) -
                    (statementData.penalties as any[]).reduce((s, p) => s + p.amount, 0) -
                    statementData.mealsTotal
                  )}
                </div>
              </div>

              {/* Signature section */}
              <div className="grid grid-cols-2 gap-12 mt-12 pt-8 border-t border-dashed border-slate-300 text-center text-xs">
                <div>
                  <p className="font-bold text-slate-700 mb-6">توقيع الموظف المقر بالاستلام والذمة المفتوحة:</p>
                  <p className="border-b border-slate-400 w-48 mx-auto mt-4"></p>
                </div>
                <div>
                  <p className="font-bold text-slate-700 mb-6">اعتماد المدير العام / المدير المالي المباشر:</p>
                  <p className="border-b border-slate-400 w-48 mx-auto mt-4"></p>
                </div>
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

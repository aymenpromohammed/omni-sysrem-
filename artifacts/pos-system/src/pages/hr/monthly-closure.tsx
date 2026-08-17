import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Play } from "lucide-react";
import { apiGet, apiPost, fmt } from "./api";

export function MonthlyClosureTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [previewData, setPreviewData] = useState<any[] | null>(null);

  const previewMut = useMutation({
    mutationFn: () => apiPost("/api/hr/monthly-close/preview", { month }),
    onSuccess: (data) => setPreviewData(data),
    onError: () => toast({ variant: "destructive", title: "فشل استخراج مسودة إغلاق الرواتب" }),
  });

  const commitMut = useMutation({
    mutationFn: () => apiPost("/api/hr/monthly-close", { month }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-salaries"] });
      qc.invalidateQueries({ queryKey: ["hr-loans"] });
      qc.invalidateQueries({ queryKey: ["hr-summary"] });
      setPreviewData(null);
      toast({ title: "تم ترحيل الرواتب وإغلاق الشهر بنجاح!" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل ترحيل وإغلاق الشهر", description: e.message }),
  });

  const grandBasic = previewData?.reduce((s, r) => s + r.basic, 0) ?? 0;
  const grandOvertime = previewData?.reduce((s, r) => s + r.overtime, 0) ?? 0;
  const grandMeals = previewData?.reduce((s, r) => s + r.meals, 0) ?? 0;
  const grandPenalties = previewData?.reduce((s, r) => s + r.penalties, 0) ?? 0;
  const grandLoans = previewData?.reduce((s, r) => s + r.loans, 0) ?? 0;
  const grandNet = previewData?.reduce((s, r) => s + r.net, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">ترحيل وإغلاق الرواتب الشهري</h2>
          <p className="text-sm text-muted-foreground">يقوم النظام بجمع ساعات الإضافي، خصومات الوجبات، المخالفات، السلف الممنوحة واحتساب صافي المرتب وترحيله تلقائياً.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-sm font-bold">1. اختر الشهر والتشغيل</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">شهر الاستحقاق</label>
              <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPreviewData(null); }} className="mt-1" />
            </div>
            <Button onClick={() => previewMut.mutate()} className="w-full gap-2" variant="secondary" disabled={previewMut.isPending}>
              <Play className="w-4 h-4" /> عرض واحتساب مسودة الرواتب
            </Button>
            {previewData && (
              <Button onClick={() => confirm("ترحيل الشهر سيقوم بخصم السلف وتأكيد مسير الرواتب نهائياً. هل أنت متأكد؟") && commitMut.mutate()} className="w-full gap-2" variant="default" disabled={commitMut.isPending}>
                <CheckCircle2 className="w-4 h-4" /> ترحيل الرواتب نهائياً وتأكيدها
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-4">
          {!previewData ? (
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-2 animate-pulse" />
              <div className="font-bold">يرجى اختيار الشهر وتوليد مسودة المراجعة أولاً</div>
              <p className="text-xs max-w-sm mt-1">توليد المسودة لا يقوم بالتعديل الفعلي، مما يتيح لك مراجعة كامل الرواتب بدقة متناهية قبل إقرارها.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground">إجمالي المرتبات الأساسية</div>
                  <div className="text-lg font-bold font-mono text-foreground">{fmt(grandBasic)}</div>
                </div>
                <div className="bg-muted p-3 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground">العمل الإضافي</div>
                  <div className="text-lg font-bold font-mono text-green-600">+{fmt(grandOvertime)}</div>
                </div>
                <div className="bg-muted p-3 rounded-lg text-center">
                  <div className="text-xs text-muted-foreground">الخصومات (وجبات + جزاءات + سلف)</div>
                  <div className="text-lg font-bold font-mono text-red-600">-{fmt(grandMeals + grandPenalties + grandLoans)}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-center border border-green-200">
                  <div className="text-xs text-green-700">صافي الرواتب الكلي المطلوب</div>
                  <div className="text-lg font-bold font-mono text-green-700">{fmt(grandNet)}</div>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-right p-3 font-semibold">الموظف</th>
                      <th className="text-right p-3 font-semibold">الأساسي</th>
                      <th className="text-right p-3 font-semibold">الإضافي (+)</th>
                      <th className="text-right p-3 font-semibold">الوجبات (-)</th>
                      <th className="text-right p-3 font-semibold">الجزاءات (-)</th>
                      <th className="text-right p-3 font-semibold">السداد للقروض (-)</th>
                      <th className="text-right p-3 font-semibold text-green-600">صافي المرتب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewData.map((r: any) => (
                      <tr key={r.employee_id} className="hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-semibold">{r.employee_name}</div>
                          <div className="text-[10px] text-muted-foreground">{r.position}</div>
                        </td>
                        <td className="p-3 font-mono">{fmt(r.basic)}</td>
                        <td className="p-3 font-mono text-green-600">+{fmt(r.overtime)}</td>
                        <td className="p-3 font-mono text-red-600">-{fmt(r.meals)}</td>
                        <td className="p-3 font-mono text-red-600">-{fmt(r.penalties)}</td>
                        <td className="p-3 font-mono text-red-600">-{fmt(r.loans)}</td>
                        <td className="p-3 font-mono font-bold text-green-700">{fmt(r.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

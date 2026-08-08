import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Plus, Trash2, ShieldCheck, Monitor, Laptop } from "lucide-react";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); }

export default function LicensesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [clientName, setClientName] = useState("");
  const [devicesLimit, setDevicesLimit] = useState("3");
  const [expiresAt, setExpiresAt] = useState("2027-12-31");
  const [expandedLicenseId, setExpandedLicenseId] = useState<number | null>(null);

  const { data: licenses = [] } = useQuery({ queryKey: ["licenses"], queryFn: () => apiGet("/api/licenses") });

  const addMut = useMutation({
    mutationFn: () => apiPost("/api/licenses", { client_name: clientName, devices_limit: Number(devicesLimit), expires_at: expiresAt }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["licenses"] }); setClientName(""); toast({ title: "تم إصدار مفتاح التفعيل بنجاح" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/licenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["licenses"] }); toast({ title: "تم الحذف" }); }
  });

  const removeDeviceMut = useMutation({
    mutationFn: (deviceId: number) => apiDel(`/api/licenses/devices/${deviceId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["licenses"] }); toast({ title: "تم إلغاء ربط الجهاز بنجاح" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound className="w-6 h-6 text-primary" />نظام التراخيص وإدارة الأجهزة (Developer License)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة مفاتيح التفعيل وتحديد عدد الأجهزة المسموح بها لكل عميل مع تتبع بصمات الأجهزة النشطة.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />إصدار مفتاح تفعيل جديد</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="اسم العميل / المنشأة" />
            <Input type="number" min="1" value={devicesLimit} onChange={e => setDevicesLimit(e.target.value)} placeholder="عدد الأجهزة المسموحة" />
            <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} placeholder="تاريخ الانتهاء" />
            <Button onClick={() => addMut.mutate()} disabled={!clientName.trim()} className="gap-1"><Plus className="w-4 h-4" />إصدار المفتاح</Button>
          </CardContent>
        </Card>

        <div className="bg-card rounded-xl border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-right p-3 font-semibold">مفتاح التفعيل</th>
                <th className="text-right p-3 font-semibold">اسم العميل</th>
                <th className="text-center p-3 font-semibold">الأجهزة النشطة / المسموحة</th>
                <th className="text-right p-3 font-semibold">تاريخ الانتهاء</th>
                <th className="text-right p-3 font-semibold">الحالة</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(licenses as any[]).map(l => {
                const isExpanded = expandedLicenseId === l.id;
                const activeCount = l.devices?.length ?? 0;
                return (
                  <>
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono text-primary font-bold">{l.license_key}</td>
                      <td className="p-3 font-medium">{l.client_name}</td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => setExpandedLicenseId(isExpanded ? null : l.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/80 hover:bg-secondary text-xs font-medium transition-colors"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          <span>{activeCount} / {l.devices_limit} أجهزة</span>
                          <span className="text-muted-foreground">({isExpanded ? "إخفاء التفاصيل" : "عرض الأجهزة"})</span>
                        </button>
                      </td>
                      <td className="p-3 text-muted-foreground">{l.expires_at}</td>
                      <td className="p-3"><span className="px-2.5 py-0.5 rounded-full text-xs bg-green-100 text-green-800 font-semibold">نشط</span></td>
                      <td className="p-3 text-center flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => confirm("هل أنت متأكد من حذف هذا الترخيص بالكامل؟") && delMut.mutate(l.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`devices-${l.id}`} className="bg-muted/20">
                        <td colSpan={6} className="p-4">
                          <div className="bg-background rounded-lg border p-4 space-y-3">
                            <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <Laptop className="w-4 h-4 text-primary" /> الأجهزة المرجعية المسجلة لهذا الترخيص ({activeCount} من {l.devices_limit})
                            </h4>
                            {l.devices && l.devices.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {l.devices.map((d: any) => (
                                  <div key={d.id} className="flex items-center justify-between p-2.5 rounded border bg-card text-xs">
                                    <div className="space-y-0.5 truncate">
                                      <div className="font-medium truncate">{d.device_name || "جهاز غير محدد"}</div>
                                      <div className="font-mono text-[10px] text-muted-foreground truncate">ID: {d.device_id}</div>
                                      <div className="text-[10px] text-muted-foreground">آخر نشاط: {d.last_active}</div>
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-destructive h-7 px-2 hover:bg-destructive/10" 
                                      onClick={() => confirm("هل تريد إلغاء ربط هذا الجهاز وإتاحة الترخيص لجهاز آخر؟") && removeDeviceMut.mutate(d.id)}
                                    >
                                      إلغاء الربط
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground py-2">لا توجد أجهزة مسجلة حتى الآن لهذا الترخيص. سيتم تسجيل الجهاز تلقائياً عند أول عملية تحقق.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {licenses.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد تراخيص مسجلة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

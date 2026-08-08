import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Truck, Plus, Trash2, ShoppingCart } from "lucide-react";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); }

function fmt(n?: number) { return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function SuppliersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supAddress, setSupAddress] = useState("");

  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => apiGet("/api/suppliers") });
  const { data: purchases = [] } = useQuery({ queryKey: ["purchases"], queryFn: () => apiGet("/api/purchases") });

  const addSup = useMutation({
    mutationFn: () => apiPost("/api/suppliers", { name: supName, phone: supPhone, email: supEmail, address: supAddress }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); setSupName(""); setSupPhone(""); setSupEmail(""); setSupAddress(""); toast({ title: "تم إضافة المورد بنجاح" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل", description: e.message })
  });

  const delSup = useMutation({
    mutationFn: (id: number) => apiDel(`/api/suppliers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast({ title: "تم الحذف" }); }
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="w-6 h-6" />إدارة الموردين والمشتريات</h1>

        <Tabs defaultValue="suppliers">
          <TabsList>
            <TabsTrigger value="suppliers">الموردين</TabsTrigger>
            <TabsTrigger value="purchases">أوامر الشراء</TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">إضافة مورد جديد</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-5 gap-3">
                <Input value={supName} onChange={e => setSupName(e.target.value)} placeholder="اسم المورد" />
                <Input value={supPhone} onChange={e => setSupPhone(e.target.value)} placeholder="الهاتف" />
                <Input value={supEmail} onChange={e => setSupEmail(e.target.value)} placeholder="البريد الإلكتروني" />
                <Input value={supAddress} onChange={e => setSupAddress(e.target.value)} placeholder="العنوان" />
                <Button onClick={() => addSup.mutate()} disabled={!supName.trim()} className="gap-1"><Plus className="w-4 h-4" />إضافة مورد</Button>
              </CardContent>
            </Card>

            <div className="bg-card rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-right p-3 font-semibold">المورد</th>
                    <th className="text-right p-3 font-semibold">الهاتف</th>
                    <th className="text-right p-3 font-semibold">البريد</th>
                    <th className="text-right p-3 font-semibold">العنوان</th>
                    <th className="text-right p-3 font-semibold">المديونية</th>
                    <th className="p-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(suppliers as any[]).map(s => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">{s.name}</td>
                      <td className="p-3 text-muted-foreground">{s.phone ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{s.email ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{s.address ?? "—"}</td>
                      <td className="p-3 font-mono font-bold text-destructive">{fmt(s.balance)}</td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("حذف المورد؟") && delSup.mutate(s.id)}><Trash2 className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا توجد موردين مسجلين</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="purchases" className="space-y-4 mt-4">
            <div className="bg-card rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-right p-3 font-semibold">رقم أمر الشراء</th>
                    <th className="text-right p-3 font-semibold">المورد</th>
                    <th className="text-right p-3 font-semibold">التاريخ</th>
                    <th className="text-right p-3 font-semibold">الحالة</th>
                    <th className="text-right p-3 font-semibold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(purchases as any[]).map(p => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono text-primary font-bold">{p.po_number}</td>
                      <td className="p-3">{p.supplier_name ?? "مورد عام"}</td>
                      <td className="p-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ar-SA")}</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 font-semibold">مستلم</span></td>
                      <td className="p-3 font-mono font-bold">{fmt(p.total)}</td>
                    </tr>
                  ))}
                  {purchases.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد أوامر شراء مسجلة</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

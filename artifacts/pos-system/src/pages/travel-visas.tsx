import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Plus, Search, Edit2, Trash2, CheckCircle2, Clock, AlertCircle, FileText, CheckSquare } from "lucide-react";

function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {})
    }
  }).then(async res => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "حدث خطأ أثناء العملية");
    }
    if (res.status === 204) return {} as T;
    return res.json();
  });
}

const VISA_STATUS: Record<string, { label: string; class: string }> = {
  under_process: { label: "قيد المعالجة (سفارة/مكتب)", class: "bg-amber-100 text-amber-800 border-amber-200" },
  approved: { label: "تم إصدار التأشيرة ✅", class: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "مرفوضة ❌", class: "bg-red-100 text-red-800 border-red-200" },
  delivered: { label: "تم تسليمها للعميل", class: "bg-blue-100 text-blue-800 border-blue-200" },
  pending_docs: { label: "وثائق ناقصة ⚠️", class: "bg-purple-100 text-purple-800 border-purple-200" }
};

export default function TravelVisasPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVisa, setEditingVisa] = useState<any | null>(null);

  const [form, setForm] = useState({
    customer_id: "",
    passenger_id: "",
    country: "",
    visa_type: "سياحية",
    status: "under_process",
    application_date: new Date().toISOString().slice(0, 10),
    expiry_date: "",
    cost_price: "",
    selling_price: "",
    missing_docs: "",
    notes: ""
  });

  const { data: visas = [], isLoading } = useQuery<any[]>({
    queryKey: ["travel-visas"],
    queryFn: () => fetchWithAuth("/api/travel/visas")
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers-list"],
    queryFn: () => fetchWithAuth("/api/customers")
  });

  const { data: passengers = [] } = useQuery<any[]>({
    queryKey: ["travel-passengers-list"],
    queryFn: () => fetchWithAuth("/api/travel/passengers")
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingVisa) {
        return fetchWithAuth(`/api/travel/visas/${editingVisa.id}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return fetchWithAuth("/api/travel/visas", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-visas"] });
      setModalOpen(false);
      resetForm();
    }
  });

  const resetForm = () => {
    setEditingVisa(null);
    setForm({
      customer_id: "",
      passenger_id: "",
      country: "",
      visa_type: "سياحية",
      status: "under_process",
      application_date: new Date().toISOString().slice(0, 10),
      expiry_date: "",
      cost_price: "0",
      selling_price: "0",
      missing_docs: "",
      notes: ""
    });
  };

  const handleEdit = (v: any) => {
    setEditingVisa(v);
    setForm({
      customer_id: v.customer_id ? String(v.customer_id) : "",
      passenger_id: v.passenger_id ? String(v.passenger_id) : "",
      country: v.country || "",
      visa_type: v.visa_type || "سياحية",
      status: v.status || "under_process",
      application_date: v.application_date || "",
      expiry_date: v.expiry_date || "",
      cost_price: String(v.cost_price || 0),
      selling_price: String(v.selling_price || 0),
      missing_docs: v.missing_docs || "",
      notes: v.notes || ""
    });
    setModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <Globe className="w-7 h-7 text-primary" />
              خدمات ومعاملات التأشيرات (Visas Management)
            </h1>
            <p className="text-sm text-muted-foreground">
              متابعة طلبات تأشيرات الشنغن، أمريكا، بريطانيا، الخليج، وتحديد المواعيد والوثائق الناقصة
            </p>
          </div>
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="bg-primary hover:bg-primary/90 gap-2 font-bold">
            <Plus className="w-4 h-4" /> معاملة تأشيرة جديدة
          </Button>
        </div>

        {/* Visas Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">سجل معاملات التأشيرات الحالية ({visas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">جاري تحميل التأشيرات...</div>
            ) : visas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">لا توجد معاملات تأشيرات حالية</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-slate-700 font-bold">
                      <th className="p-3">رقم المعاملة</th>
                      <th className="p-3">العميل / المسافر</th>
                      <th className="p-3">الدولة / نوع التأشيرة</th>
                      <th className="p-3">تاريخ التقديم</th>
                      <th className="p-3">المستندات الناقصة</th>
                      <th className="p-3">التكلفة / البيع</th>
                      <th className="p-3">حالة التأشيرة</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visas.map((v) => {
                      const badge = VISA_STATUS[v.status] || { label: v.status, class: "bg-slate-100" };
                      return (
                        <tr key={v.id} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-primary">{v.visa_number}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{v.customer_name || "عميل"}</div>
                            <div className="text-xs text-muted-foreground">👤 {v.passenger_name_ar || v.passenger_name_en || "نفس العميل"}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-800">{v.country}</div>
                            <div className="text-xs text-muted-foreground">{v.visa_type}</div>
                          </td>
                          <td className="p-3 text-xs font-mono">{v.application_date || "-"}</td>
                          <td className="p-3 text-xs">
                            {v.missing_docs ? (
                              <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-bold">
                                ⚠️ {v.missing_docs}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold">مكتملة ✅</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            <div className="text-muted-foreground">شراء: {Number(v.cost_price || 0).toLocaleString()}</div>
                            <div className="font-bold text-slate-900">بيع: {Number(v.selling_price || 0).toLocaleString()}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full border ${badge.class}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleEdit(v)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingVisa ? "تعديل معاملة التأشيرة" : "تسجيل معاملة تأشيرة جديدة"}</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={e => {
                e.preventDefault();
                saveMutation.mutate(form);
              }}
              className="space-y-4 py-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">العميل الدافع *</label>
                  <select
                    required
                    value={form.customer_id}
                    onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- اختر العميل --</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">المسافر المتقدم للتأشيرة</label>
                  <select
                    value={form.passenger_id}
                    onChange={e => setForm(f => ({ ...f, passenger_id: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- نفس العميل أو اختر مسافر --</option>
                    {passengers.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name_ar} ({p.passport_number})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">الدولة المطلوبة *</label>
                  <Input
                    required
                    placeholder="مثال: فرنسا (شنغن) / بريطانيا / أمريكا"
                    value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">نوع التأشيرة</label>
                  <select
                    value={form.visa_type}
                    onChange={e => setForm(f => ({ ...f, visa_type: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="سياحية">سياحية</option>
                    <option value="تجارية / عمل">تجارية / عمل</option>
                    <option value="علاجية">علاجية</option>
                    <option value="دراسية">دراسية</option>
                    <option value="ترانزيت">ترانزيت</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تكلفة السفارة/الرسوم (Cost)</label>
                  <Input
                    type="number"
                    value={form.cost_price}
                    onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">سعر البيع للعميل (Price)</label>
                  <Input
                    type="number"
                    value={form.selling_price}
                    onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">حالة المعاملة</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="under_process">قيد المعالجة (سفارة/مكتب)</option>
                    <option value="approved">تم إبشار التأشيرة ✅</option>
                    <option value="delivered">تم التسليم للعميل</option>
                    <option value="pending_docs">وثائق ناقصة ⚠️</option>
                    <option value="rejected">مرفوضة ❌</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تاريخ تقديم المعاملة</label>
                  <Input
                    type="date"
                    value={form.application_date}
                    onChange={e => setForm(f => ({ ...f, application_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">الوثائق الناقصة المطلوبة من العميل (إن وجدت)</label>
                <Input
                  placeholder="مثال: تعريف بالراتب معتمد / كشف حساب بنكي 6 أشهر"
                  value={form.missing_docs}
                  onChange={e => setForm(f => ({ ...f, missing_docs: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">ملاحظات ومواعيد البصمة</label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="موعد البصمة تم حجزه يوم..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90 font-bold">
                  {saveMutation.isPending ? "جاري الحفظ..." : "حفظ المعاملة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

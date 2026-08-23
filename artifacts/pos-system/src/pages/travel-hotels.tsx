import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Hotel, Plus, Search, Edit2, Trash2, Calendar, MapPin, Building2 } from "lucide-react";

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

export default function TravelHotelsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    passenger_id: "",
    hotel_name: "",
    city_country: "",
    check_in: "",
    check_out: "",
    room_type: "مزدوجة",
    nights: "1",
    cost_price: "",
    selling_price: "",
    notes: ""
  });

  const { data: hotels = [], isLoading } = useQuery<any[]>({
    queryKey: ["travel-hotels"],
    queryFn: () => fetchWithAuth("/api/travel/hotels")
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["customers-list"],
    queryFn: () => fetchWithAuth("/api/customers")
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/travel/hotels", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["travel-hotels"] });
      setModalOpen(false);
      setForm({ customer_id: "", passenger_id: "", hotel_name: "", city_country: "", check_in: "", check_out: "", room_type: "مزدوجة", nights: "1", cost_price: "", selling_price: "", notes: "" });
    }
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <Hotel className="w-7 h-7 text-primary" />
              حجوزات الفنادق والإقامة السياحية (Hotel Bookings)
            </h1>
            <p className="text-sm text-muted-foreground">
              حجز واختيار الفنادق والمنتجعات، ليالي الإقامة، ونوع الغرف والشقق الفندقية
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)} className="bg-primary hover:bg-primary/90 gap-2 font-bold">
            <Plus className="w-4 h-4" /> حجز فندقي جديد
          </Button>
        </div>

        {/* Hotels Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">سجل الحجوزات الفندقية ({hotels.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">جاري تحميل الفنادق...</div>
            ) : hotels.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">لا توجد حجوزات فندقية</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-slate-700 font-bold">
                      <th className="p-3">رقم المرجع</th>
                      <th className="p-3">العميل / النزيل</th>
                      <th className="p-3">اسم الفندق</th>
                      <th className="p-3">المدينة والدولة</th>
                      <th className="p-3">الدخول - المغادرة</th>
                      <th className="p-3">الليالي / الغرفة</th>
                      <th className="p-3">الإجمالي (بيع)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotels.map((h) => (
                      <tr key={h.id} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-primary">{h.booking_ref}</td>
                        <td className="p-3 font-bold text-slate-900">{h.customer_name || "نزيل"}</td>
                        <td className="p-3 font-bold text-slate-800">{h.hotel_name}</td>
                        <td className="p-3 text-xs">{h.city_country}</td>
                        <td className="p-3 text-xs font-mono">{h.check_in || "-"} ⬅️ {h.check_out || "-"}</td>
                        <td className="p-3 text-xs">{h.nights} ليالي ({h.room_type})</td>
                        <td className="p-3 font-mono font-bold text-emerald-700">{Number(h.selling_price || 0).toLocaleString()} ريال</td>
                      </tr>
                    ))}
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
              <DialogTitle>تسجيل حجز فندقي جديد</DialogTitle>
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
                  <label className="text-xs font-bold text-slate-700">اسم الفندق / المنتجع *</label>
                  <Input
                    required
                    placeholder="مثال: فندق أتلانتس / هيلتون"
                    value={form.hotel_name}
                    onChange={e => setForm(f => ({ ...f, hotel_name: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">المدينة والدولة *</label>
                  <Input
                    required
                    placeholder="مثال: دبي - الإمارات"
                    value={form.city_country}
                    onChange={e => setForm(f => ({ ...f, city_country: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">نوع الغرفة</label>
                  <Input
                    placeholder="مثال: جناح ديلوكس / غرفة مزدوجة"
                    value={form.room_type}
                    onChange={e => setForm(f => ({ ...f, room_type: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تاريخ تسجيل الدخول (Check-In)</label>
                  <Input
                    type="date"
                    value={form.check_in}
                    onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تاريخ تسجيل المغادرة (Check-Out)</label>
                  <Input
                    type="date"
                    value={form.check_out}
                    onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">سعر التكلفة (Cost)</label>
                  <Input
                    type="number"
                    value={form.cost_price}
                    onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">سعر البيع للعميل (Selling Price)</label>
                  <Input
                    type="number"
                    value={form.selling_price}
                    onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90 font-bold">
                  {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الحجز الفندقي"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

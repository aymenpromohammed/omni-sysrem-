import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Search, Edit2, Trash2, UserCheck, Eye, Phone, Mail, MapPin, Ticket, Globe, Hotel, Luggage, Printer, FileText, MessageSquare } from "lucide-react";

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

const TYPE_BADGES: Record<string, { label: string; class: string }> = {
  individual: { label: "أفراد (Individual)", class: "bg-blue-100 text-blue-800 border-blue-200" },
  corporate: { label: "شركات (Corporate)", class: "bg-purple-100 text-purple-800 border-purple-200" },
  vip: { label: "VIP دائم", class: "bg-amber-100 text-amber-800 border-amber-200 font-bold" },
  debtor: { label: "عميل مدين", class: "bg-red-100 text-red-800 border-red-200" }
};

export default function TravelCustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);

  // Profile Drawer / Modal State
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [profileTab, setProfileTab] = useState<"bookings" | "visas" | "hotels" | "passengers" | "statement" | "logs">("bookings");

  // New Log input state
  const [newLogType, setNewLogType] = useState("واتساب");
  const [newLogSummary, setNewLogSummary] = useState("");

  const [form, setForm] = useState({
    name: "",
    name_en: "",
    phone: "",
    alternate_phone: "",
    email: "",
    address: "",
    nationality: "سعودي",
    country: "السعودية",
    dob: "",
    gender: "ذكر",
    national_id: "",
    passport_number: "",
    passport_issue_date: "",
    passport_expiry_date: "",
    employer: "",
    notes: "",
    customer_type: "individual"
  });

  const { data: customers = [], isLoading } = useQuery<any[]>({
    queryKey: ["customers-list", search, typeFilter],
    queryFn: () => {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (typeFilter) q.set("type", typeFilter);
      return fetchWithAuth(`/api/customers?${q.toString()}`);
    }
  });

  const { data: profileData, isLoading: isLoadingProfile } = useQuery<any>({
    queryKey: ["customer-profile", activeProfileId],
    queryFn: () => fetchWithAuth(`/api/travel/customer-profile/${activeProfileId}`),
    enabled: Boolean(activeProfileId)
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingCustomer) {
        return fetchWithAuth(`/api/customers/${editingCustomer.id}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return fetchWithAuth("/api/customers", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      setModalOpen(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers-list"] });
    }
  });

  const addLogMutation = useMutation({
    mutationFn: (data: any) => fetchWithAuth("/api/travel/contact-logs", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-profile", activeProfileId] });
      setNewLogSummary("");
    }
  });

  const resetForm = () => {
    setEditingCustomer(null);
    setForm({
      name: "",
      name_en: "",
      phone: "",
      alternate_phone: "",
      email: "",
      address: "",
      nationality: "سعودي",
      country: "السعودية",
      dob: "",
      gender: "ذكر",
      national_id: "",
      passport_number: "",
      passport_issue_date: "",
      passport_expiry_date: "",
      employer: "",
      notes: "",
      customer_type: "individual"
    });
  };

  const handleEdit = (c: any) => {
    setEditingCustomer(c);
    setForm({
      name: c.name || "",
      name_en: c.name_en || "",
      phone: c.phone || "",
      alternate_phone: c.alternate_phone || "",
      email: c.email || "",
      address: c.address || "",
      nationality: c.nationality || "سعودي",
      country: c.country || "السعودية",
      dob: c.dob || "",
      gender: c.gender || "ذكر",
      national_id: c.national_id || "",
      passport_number: c.passport_number || "",
      passport_issue_date: c.passport_issue_date || "",
      passport_expiry_date: c.passport_expiry_date || "",
      employer: c.employer || "",
      notes: c.notes || "",
      customer_type: c.customer_type || "individual"
    });
    setModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <Users className="w-7 h-7 text-primary" />
              إدارة العملاء والـ CRM (Customer Profile & Accounts)
            </h1>
            <p className="text-sm text-muted-foreground">
              ملفات موحدة للعملاء (أفراد / شركات / VIP)، كشف حساب تفصيلي، وحجوزات التذاكر والفنادق
            </p>
          </div>
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="bg-primary hover:bg-primary/90 gap-2 font-bold">
            <Plus className="w-4 h-4" /> إضافة عميل جديد
          </Button>
        </div>

        {/* Filter bar */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <Input
                placeholder="ابحث باسم العميل بالعربية أو الإنجليزية، رقم الجواز، رقم الهوية أو الهاتف..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-56"
            >
              <option value="">جميع تصنيفات العملاء</option>
              <option value="individual">العملاء الأفراد (Individuals)</option>
              <option value="corporate">الشركات والجهات (Corporate)</option>
              <option value="vip">العملاء الدائمون (VIP)</option>
              <option value="debtor">العملاء المدينون (Debtors)</option>
            </select>
          </div>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">قائمة العملاء ({customers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">جاري تحميل العملاء...</div>
            ) : customers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">لا يوجد عملاء مطابقون للبحث</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-slate-700 font-bold">
                      <th className="p-3">#</th>
                      <th className="p-3">اسم العميل بالعربية والإنجليزية</th>
                      <th className="p-3">التصنيف</th>
                      <th className="p-3">رقم الهاتف</th>
                      <th className="p-3">رقم الجواز / الهوية</th>
                      <th className="p-3">إجمالي التعاملات</th>
                      <th className="p-3">الحجوزات والمسافرين</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, idx) => {
                      const badge = TYPE_BADGES[c.customer_type] || { label: c.customer_type || "فرد", class: "bg-slate-100" };
                      return (
                        <tr key={c.id} className="border-b hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono text-xs">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{c.name}</div>
                            {c.name_en && <div className="text-xs font-mono text-muted-foreground">{c.name_en}</div>}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${badge.class}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-xs">{c.phone || "-"}</td>
                          <td className="p-3 font-mono text-xs">
                            {c.passport_number ? `جواز: ${c.passport_number}` : c.national_id ? `هوية: ${c.national_id}` : "-"}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-700">
                            {Number(c.totalPurchases || 0).toLocaleString()} ريال
                          </td>
                          <td className="p-3 text-xs">
                            <span className="font-semibold text-primary">{c.bookingsCount || 0} حجوزات</span> / <span className="text-slate-600">{c.passengersCount || 0} مسافرين</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 text-xs font-bold border-primary text-primary hover:bg-primary/10"
                                onClick={() => setActiveProfileId(c.id)}
                              >
                                <Eye className="w-3.5 h-3.5" /> الملف الموحد
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleEdit(c)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm(`هل أنت تأكد من حذف العميل "${c.name}"؟`)) {
                                    deleteMutation.mutate(c.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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

        {/* Add / Edit Customer Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? "تعديل بيانات العميل" : "تسجيل عميل جديد"}</DialogTitle>
              <DialogDescription>
                إدخال بيانات التواصل والتصنيف وجواز السفر لمتابعة التعاملات والحجوزات
              </DialogDescription>
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
                  <label className="text-xs font-bold text-slate-700">تصنيف العميل (Category) *</label>
                  <select
                    value={form.customer_type}
                    onChange={e => setForm(f => ({ ...f, customer_type: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="individual">عميل فرد (Individual)</option>
                    <option value="corporate">شركة / جهة (Corporate)</option>
                    <option value="vip">عميل دائم VIP</option>
                    <option value="debtor">عميل مدين (Debtor)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">الاسم الكامل بالعربية *</label>
                  <Input
                    required
                    placeholder="مثال: عبدالله محمد العتيبي"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">الاسم بالإنجليزية (حسب الجواز)</label>
                  <Input
                    placeholder="مثال: ABDULLAH MOHAMMED ALOTAIBI"
                    value={form.name_en}
                    onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">رقم الهاتف الأساسي *</label>
                  <Input
                    required
                    placeholder="0500000000"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">هاتف بديل / واتساب</label>
                  <Input
                    placeholder="0550000000"
                    value={form.alternate_phone}
                    onChange={e => setForm(f => ({ ...f, alternate_phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">البريد الإلكتروني</label>
                  <Input
                    type="email"
                    placeholder="client@email.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">رقم جواز السفر</label>
                  <Input
                    placeholder="مثال: A12345678"
                    value={form.passport_number}
                    onChange={e => setForm(f => ({ ...f, passport_number: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تاريخ انتهاء الجواز</label>
                  <Input
                    type="date"
                    value={form.passport_expiry_date}
                    onChange={e => setForm(f => ({ ...f, passport_expiry_date: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">رقم الهوية الوطنية / السجل التجاري</label>
                  <Input
                    placeholder="1088776655"
                    value={form.national_id}
                    onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">جهة العمل / الشركة</label>
                  <Input
                    placeholder="اسم جهة العمل"
                    value={form.employer}
                    onChange={e => setForm(f => ({ ...f, employer: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">ملاحظات العميل والتفضيلات</label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="ملاحظات العميل الخاصة والتسهيلات الإئتمانية..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90 font-bold">
                  {saveMutation.isPending ? "جاري الحفظ..." : "حفظ بيانات العميل"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Unified Detailed Client Profile Modal (الملف الموحد للعميل) */}
        <Dialog open={Boolean(activeProfileId)} onOpenChange={open => !open && setActiveProfileId(null)}>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            {isLoadingProfile || !profileData ? (
              <div className="p-12 text-center text-muted-foreground">جاري تحميل الملف الموحد...</div>
            ) : (
              <div className="space-y-6">
                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900 text-white rounded-xl gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">{profileData.customer.name}</h2>
                    {profileData.customer.name_en && <p className="text-sm font-mono opacity-80">{profileData.customer.name_en}</p>}
                    <div className="flex items-center gap-3 text-xs mt-2 opacity-90">
                      <span>📱 {profileData.customer.phone}</span>
                      {profileData.customer.email && <span>✉️ {profileData.customer.email}</span>}
                      {profileData.customer.passport_number && <span>📄 جواز: {profileData.customer.passport_number}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                      {profileData.customer.customer_type || "عميل"}
                    </span>
                    <span className="text-xs opacity-75 font-mono">رقم العميل: #{profileData.customer.id}</span>
                  </div>
                </div>

                {/* Profile Summary KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-100 rounded-lg border">
                    <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                    <p className="text-lg font-bold font-mono text-slate-900">{Number(profileData.summary.totalSales || 0).toLocaleString()} ريال</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-xs text-emerald-800">المسدد</p>
                    <p className="text-lg font-bold font-mono text-emerald-700">{Number(profileData.summary.paidAmount || 0).toLocaleString()} ريال</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-800">المتبقي الآجل</p>
                    <p className="text-lg font-bold font-mono text-amber-700">{Number(profileData.summary.dueAmount || 0).toLocaleString()} ريال</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-800">إجمالي الحجوزات</p>
                    <p className="text-lg font-bold font-mono text-blue-700">{profileData.summary.totalBookingsCount} حجز</p>
                  </div>
                </div>

                {/* Profile Tabs Navigation */}
                <div className="flex border-b overflow-x-auto gap-2 pb-1">
                  {[
                    ["bookings", "حجوزات وتذاكر الطيران", Ticket],
                    ["visas", "معاملات التأشيرات", Globe],
                    ["hotels", "الحجوزات الفندقية", Hotel],
                    ["passengers", "المسافرون التابعون", Luggage],
                    ["statement", "كشف الحساب والمالية", FileText],
                    ["logs", "سجل التواصل والملاحظات", MessageSquare]
                  ].map(([id, title, Icon]: any) => (
                    <button
                      key={id}
                      onClick={() => setProfileTab(id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors whitespace-nowrap ${
                        profileTab === id ? "bg-primary text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {title}
                    </button>
                  ))}
                </div>

                {/* Tab 1: Bookings */}
                {profileTab === "bookings" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold">تذاكر وحجوزات الطيران الخاصة بالعميل</h3>
                    {profileData.bookings.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-4 text-center">لا توجد حجوزات طيران لهذا العميل</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border">
                          <thead className="bg-slate-100 font-bold border-b">
                            <tr>
                              <th className="p-2">رقم الحجز</th>
                              <th className="p-2">PNR</th>
                              <th className="p-2">المسافر</th>
                              <th className="p-2">المسار</th>
                              <th className="p-2">المغادرة</th>
                              <th className="p-2">سعر البيع</th>
                              <th className="p-2">الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.bookings.map((b: any) => (
                              <tr key={b.id} className="border-b">
                                <td className="p-2 font-mono font-bold text-primary">{b.booking_number}</td>
                                <td className="p-2 font-mono">{b.pnr || "-"}</td>
                                <td className="p-2">{b.passenger_name || "نفس العميل"}</td>
                                <td className="p-2">{b.origin_city} ⬅️ {b.destination_city}</td>
                                <td className="p-2 font-mono">{b.departure_date}</td>
                                <td className="p-2 font-mono font-bold">{Number(b.selling_price || 0).toLocaleString()} ريال</td>
                                <td className="p-2 font-bold">{b.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Visas */}
                {profileTab === "visas" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold">معاملات التأشيرات الخاصة بالعميل</h3>
                    {profileData.visas.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-4 text-center">لا توجد معاملات تأشيرات لهذا العميل</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border">
                          <thead className="bg-slate-100 font-bold border-b">
                            <tr>
                              <th className="p-2">رقم المعاملة</th>
                              <th className="p-2">الدولة</th>
                              <th className="p-2">نوع التأشيرة</th>
                              <th className="p-2">المستندات الناقصة</th>
                              <th className="p-2">الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.visas.map((v: any) => (
                              <tr key={v.id} className="border-b">
                                <td className="p-2 font-mono font-bold">{v.visa_number}</td>
                                <td className="p-2 font-bold">{v.country}</td>
                                <td className="p-2">{v.visa_type}</td>
                                <td className="p-2 text-amber-800 font-bold">{v.missing_docs || "مكتملة ✅"}</td>
                                <td className="p-2 font-bold">{v.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Hotels */}
                {profileTab === "hotels" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold">الحجوزات الفندقية والإقامة</h3>
                    {profileData.hotels.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-4 text-center">لا توجد حجوزات فندقية لهذا العميل</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border">
                          <thead className="bg-slate-100 font-bold border-b">
                            <tr>
                              <th className="p-2">المرجع</th>
                              <th className="p-2">اسم الفندق</th>
                              <th className="p-2">المدينة</th>
                              <th className="p-2">تاريخ الإقامة</th>
                              <th className="p-2">السعر</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.hotels.map((h: any) => (
                              <tr key={h.id} className="border-b">
                                <td className="p-2 font-mono font-bold">{h.booking_ref}</td>
                                <td className="p-2 font-bold">{h.hotel_name}</td>
                                <td className="p-2">{h.city_country}</td>
                                <td className="p-2 font-mono">{h.check_in} ⬅️ {h.check_out}</td>
                                <td className="p-2 font-mono font-bold">{Number(h.selling_price || 0).toLocaleString()} ريال</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Passengers */}
                {profileTab === "passengers" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold">قائمة المسافرين المكفولين والتابعين للعميل</h3>
                    {profileData.passengers.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-4 text-center">لا يوجد مسافرون مضافون تحت كفالة هذا العميل</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right border">
                          <thead className="bg-slate-100 font-bold border-b">
                            <tr>
                              <th className="p-2">الاسم بالعربية والإنجليزية</th>
                              <th className="p-2">اللقب/الجنس</th>
                              <th className="p-2">رقم الجواز</th>
                              <th className="p-2">تاريخ الانتهاء</th>
                              <th className="p-2">الجنسية</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData.passengers.map((p: any) => (
                              <tr key={p.id} className="border-b">
                                <td className="p-2 font-bold">{p.name_ar} <span className="font-normal font-mono opacity-75">({p.name_en})</span></td>
                                <td className="p-2">{p.title} - {p.gender}</td>
                                <td className="p-2 font-mono font-bold">{p.passport_number || "-"}</td>
                                <td className="p-2 font-mono">{p.passport_expiry_date || "-"}</td>
                                <td className="p-2">{p.nationality || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 5: Statement of Account (كشف حساب العميل) */}
                {profileTab === "statement" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-sm font-bold text-slate-800">كشف حساب العميل التفصيلي (Statement of Account)</h3>
                      <Button size="sm" onClick={() => window.print()} className="gap-1 text-xs bg-slate-800 font-bold">
                        <Printer className="w-3.5 h-3.5" /> طباعة كشف الحساب
                      </Button>
                    </div>

                    <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-white rounded border">
                          <p className="text-xs text-muted-foreground">إجمالي الحساب (المدين)</p>
                          <p className="text-base font-bold font-mono text-slate-900">{Number(profileData.summary.totalSales || 0).toLocaleString()} ريال</p>
                        </div>
                        <div className="p-2 bg-white rounded border">
                          <p className="text-xs text-emerald-700 font-bold">إجمالي المدفوع (الدائن)</p>
                          <p className="text-base font-bold font-mono text-emerald-700">{Number(profileData.summary.paidAmount || 0).toLocaleString()} ريال</p>
                        </div>
                        <div className="p-2 bg-white rounded border">
                          <p className="text-xs text-amber-700 font-bold">الرصيد النهائي المستحق</p>
                          <p className="text-base font-bold font-mono text-amber-700">{Number(profileData.summary.dueAmount || 0).toLocaleString()} ريال</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 6: Communication Logs & Notes */}
                {profileTab === "logs" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold">سجل التواصل وملاحظات خدمة العملاء</h3>

                    {/* Add Log Form */}
                    <div className="p-3 border rounded-lg bg-slate-50 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={newLogType}
                          onChange={e => setNewLogType(e.target.value)}
                          className="h-9 rounded border text-xs px-2 bg-white font-bold"
                        >
                          <option value="واتساب">واتساب</option>
                          <option value="اتصال">اتصال هاتف</option>
                          <option value="بريد إلكتروني">بريد إلكتروني</option>
                          <option value="زيارة مكتب">زيارة لمكتب</option>
                        </select>
                        <Input
                          placeholder="اكتب ملخص التواصل مع العميل..."
                          value={newLogSummary}
                          onChange={e => setNewLogSummary(e.target.value)}
                          className="h-9 text-xs bg-white flex-1"
                        />
                        <Button
                          disabled={!newLogSummary || addLogMutation.isPending}
                          onClick={() => addLogMutation.mutate({ customer_id: activeProfileId, contact_type: newLogType, summary: newLogSummary })}
                          className="h-9 text-xs font-bold"
                        >
                          إضافة ملاحظة
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {profileData.contactLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-4 text-center">لا توجد سجلات تواصل سابقة</p>
                      ) : (
                        profileData.contactLogs.map((log: any) => (
                          <div key={log.id} className="p-3 border rounded-lg bg-white flex items-center justify-between text-xs">
                            <div>
                              <div className="flex items-center gap-2 font-bold text-slate-800">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">{log.contact_type}</span>
                                <span>{log.summary}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">بواسطة: {log.user_name || "الموظف"}</p>
                            </div>
                            <span className="font-mono text-muted-foreground text-[10px]">{log.contact_date}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

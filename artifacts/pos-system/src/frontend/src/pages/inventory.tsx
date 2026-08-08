import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Package, AlertTriangle, ArrowDownRight, ArrowUpRight, Plus, RefreshCw, Search, Layers, DollarSign } from "lucide-react";

export default function InventoryPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState<"stocks" | "movements" | "lowstock">("stocks");

  // Adjustment Dialog state
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustType, setAdjustType] = useState<"in" | "out" | "adjustment">("in");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/inventory/summary").then(r => r.json()),
      fetch("/api/inventory/movements").then(r => r.json())
    ])
      .then(([sumData, movData]) => {
        if (sumData && !sumData.error) setSummary(sumData);
        if (Array.isArray(movData)) setMovements(movData);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toast({ variant: "destructive", title: "فشل تحميل البيانات" });
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdjust = (prod: any) => {
    setSelectedProduct(prod);
    setAdjustType("in");
    setAdjustQty("1");
    setAdjustReason("");
    setShowAdjustDialog(true);
  };

  const handleSaveAdjustment = () => {
    if (!selectedProduct || !adjustQty || isNaN(Number(adjustQty))) {
      toast({ variant: "destructive", title: "يرجى إدخال كمية صحيحة" });
      return;
    }

    fetch("/api/inventory/movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: selectedProduct.id,
        type: adjustType,
        quantity: Number(adjustQty),
        reason: adjustReason || (adjustType === 'in' ? 'إدخال مخزني' : adjustType === 'out' ? 'صرف مخزني' : 'تسوية جردية'),
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          toast({ title: "تم تحديث المخزون بنجاح" });
          setShowAdjustDialog(false);
          loadData();
        } else {
          toast({ variant: "destructive", title: data.error || "فشل العملية" });
        }
      })
      .catch(() => toast({ variant: "destructive", title: "خطأ في الاتصال بالخادم" }));
  };

  const filteredProducts = summary?.products?.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || String(p.number).includes(search)
  ) || [];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-7 h-7 text-blue-600" />
              إدارة المخزون والمستودعات المتقدمة
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              متابعة أرصدة الأصناف، التنبيهات، التسويات الجردية، وحركات الدخول والخروج للمستودع.
            </p>
          </div>
          <Button onClick={loadData} variant="outline" className="gap-2 font-bold">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            تحديث البيانات
          </Button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-600">إجمالي الأصناف</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{summary?.totalItems || 0}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                <Layers className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600">إجمالي الوحدات بالمخزن</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{summary?.totalStockCount || 0}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                <Package className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-600">تكلفة المخزون الإجمالية</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">${summary?.totalStockCost?.toFixed(2) || "0.00"}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
                <DollarSign className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-rose-50 to-white">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-600">تنبيهات النواقص (≤ 10)</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{summary?.lowStockCount || 0}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-inner">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <Button
            variant={selectedTab === "stocks" ? "default" : "ghost"}
            onClick={() => setSelectedTab("stocks")}
            className="gap-2 font-bold"
          >
            <Package className="w-4 h-4" />
            أرصدة المخزون والأصناف
          </Button>
          <Button
            variant={selectedTab === "lowstock" ? "default" : "ghost"}
            onClick={() => setSelectedTab("lowstock")}
            className="gap-2 font-bold"
          >
            <AlertTriangle className="w-4 h-4" />
            النواقص وحد الطلب ({summary?.lowStockCount || 0})
          </Button>
          <Button
            variant={selectedTab === "movements" ? "default" : "ghost"}
            onClick={() => setSelectedTab("movements")}
            className="gap-2 font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            سجل الحركات المخزنية
          </Button>
        </div>

        {/* Tab 1: Stocks */}
        {selectedTab === "stocks" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث باسم الصنف أو رقمه..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9"
                />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right p-3 font-semibold text-slate-700">رقم الصنف</th>
                    <th className="text-right p-3 font-semibold text-slate-700">اسم الصنف</th>
                    <th className="text-right p-3 font-semibold text-slate-700">التصنيف</th>
                    <th className="text-right p-3 font-semibold text-slate-700">الرصيد الحالي</th>
                    <th className="text-left p-3 font-semibold text-slate-700">التكلفة</th>
                    <th className="text-left p-3 font-semibold text-slate-700">سعر البيع</th>
                    <th className="text-center p-3 font-semibold text-slate-700">إجراءات المخزن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد أصناف مطابقة</td>
                    </tr>
                  ) : (
                    filteredProducts.map((p: any) => {
                      const stock = p.stock ?? 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-blue-600">{p.number}</td>
                          <td className="p-3 font-medium text-slate-800">{p.name}</td>
                          <td className="p-3 text-slate-500">{p.categoryName || "-"}</td>
                          <td className="p-3">
                            <Badge variant={stock <= 10 ? "destructive" : "outline"} className={stock > 10 ? "text-emerald-600 border-emerald-300 bg-emerald-50" : ""}>
                              {stock} وحدة
                            </Badge>
                          </td>
                          <td className="p-3 text-left font-mono text-slate-600">${p.cost?.toFixed(2) || "0.00"}</td>
                          <td className="p-3 text-left font-mono font-bold text-slate-800">${p.price.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <Button size="sm" onClick={() => handleOpenAdjust(p)} className="gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs">
                              <Plus className="w-3.5 h-3.5" />
                              تسوية / حركة
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Low Stock */}
        {selectedTab === "lowstock" && (
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-rose-50 border-b border-rose-100">
                  <tr>
                    <th className="text-right p-3 font-semibold text-rose-800">رقم الصنف</th>
                    <th className="text-right p-3 font-semibold text-rose-800">اسم الصنف</th>
                    <th className="text-right p-3 font-semibold text-rose-800">التصنيف</th>
                    <th className="text-right p-3 font-semibold text-rose-800">الرصيد المتبقي</th>
                    <th className="text-center p-3 font-semibold text-rose-800">إجراء سريع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary?.lowStockItems?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-emerald-600 font-bold">لا توجد نواقص في المخزن حالياً! جميع الأرصدة كافية.</td>
                    </tr>
                  ) : (
                    summary?.lowStockItems?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-rose-50/20">
                        <td className="p-3 font-mono font-bold text-rose-600">{p.number}</td>
                        <td className="p-3 font-medium text-slate-800">{p.name}</td>
                        <td className="p-3 text-slate-500">{p.categoryName || "-"}</td>
                        <td className="p-3 font-bold text-rose-600">{p.stock ?? 0} وحدة</td>
                        <td className="p-3 text-center">
                          <Button size="sm" onClick={() => handleOpenAdjust(p)} className="gap-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs">
                            <Plus className="w-3.5 h-3.5" />
                            توريد كمية جديدة
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Movements Log */}
        {selectedTab === "movements" && (
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right p-3 font-semibold text-slate-700">رقم الحركة</th>
                    <th className="text-right p-3 font-semibold text-slate-700">الصنف</th>
                    <th className="text-right p-3 font-semibold text-slate-700">نوع الحركة</th>
                    <th className="text-right p-3 font-semibold text-slate-700">الكمية</th>
                    <th className="text-right p-3 font-semibold text-slate-700">الرصيد السابق ➔ الجديد</th>
                    <th className="text-right p-3 font-semibold text-slate-700">السبب / الملاحظة</th>
                    <th className="text-right p-3 font-semibold text-slate-700">المستخدم والتاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد حركات مخزنية مسجلة</td>
                    </tr>
                  ) : (
                    movements.map((m: any) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-slate-500">#{m.id}</td>
                        <td className="p-3 font-bold text-slate-800">{m.productName}</td>
                        <td className="p-3">
                          {m.type === 'in' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 gap-1 border-0"><ArrowDownRight className="w-3 h-3" /> توريد (إدخال)</Badge>
                          ) : m.type === 'out' ? (
                            <Badge className="bg-rose-100 text-rose-800 gap-1 border-0"><ArrowUpRight className="w-3 h-3" /> صرف (إخراج)</Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800 gap-1 border-0"><RefreshCw className="w-3 h-3" /> تسوية جردية</Badge>
                          )}
                        </td>
                        <td className="p-3 font-bold font-mono text-slate-800">{m.quantity}</td>
                        <td className="p-3 font-mono text-slate-600">{m.previous_stock} ➔ <strong className="text-slate-900">{m.new_stock}</strong></td>
                        <td className="p-3 text-slate-600">{m.reason || "-"}</td>
                        <td className="p-3 text-xs text-slate-500">
                          <div className="font-bold text-slate-700">{m.user_name || "النظام"}</div>
                          <div>{m.created_at}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stock Adjustment Dialog */}
        <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-right font-bold text-slate-900">
                تسوية وحركة مخزنية: {selectedProduct?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">نوع الحركة</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
                >
                  <option value="in">توريد (إدخال مخزني)</option>
                  <option value="out">صرف (إخراج مخزني)</option>
                  <option value="adjustment">جرد مباشر (تعيين الرصيد الحالي)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  {adjustType === 'adjustment' ? 'الرصيد الفعلي الجديد' : 'الكمية'}
                </label>
                <Input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="أدخل الكمية..."
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  الرصيد الحالي بالمخزن: <span className="font-bold text-slate-800">{selectedProduct?.stock ?? 0}</span>
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">سبب الحركة / الملاحظة</label>
                <Input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="مثال: فاتورة شراء، تالف، جرد دوري..."
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>إلغاء</Button>
              <Button onClick={handleSaveAdjustment} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">حفظ الحركة</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

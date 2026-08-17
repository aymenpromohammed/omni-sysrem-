import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AppLogo } from "@/components/AppLogo";
import { Plus, Trash2, Eye, Search, RotateCcw, DollarSign, Package, Calendar, AlertTriangle, Users, Printer, CheckCircle2, FileText } from "lucide-react";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) {
  const r = await fetchAuth(url);
  if (!r.ok) {
    let errText = "حدث خطأ أثناء الاتصال بالخادم";
    try {
      const json = await r.json();
      if (json.error) errText = json.error;
    } catch {
      errText = await r.text();
    }
    throw new Error(errText);
  }
  return r.json();
}
async function apiPost(url: string, body: any) { const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function apiDel(url: string) { const r = await fetchAuth(url, { method: "DELETE" }); if (!r.ok && r.status !== 204) throw new Error(await r.text()); }

function fmt(n?: number) { return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* ─── نافذة مرتجع جديد (مع بحث بالفاتورة) ─── */
function NewReturnDialog({ open, initialInvoice, onClose, onSuccess }: { open: boolean; initialInvoice?: string; onClose: () => void; onSuccess: (createdReturn?: any) => void }) {
  const { toast } = useToast();
  const [invoiceSearch, setInvoiceSearch] = useState(initialInvoice ?? "");
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<number, { selected: boolean; qty: number }>>({});
  const [reason, setReason] = useState("طلب الزبون / إرجاع صنف");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (initialInvoice && open) {
      setInvoiceSearch(initialInvoice);
      executeSearch(initialInvoice);
    }
  }, [initialInvoice, open]);

  const executeSearch = async (term: string) => {
    if (!term || !term.trim()) return;
    setSearching(true);
    try {
      const rawData = await apiGet(`/api/orders/lookup?q=${encodeURIComponent(term.trim())}`);
      const data = Array.isArray(rawData) ? rawData[0] : rawData;
      if (!data || !data.id) {
        throw new Error(`لم يتم العثور على الفاتورة رقم "${term}"`);
      }
      setFoundOrder(data);
      // تحديد العناصر ذات الكميات المتبقية
      const sel: Record<number, { selected: boolean; qty: number }> = {};
      (data.items ?? []).forEach((item: any, idx: number) => {
        const remaining = item.remainingQuantity ?? item.quantity;
        sel[idx] = { selected: remaining > 0, qty: Math.max(1, remaining) };
      });
      setSelectedItems(sel);
    } catch (e: any) {
      setFoundOrder(null);
      toast({ variant: "destructive", title: "تنبيه الفواتير", description: e.message || "لم يتم العثور على الفاتورة، يرجى التأكد من الرقم وإعادة المحاولة" });
    } finally {
      setSearching(false);
    }
  };

  const toggleItem = (idx: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [idx]: { ...prev[idx], selected: !prev[idx]?.selected },
    }));
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!foundOrder?.items) return;
    const next: Record<number, { selected: boolean; qty: number }> = {};
    foundOrder.items.forEach((item: any, idx: number) => {
      const remaining = item.remainingQuantity ?? item.quantity;
      if (remaining > 0) {
        next[idx] = { selected: checked, qty: Math.max(1, remaining) };
      }
    });
    setSelectedItems(next);
  };

  const setQty = (idx: number, qty: number) => {
    const item = foundOrder?.items?.[idx];
    const maxQty = item?.remainingQuantity ?? item?.quantity ?? 1;
    setSelectedItems(prev => ({
      ...prev,
      [idx]: { ...prev[idx], qty: Math.max(1, Math.min(qty, maxQty)) },
    }));
  };

  const selectedTotal = foundOrder?.items
    ? foundOrder.items.reduce((sum: number, item: any, idx: number) => {
        const sel = selectedItems[idx];
        if (!sel?.selected) return sum;
        return sum + item.unitPrice * (sel.qty ?? 1);
      }, 0)
    : 0;

  const createMut = useMutation({
    mutationFn: () => {
      const items = (foundOrder?.items ?? [])
        .map((item: any, idx: number) => {
          const sel = selectedItems[idx];
          if (!sel?.selected) return null;
          return {
            product_id: item.productId,
            product_name: item.productName,
            quantity: sel.qty,
            unit_price: item.unitPrice,
            order_item_id: item.id
          };
        })
        .filter(Boolean);

      return apiPost("/api/returns", {
        invoice_number: foundOrder.invoiceNumber,
        order_id: foundOrder.id,
        reason,
        payment_method: paymentMethod,
        notes,
        items,
      });
    },
    onSuccess: (data) => {
      toast({ title: "تم تسجيل المرتجع بنجاح" });
      onSuccess(data);
      onClose();
      setFoundOrder(null);
      setInvoiceSearch("");
      setSelectedItems({});
      setReason("طلب الزبون / إرجاع صنف");
    },
    onError: (e: any) => toast({ variant: "destructive", title: "فشل في تسجيل المرتجع", description: e.message }),
  });

  const canSubmit = foundOrder && !foundOrder.fullyReturned && Object.values(selectedItems).some((s: any) => s?.selected) && !createMut.isPending;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-bold"><RotateCcw className="w-6 h-6 text-primary" />مرتجع جديد — استرجاع فاتورة / قسم من فاتورة</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* ── بحث بالفاتورة ── */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border space-y-3">
            <h3 className="font-semibold text-sm text-foreground">ادخل رقم الفاتورة المراد إرجاعها:</h3>
            <div className="flex gap-2">
              <Input
                value={invoiceSearch}
                onChange={e => setInvoiceSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && executeSearch(invoiceSearch)}
                placeholder="أدخل رقم الفاتورة (مثال: 4 أو INV-0004)"
                className="flex-1 font-mono text-base"
              />
              <Button onClick={() => executeSearch(invoiceSearch)} disabled={searching || !invoiceSearch.trim()} className="gap-2">
                <Search className="w-4 h-4" />{searching ? "جاري البحث..." : "بحث عن الفاتورة"}
              </Button>
            </div>

            {foundOrder && (
              <div className="border border-border rounded-xl overflow-hidden mt-3 bg-card shadow-sm">
                <div className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b gap-2 ${foundOrder.fullyReturned ? "bg-red-500/10" : foundOrder.partiallyReturned ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-black text-primary">{foundOrder.invoiceNumber}</span>
                      <Badge variant={foundOrder.fullyReturned ? "destructive" : foundOrder.partiallyReturned ? "outline" : "default"}>
                        {foundOrder.fullyReturned ? "مرتجع بالكامل" : foundOrder.partiallyReturned ? "مرتجع جزئياً" : "فاتورة نشطة"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span><strong>الكاشير صاحب الفاتورة:</strong> {foundOrder.cashierName}</span>
                      <span><strong>التاريخ:</strong> {new Date(foundOrder.createdAt).toLocaleString("ar-SA")}</span>
                      {foundOrder.customerName && <span><strong>العميل:</strong> {foundOrder.customerName}</span>}
                      {foundOrder.orderType && <span><strong>نوع الطلب:</strong> {foundOrder.orderType}</span>}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-xs text-muted-foreground">إجمالي الفاتورة الأصلية</div>
                    <div className="font-mono font-black text-xl text-foreground">{fmt(foundOrder.total)}</div>
                  </div>
                </div>

                {foundOrder.previousReturns && foundOrder.previousReturns.length > 0 && (
                  <div className="p-3 bg-amber-500/5 border-b text-xs space-y-1 text-amber-900 dark:text-amber-200">
                    <div className="font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" />سجل المرتجعات السابقة لهذه الفاتورة:</div>
                    {foundOrder.previousReturns.map((pr: any) => (
                      <div key={pr.id} className="flex justify-between pr-4">
                        <span>سند رقم: {pr.return_number} ({pr.reason ?? "مرتجع"}) بواسطة {pr.processed_by}</span>
                        <span className="font-mono font-semibold text-destructive">-{fmt(pr.total_refund)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {foundOrder.fullyReturned ? (
                  <div className="p-6 text-center text-destructive font-bold flex flex-col items-center justify-center gap-2">
                    <AlertTriangle className="w-8 h-8 text-destructive animate-bounce" />
                    تم إرجاع جميع أصناف هذه الفاتورة بالكامل مسبقاً، ولا توجد كميات متبقية للإرجاع.
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground">حدد الأصناف والكمية المراد إرجاعها:</h4>
                      <Button variant="ghost" size="sm" onClick={() => toggleSelectAll(true)} className="text-xs text-primary">تحديد الكل (إرجاع الفاتورة كاملة)</Button>
                    </div>

                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/60 border-b text-xs font-bold text-muted-foreground">
                          <tr>
                            <th className="p-2 text-center w-10">اختر</th>
                            <th className="p-2 text-right">اسم الصنف</th>
                            <th className="p-2 text-center">الكمية الأصلية</th>
                            <th className="p-2 text-center">الكمية المرتجعة سابقاً</th>
                            <th className="p-2 text-center">المتبقي للإرجاع</th>
                            <th className="p-2 text-center w-28">الكمية المراد إرجاعها</th>
                            <th className="p-2 text-left">سعر الوحدة</th>
                            <th className="p-2 text-left">إجمالي المسترد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {(foundOrder.items ?? []).map((item: any, idx: number) => {
                            const sel = selectedItems[idx];
                            const remaining = item.remainingQuantity ?? item.quantity;
                            const isFullyReturnedItem = remaining <= 0;

                            return (
                              <tr key={idx} className={`hover:bg-muted/20 ${sel?.selected ? "bg-primary/5" : ""} ${isFullyReturnedItem ? "opacity-50 bg-muted/40" : ""}`}>
                                <td className="p-2 text-center">
                                  <Checkbox
                                    checked={sel?.selected ?? false}
                                    disabled={isFullyReturnedItem}
                                    onCheckedChange={() => toggleItem(idx)}
                                  />
                                </td>
                                <td className="p-2 font-semibold text-foreground">
                                  {item.productName}
                                  {isFullyReturnedItem && <Badge variant="secondary" className="mr-2 text-[10px]">مُرجع بالكامل</Badge>}
                                </td>
                                <td className="p-2 text-center font-mono">{item.quantity}</td>
                                <td className="p-2 text-center font-mono text-destructive">{item.returnedQuantity ?? 0}</td>
                                <td className="p-2 text-center font-mono font-bold text-emerald-600">{remaining}</td>
                                <td className="p-2 text-center">
                                  <Input
                                    type="number"
                                    value={sel?.qty ?? remaining}
                                    min={1}
                                    max={remaining}
                                    disabled={!sel?.selected || isFullyReturnedItem}
                                    onChange={e => setQty(idx, Number(e.target.value))}
                                    className="w-20 h-8 text-center font-bold font-mono text-sm mx-auto"
                                  />
                                </td>
                                <td className="p-2 text-left font-mono text-xs">{fmt(item.unitPrice)}</td>
                                <td className="p-2 text-left font-mono font-black text-destructive">
                                  {fmt(item.unitPrice * (sel?.selected ? (sel?.qty ?? remaining) : 0))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t font-bold text-base">
                      <span>إجمالي المبلغ المسترد للعميل:</span>
                      <span className="text-destructive font-mono font-black text-xl">{fmt(selectedTotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── تفاصيل المرتجع ── */}
          {foundOrder && !foundOrder.fullyReturned && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 border rounded-xl">
              <div>
                <label className="text-sm font-medium text-foreground">سبب الإرجاع</label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: إرجاع قسم من الفاتورة / طلب الزبون" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">طريقة استرداد المبلغ</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقداً (من صندوق الكاشير)</SelectItem>
                    <SelectItem value="card">شبكة (بطاقة بنكية)</SelectItem>
                    <SelectItem value="credit">رصيد حساب للعميل (آجل)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="text-sm font-medium text-foreground">ملاحظات إضافية</label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات اختيارية..." className="mt-1" />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => createMut.mutate()} disabled={!canSubmit} className="gap-2 bg-destructive hover:bg-destructive/90 text-white">
            <RotateCcw className="w-4 h-4" />تأكيد وتسجيل المرتجع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── نافذة طباعة وتفاصيل المرتجع ─── */
function ViewReturnDialog({ ret, onClose }: { ret: any; onClose: () => void }) {
  if (!ret) return null;
  const pmLabel: Record<string, string> = { cash: "نقداً", card: "شبكة", credit: "رصيد حساب للعميل" };
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={!!ret} onOpenChange={onClose}>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader className="no-print"><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />سند مرتجع مبيعات — {ret.return_number}</DialogTitle></DialogHeader>

        {/* Printable Receipt Layout */}
        <div ref={printRef} className="space-y-4 p-4 border rounded-xl bg-card text-card-foreground print-content">
          <div className="text-center border-b pb-3 space-y-1">
            <div className="flex justify-center mb-1"><AppLogo className="h-12 w-auto object-contain" /></div>
            <h2 className="text-lg font-black tracking-wide">مطعم ومطبخ إتقان</h2>
            <p className="text-xs text-muted-foreground">سند إرجاع مبيعات معتمد / Sales Return Voucher</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs border-b pb-3">
            <div><span className="text-muted-foreground">رقم سند المرتجع: </span><span className="font-mono font-bold text-primary">{ret.return_number}</span></div>
            <div><span className="text-muted-foreground">رقم الفاتورة الأصلية: </span><span className="font-mono font-bold">{ret.invoice_number}</span></div>
            <div><span className="text-muted-foreground">الكاشير صاحب الفاتورة: </span><span className="font-semibold">{ret.original_cashier_name ?? "شعيب"}</span></div>
            <div><span className="text-muted-foreground">موظف الإرجاع: </span><span className="font-semibold">{ret.cashier_name}</span></div>
            <div><span className="text-muted-foreground">تاريخ الإرجاع: </span><span className="font-mono">{new Date(ret.created_at).toLocaleString("ar-SA")}</span></div>
            <div><span className="text-muted-foreground">طريقة الاسترداد: </span><span className="font-semibold">{pmLabel[ret.payment_method] ?? ret.payment_method}</span></div>
            {ret.customer_name && <div className="col-span-2"><span className="text-muted-foreground">اسم العميل: </span><span className="font-semibold">{ret.customer_name}</span></div>}
            {ret.reason && <div className="col-span-2"><span className="text-muted-foreground">سبب الإرجاع: </span><span className="font-semibold">{ret.reason}</span></div>}
          </div>

          <div className="overflow-hidden border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted/70 font-bold border-b">
                <tr>
                  <th className="text-right p-2">اسم الصنف المرتجع</th>
                  <th className="text-center p-2">الكمية</th>
                  <th className="text-left p-2">سعر الوحدة</th>
                  <th className="text-left p-2">المبلغ المسترد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(ret.items ?? []).map((it: any) => (
                  <tr key={it.id}>
                    <td className="p-2 font-medium">{it.product_name}</td>
                    <td className="p-2 text-center font-mono font-bold">{it.quantity}</td>
                    <td className="p-2 text-left font-mono">{fmt(it.unit_price)}</td>
                    <td className="p-2 text-left font-mono font-bold text-destructive">{fmt(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2 border-t font-black text-base">
            <span>إجمالي المبلغ المسترد:</span>
            <span className="text-destructive font-mono text-xl">{fmt(ret.total_refund)}</span>
          </div>

          {ret.notes && (
            <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border">
              <strong>ملاحظات:</strong> {ret.notes}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-center text-[10px] text-muted-foreground pt-4 border-t">
            <div>
              <div className="mb-6 font-semibold">توقيع واستلام العميل</div>
              <div className="border-b w-3/4 mx-auto border-dashed"></div>
            </div>
            <div>
              <div className="mb-6 font-semibold">توقيع المحاسب / الكاشير</div>
              <div className="border-b w-3/4 mx-auto border-dashed"></div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 no-print">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" />طباعة السند</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── صناديق الكاشيرين ─── */
function CashierBoxes() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const { data, isLoading } = useQuery({
    queryKey: ["cashier-boxes", date],
    queryFn: () => apiGet(`/api/cashier-boxes?date=${date}`),
  });

  const box = (data as any)?.mainBox;
  const cashiers = (data as any)?.cashiers ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">تاريخ الصندوق:</label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
      ) : (
        <>
          {/* الصندوق الرئيسي */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-2 border-primary/30 col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />الصندوق الرئيسي — {date}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground">إجمالي المبيعات</div>
                    <div className="text-xl font-bold text-primary">{fmt(box?.total)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">إجمالي المرتجعات</div>
                    <div className="text-xl font-bold text-destructive">-{fmt(box?.returnsTotal)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">الصافي</div>
                    <div className="text-2xl font-black text-green-600">{fmt(box?.net)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* صناديق الكاشيرين */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />صناديق الكاشيرين
            </h3>
            <div className="bg-card rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-right p-3 font-semibold">الكاشير</th>
                    <th className="text-right p-3 font-semibold">المبيعات</th>
                    <th className="text-right p-3 font-semibold">عدد الفواتير</th>
                    <th className="text-right p-3 font-semibold">المرتجعات</th>
                    <th className="text-right p-3 font-semibold">الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cashiers.map((c: any) => (
                    <tr key={c.userId} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3 font-mono text-primary">{fmt(c.ordersTotal)}</td>
                      <td className="p-3 text-center">{c.ordersCount}</td>
                      <td className="p-3 font-mono text-destructive">-{fmt(c.returnsTotal)}</td>
                      <td className="p-3 font-mono font-bold text-green-700">{fmt(c.net)}</td>
                    </tr>
                  ))}
                  {cashiers.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد بيانات لهذا اليوم</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Returns() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [initialInvoice, setInitialInvoice] = useState("");
  const [viewRet, setViewRet] = useState<any>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invParam = urlParams.get("invoice") || urlParams.get("invoiceNumber") || urlParams.get("q") || urlParams.get("orderId");
    if (invParam) {
      setInitialInvoice(invParam);
      setShowNew(true);
    }
  }, []);

  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (search) params.set("search", search);

  const { data: returns_ = [], isLoading } = useQuery({ queryKey: ["returns", startDate, endDate, search], queryFn: () => apiGet(`/api/returns?${params}`) });
  const { data: summary } = useQuery({ queryKey: ["returns-summary"], queryFn: () => apiGet("/api/returns-summary") });

  const delMut = useMutation({
    mutationFn: (id: number) => apiDel(`/api/returns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["returns"] }); qc.invalidateQueries({ queryKey: ["returns-summary"] }); toast({ title: "تم حذف المرتجع" }); },
    onError: () => toast({ variant: "destructive", title: "فشل في الحذف" }),
  });

  const pmLabel: Record<string, string> = { cash: "نقداً", card: "شبكة", credit: "رصيد" };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2"><RotateCcw className="w-7 h-7 text-primary" />إدارة المرتجعات والمردودات</h1>
            <p className="text-xs text-muted-foreground mt-0.5">معالجة استرجاع الفواتير الكاملة والجزئية مع الربط المباشر بجميع أقسام النظام ومستودعاته</p>
          </div>
          <Button onClick={() => { setInitialInvoice(""); setShowNew(true); }} className="gap-2 bg-primary hover:bg-primary/90"><Plus className="w-4 h-4" />إصدار مرتجع جديد</Button>
        </div>

        <Tabs defaultValue="returns">
          <TabsList>
            <TabsTrigger value="returns" className="gap-1.5"><RotateCcw className="w-4 h-4" />جدول المرتجعات المعتمدة</TabsTrigger>
            <TabsTrigger value="boxes" className="gap-1.5"><DollarSign className="w-4 h-4" />صناديق الكاشيرين والورديات</TabsTrigger>
          </TabsList>

          <TabsContent value="returns" className="space-y-4 mt-4">
            {/* إحصائيات */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-600" />مرتجعات اليوم</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-black">{((summary as any)?.todayCount ?? 0)} عملية</div>
                  <div className="text-sm text-destructive font-mono font-bold mt-1">-{fmt((summary as any)?.todayTotal)}</div>
                </CardContent>
              </Card>
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-blue-600" />مرتجعات الشهر الجاري</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-black">{((summary as any)?.monthCount ?? 0)} عملية</div>
                  <div className="text-sm text-destructive font-mono font-bold mt-1">-{fmt((summary as any)?.monthTotal)}</div>
                </CardContent>
              </Card>
              <Card className="border-purple-500/20 bg-purple-500/5">
                <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2"><Package className="w-4 h-4 text-purple-600" />إجمالي السجلات الكلية</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-black">{((summary as any)?.totalCount ?? 0)} سند مرتجع</div></CardContent>
              </Card>
            </div>

            {/* فلاتر البحث */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-card p-3 border rounded-xl">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم المرتجع أو رقم الفاتورة..." className="w-full sm:w-64" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">من:</span>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
                <span className="text-xs text-muted-foreground">إلى:</span>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
              </div>
              {(startDate || endDate || search) && (
                <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setSearch(""); }}>تفريغ الفلاتر</Button>
              )}
            </div>

            {/* جدول المرتجعات */}
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground">جاري تحميل بيانات المرتجعات...</div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 border-b border-border text-xs">
                    <tr>
                      <th className="text-right p-3 font-bold">رقم سند المرتجع</th>
                      <th className="text-right p-3 font-bold">الفاتورة الأصلية</th>
                      <th className="text-right p-3 font-bold">تاريخ الإرجاع</th>
                      <th className="text-right p-3 font-bold">سبب الإرجاع</th>
                      <th className="text-right p-3 font-bold">طريقة الاسترداد</th>
                      <th className="text-right p-3 font-bold">المبلغ المسترد</th>
                      <th className="text-right p-3 font-bold">صاحب الفاتورة</th>
                      <th className="text-right p-3 font-bold">كاشير الإرجاع</th>
                      <th className="p-3 w-28 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(returns_ as any[]).map((r: any) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="p-3 font-mono font-bold text-xs text-primary">{r.return_number}</td>
                        <td className="p-3 font-mono font-semibold text-xs">{r.invoice_number}</td>
                        <td className="p-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString("ar-SA")}</td>
                        <td className="p-3 font-medium">{r.reason ?? "—"}</td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{pmLabel[r.payment_method] ?? r.payment_method}</Badge></td>
                        <td className="p-3 font-mono font-bold text-destructive text-sm">-{fmt(r.total_refund)}</td>
                        <td className="p-3 text-xs text-muted-foreground font-semibold">{r.original_cashier_name ?? "شعيب"}</td>
                        <td className="p-3 text-xs text-muted-foreground">{r.cashier_name}</td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="icon" title="معاينة وطباعة السند" onClick={() => setViewRet(r)}><Printer className="w-4 h-4 text-primary" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" title="حذف المرتجع" onClick={() => confirm(`هل أنت تأكد من حذف سند المرتجع رقم ${r.return_number}؟`) && delMut.mutate(r.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(returns_ as any[]).length === 0 && (
                      <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">لا توجد سجلات مرتجعات مطابقة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="boxes" className="mt-4">
            <CashierBoxes />
          </TabsContent>
        </Tabs>

        <NewReturnDialog
          open={showNew}
          initialInvoice={initialInvoice}
          onClose={() => { setShowNew(false); setInitialInvoice(""); }}
          onSuccess={(createdReturn) => {
            qc.invalidateQueries({ queryKey: ["returns"] });
            qc.invalidateQueries({ queryKey: ["returns-summary"] });
            if (createdReturn) {
              setViewRet(createdReturn);
            }
          }}
        />
        <ViewReturnDialog ret={viewRet} onClose={() => setViewRet(null)} />
      </div>
    </AdminLayout>
  );
}

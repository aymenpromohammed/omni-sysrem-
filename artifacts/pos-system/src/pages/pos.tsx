import React, { useState, useRef, useCallback, useEffect } from "react";
import { flushSync } from "react-dom";
import { PosLayout } from "@/components/pos-layout";
import {
  useGetProducts, useGetCategories, useCreateOrder, useGetSettings,
  useGetReceiptCopyConfigs, useGetDepartmentPrintConfigs, useCreatePrintLog,
  usePrintReceiptDirect, useGetPrinterSettings,
} from "@workspace/api-client-react";
import type { Product, OrderItemInput, Order } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, Printer, ShoppingCart, X, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReceiptPreview, MasterReceiptSlip, DeptReceiptSlip } from "@/components/receipt";
import { getOfflinePrintQueue, addOfflinePrintJob, removeOfflinePrintJob } from "@/lib/printQueue";
import { qzService } from "@/lib/qzTrayService";
import { useQZTray } from "@/hooks/useQZTray";
import { QZTrayWidget } from "@/components/QZTrayWidget";

type CartItem = {
  product: Product;
  quantity: number;
};

type OrderType = "dine-in" | "takeout" | "delivery";

type PrintPage =
  | { type: "master"; copyLabel: string }
  | { type: "dept"; dept: any; items: any[] };

type PrintJob =
  | { kind: "browser-master"; copyLabel: string; logData: any }
  | { kind: "browser-dept";   dept: any; items: any[]; logData: any }
  | { kind: "direct-dept";    dept: any; items: any[]; logData: any };

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  "dine-in": "محلي",
  "takeout": "سفري",
  "delivery": "توصيل",
};

function generateReceiptText(order: Order, settings: any, cashierName: string, printerSettings?: any): string {
  const lines: string[] = [];
  const w = Number(printerSettings?.charactersPerLine || settings?.charactersPerLine || 40);
  
  // Left margin in spaces
  const leftMarginSpaces = Math.max(0, Math.floor((printerSettings?.leftMargin ?? 0) / 1.5));
  const padLeft = " ".repeat(leftMarginSpaces);

  const center = (s: string) => {
    if (s.length >= w) return s;
    const padLen = Math.floor((w - s.length) / 2);
    return " ".repeat(padLen) + s;
  };
  const line = (ch = "-") => ch.repeat(w);
  const cleanInvoiceNumber = order.invoiceNumber.replace(/^INV-0*/, "") || "0";

  // Top margin in newlines
  const topMarginLines = Math.max(0, Math.floor((printerSettings?.topMargin ?? 0) / 4));
  for (let i = 0; i < topMarginLines; i++) {
    lines.push("");
  }

  lines.push(center(settings?.businessName ?? "المطعم"));
  if (settings?.address) lines.push(center(settings.address));
  lines.push(line("."));
  lines.push(center("فاتورة خاصة بالزبون"));
  lines.push(center(`الرقم المسلسل: [ ${cleanInvoiceNumber} ]`));
  lines.push(line("."));
  const d = new Date(order.createdAt);
  const dateStr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  const timeStr = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  lines.push(`التاريخ: ${dateStr}  ${timeStr}`);
  lines.push(`نوع الطلب: ${ORDER_TYPE_LABELS[order.orderType ?? "dine-in"] ?? "محلي"}`);
  lines.push(`الطاولة: ${order.tableNumber || "0"}    ط`);
  lines.push(line("-"));
  
  // Dynamic columns calculation to prevent wrapping
  const priceW = Math.max(8, Math.floor(w * 0.25));
  const qtyW = Math.max(4, Math.floor(w * 0.15));
  const nameW = w - priceW - qtyW;

  lines.push(`${"الصنف".padEnd(nameW)}${"الكمية".padStart(qtyW)}${"السعر".padStart(priceW)}`);
  lines.push(line("-"));
  for (const item of order.items ?? []) {
    const name = item.productName.substring(0, Math.max(5, nameW - 1)).padEnd(nameW);
    const qty = String(item.quantity).padStart(qtyW);
    const price = String(item.unitPrice.toLocaleString()).padStart(priceW);
    lines.push(`${name}${qty}${price}`);
  }
  lines.push(line("-"));
  
  const totalStr = `الإجمالي: ${order.total.toFixed(2)} ${settings?.currency ?? "ريال"}`;
  lines.push(totalStr.padStart(w));
  lines.push(line("="));
  if (cashierName) lines.push(center(`اسم الكاشير: ${cashierName}`));
  if (order.note) lines.push(`ملاحظات: ${order.note}`);
  lines.push(line("-"));
  lines.push(center("الطلب لا يمكن استرجاعه أو إلغاؤه"));
  if (settings?.phone) lines.push(center(`أرقام التواصل: ${settings.phone}`));
  
  // Bottom margin in newlines
  const bottomMarginLines = Math.max(3, Math.floor((printerSettings?.bottomMargin ?? 8) / 2));
  for (let i = 0; i < bottomMarginLines; i++) {
    lines.push("");
  }

  // Prepend left margin to all lines
  return lines.map(l => l ? padLeft + l : l).join("\n");
}

function generateDeptReceiptText(order: Order, dept: any, items: any[], settings: any, printerSettings?: any): string {
  const lines: string[] = [];
  const w = Number(printerSettings?.charactersPerLine || settings?.charactersPerLine || 32);

  // Left margin in spaces
  const leftMarginSpaces = Math.max(0, Math.floor((printerSettings?.leftMargin ?? 0) / 1.5));
  const padLeft = " ".repeat(leftMarginSpaces);

  const center = (s: string) => {
    if (s.length >= w) return s;
    const padLen = Math.floor((w - s.length) / 2);
    return " ".repeat(padLen) + s;
  };
  const line = (ch = "-") => ch.repeat(w);
  const cleanInvoiceNumber = order.invoiceNumber.replace(/^INV-0*/, "") || "0";

  // Top margin in newlines
  const topMarginLines = Math.max(0, Math.floor((printerSettings?.topMargin ?? 0) / 4));
  for (let i = 0; i < topMarginLines; i++) {
    lines.push("");
  }

  lines.push(center(settings?.businessName ?? "المطعم"));
  lines.push(center(`قسم: ${dept.categoryName}`));
  lines.push(line("."));
  lines.push(center(`أمر صرف رقم: [ ${cleanInvoiceNumber} ]`));
  lines.push(line("-"));
  const d = new Date(order.createdAt);
  const dateStr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
  lines.push(`التاريخ: ${dateStr}`);
  lines.push(`نوع الطلب: ${ORDER_TYPE_LABELS[order.orderType ?? "dine-in"] ?? "محلي"}`);
  lines.push(`الطاولة: ${order.tableNumber || "0"}    ط`);
  lines.push(line("="));
  
  // Dynamic column layout
  const qtyW = Math.max(4, Math.floor(w * 0.15));
  const nameW = w - qtyW;

  for (const item of items) {
    const name = item.productName.substring(0, Math.max(5, nameW - 1)).padEnd(nameW);
    const qty = `x${item.quantity}`.padStart(qtyW);
    lines.push(`${name}${qty}`);
  }
  lines.push(line("="));
  if (order.note) lines.push(`ملاحظات: ${order.note}`);
  
  // Bottom margin in newlines
  const bottomMarginLines = Math.max(3, Math.floor((printerSettings?.bottomMargin ?? 8) / 2));
  for (let i = 0; i < bottomMarginLines; i++) {
    lines.push("");
  }

  // Prepend left margin to all lines
  return lines.map(l => l ? padLeft + l : l).join("\n");
}

export default function Pos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: products = [] } = useGetProducts();
  const { data: categories = [] } = useGetCategories();
  const { data: settings } = useGetSettings();
  const { data: printerSettings } = useGetPrinterSettings();
  const { data: receiptCopies = [] } = useGetReceiptCopyConfigs();
  const { data: deptConfigs = [] } = useGetDepartmentPrintConfigs();
  const createOrderMutation = useCreateOrder();
  const createPrintLog = useCreatePrintLog();
  const printReceiptDirect = usePrintReceiptDirect();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [typedNumberBuffer, setTypedNumberBuffer] = useState("");
  const [selectedCartIndex, setSelectedCartIndex] = useState(0);
  const [isQtyEditing, setIsQtyEditing] = useState(false);
  const [qtyEditBuffer, setQtyEditBuffer] = useState("");
  const [lastEnterTimestamp, setLastEnterTimestamp] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [tableNumber, setTableNumber] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "mixed">("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [reprintReason, setReprintReason] = useState("");
  const [showReprintDialog, setShowReprintDialog] = useState(false);
  const [activePrintPage, setActivePrintPage] = useState<PrintPage | null>(null);

  // ── وجبات الموظفين ──
  const [mealMode, setMealMode] = useState(false);
  const [empNumInput, setEmpNumInput] = useState("");
  const [foundEmployee, setFoundEmployee] = useState<any>(null);
  const [showMealConfirm, setShowMealConfirm] = useState(false);
  const [lookingUpEmp, setLookingUpEmp] = useState(false);
  const [offlineJobsCount, setOfflineJobsCount] = useState(0);
  const [showQZTrayDialog, setShowQZTrayDialog] = useState(false);
  const qz = useQZTray();

  useEffect(() => {
    const updateCount = () => {
      setOfflineJobsCount(getOfflinePrintQueue().length);
    };
    updateCount();
    window.addEventListener("print-queue-updated", (e: any) => {
      setOfflineJobsCount(e.detail?.count ?? getOfflinePrintQueue().length);
    });

    // Background auto-retry worker every 20 seconds
    const interval = setInterval(async () => {
      const queue = getOfflinePrintQueue();
      if (queue.length === 0) return;

      let successCount = 0;
      for (const job of queue) {
        try {
          const res: any = await new Promise((resolve) => {
            printReceiptDirect.mutate(
              { data: { printerName: job.printerName, content: job.content, copies: job.copies } },
              {
                onSuccess: (data) => resolve(data),
                onError: (err) => resolve({ ok: false, message: err?.message }),
              }
            );
          });
          if (res && res.ok) {
            removeOfflinePrintJob(job.id);
            successCount++;
          }
        } catch (e) {
          break;
        }
      }

      if (successCount > 0) {
        toast({
          title: "🖨️ تم طباعة الفواتير المعلقة بنجاح",
          description: `تم إرسال ${successCount} فاتورة معلقة للطابعة بعد استعادة الاتصال بها.`
        });
      }
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const retryOfflineQueue = async () => {
    const queue = getOfflinePrintQueue();
    if (queue.length === 0) {
      toast({ title: "لا توجد فواتير معلقة" });
      return;
    }
    let successCount = 0;
    for (const job of queue) {
      try {
        const res: any = await new Promise((resolve) => {
          printReceiptDirect.mutate(
            { data: { printerName: job.printerName, content: job.content, copies: job.copies } },
            {
              onSuccess: (data) => resolve(data),
              onError: (err) => resolve({ ok: false, message: err?.message }),
            }
          );
        });
        if (res && res.ok) {
          removeOfflinePrintJob(job.id);
          successCount++;
        }
      } catch (e) {
        // continue
      }
    }

    if (successCount > 0) {
      toast({
        title: "🖨️ تم طباعة الفواتير المعلقة بنجاح",
        description: `تم إرسال ${successCount} فاتورة معلقة للطابعة بنجاح.`
      });
    } else {
      toast({
        variant: "destructive",
        title: "⚠️ تعذر الاتصال بالطابعة",
        description: "ما زالت الطابعة غير متصلة أو لا تستجيب. حاول مرة أخرى لاحقاً."
      });
    }
  };

  const taxRate = settings?.taxRate ?? 15;
  const currency = settings?.currency ?? "ريال";
  const autoPrintTrigger = settings?.autoPrintTrigger ?? "print_button";

  const filteredProducts = products.filter(p => {
    if (!p.active) return false;
    if (selectedCategory !== null && p.categoryId !== selectedCategory) return false;
    return true;
  });

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }, []);

  const changeQty = useCallback((productId: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? null : { ...i, quantity: newQty };
    }).filter(Boolean) as CartItem[]);
  }, []);

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const discountAmt = Math.min(discount, subtotal);
  const afterDiscount = subtotal - discountAmt;
  const taxAmt = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmt;

  // ── Keyboard Shortcuts Integration ──────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPayDialog) setShowPayDialog(false);
        if (showReceipt) setShowReceipt(false);
        if (showMealConfirm) { setShowMealConfirm(false); setFoundEmployee(null); }
        if (showReprintDialog) setShowReprintDialog(false);
        setTypedNumberBuffer("");
        setIsQtyEditing(false);
        return;
      }

      if (["F1", "F2", "F3", "F4", "F5", "F8"].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === "F1") {
        setTypedNumberBuffer("");
        return;
      }

      if (e.key === "F2") {
        if (cart.length > 0 && !showPayDialog && !showReceipt && !showMealConfirm) {
          handlePay();
        }
        return;
      }

      if (e.key === "F3") {
        if (cart.length > 0 && !showPayDialog && !showReceipt && !showMealConfirm) {
          setCart([]);
          setSelectedCartIndex(0);
          toast({ title: "🗑️ تم إفراغ السلة", description: "تم مسح جميع المنتجات من السلة" });
        }
        return;
      }

      if (e.key === "F4") {
        if (!showPayDialog && !showReceipt && !showMealConfirm) {
          const types: OrderType[] = ["dine-in", "takeout", "delivery"];
          const currentIndex = types.indexOf(orderType);
          const nextIndex = (currentIndex + 1) % types.length;
          setOrderType(types[nextIndex]);
          toast({ title: "📋 نوع الطلب", description: `تم التغيير إلى: ${ORDER_TYPE_LABELS[types[nextIndex]]}` });
        }
        return;
      }

      if (e.key === "F5") {
        if (!showPayDialog && !showReceipt && !showMealConfirm) {
          setMealMode(prev => {
            const newVal = !prev;
            if (newVal) setEmpNumInput("");
            return newVal;
          });
        }
        return;
      }

      if (e.key === "F8") {
        if (lastOrder) {
          handleReprint();
        } else {
          toast({ variant: "destructive", title: "لا يوجد طلب سابق لإعادة طباعته" });
        }
        return;
      }

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.getAttribute("contenteditable") === "true"
      );

      if (isInputFocused && !showPayDialog) return;

      if (showPayDialog && e.key === "Enter") {
        e.preventDefault();
        confirmPay();
        return;
      }

      // Arrow Up
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (cart.length > 0) {
          setIsQtyEditing(false);
          setSelectedCartIndex(prev => Math.max(0, prev - 1));
        }
        return;
      }

      // Arrow Down
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (cart.length > 0) {
          setIsQtyEditing(false);
          setSelectedCartIndex(prev => Math.min(cart.length - 1, prev + 1));
        }
        return;
      }

      // Side Arrows (ArrowLeft / ArrowRight) to toggle Qty Editing
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (cart.length > 0 && selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
          setIsQtyEditing(prev => {
            const next = !prev;
            if (next) {
              setQtyEditBuffer(String(cart[selectedCartIndex].quantity));
            }
            return next;
          });
        }
        return;
      }

      if (cart.length > 0) {
        const targetIdx = selectedCartIndex >= 0 && selectedCartIndex < cart.length ? selectedCartIndex : cart.length - 1;
        const targetItem = cart[targetIdx];
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          changeQty(targetItem.product.id, 1);
          return;
        } else if (e.key === "-") {
          e.preventDefault();
          changeQty(targetItem.product.id, -1);
          return;
        }
      }

      // Number keys (0-9)
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (isQtyEditing && cart.length > 0 && selectedCartIndex >= 0 && selectedCartIndex < cart.length) {
          const newBuf = qtyEditBuffer + e.key;
          setQtyEditBuffer(newBuf);
          const val = parseInt(newBuf);
          if (!isNaN(val) && val > 0) {
            const targetItem = cart[selectedCartIndex];
            const diff = val - targetItem.quantity;
            if (diff !== 0) {
              changeQty(targetItem.product.id, diff);
            }
          }
        } else {
          setTypedNumberBuffer(prev => prev + e.key);
        }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        if (isQtyEditing) {
          setQtyEditBuffer(prev => prev.slice(0, -1));
        } else {
          setTypedNumberBuffer(prev => prev.slice(0, -1));
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (typedNumberBuffer.trim()) {
          const num = parseInt(typedNumberBuffer.trim());
          const prod = products.find(p => p.number === num && p.active);
          if (prod) {
            addToCart(prod);
            setTypedNumberBuffer("");
          } else {
            toast({ variant: "destructive", title: "رقم الصنف غير موجود", description: `لم يتم العثور على أي منتج يحمل الرقم (${num})` });
            setTypedNumberBuffer("");
          }
        } else if (cart.length > 0) {
          const now = Date.now();
          if (now - lastEnterTimestamp < 600) {
            handlePay();
          }
          setLastEnterTimestamp(now);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [cart, orderType, lastOrder, showPayDialog, showReceipt, showMealConfirm, showReprintDialog, mealMode, typedNumberBuffer, selectedCartIndex, isQtyEditing, qtyEditBuffer, lastEnterTimestamp, changeQty, addToCart, products]);

  const handlePay = () => {
    if (cart.length === 0) return;
    setShowPayDialog(true);
  };

  const getDeptGroups = (order: Order) => {
    // تجميع عناصر الطلب حسب التصنيف بشكل إلزامي
    const categoryMap = new Map<number | string, {
      categoryId: number | null;
      categoryName: string | null;
      items: NonNullable<Order["items"]>;
      printOrder: number;
    }>();

    for (const item of order.items ?? []) {
      const key = item.categoryId ?? "__no_category__";
      if (!categoryMap.has(key)) {
        // ابحث عن إعداد قسم مطابق لهذا التصنيف (إن وُجد)
        const config = deptConfigs.find(d => d.categoryId === item.categoryId);
        categoryMap.set(key, {
          categoryId: item.categoryId ?? null,
          categoryName: item.categoryName ?? null,
          items: [],
          printOrder: config?.printOrder ?? 999,
        });
      }
      categoryMap.get(key)!.items.push(item);
    }

    // لكل تصنيف في الطلب، أنشئ مجموعة مع إعدادات القسم أو القيم الافتراضية
    return Array.from(categoryMap.values())
      .filter(g => g.items.length > 0)
      .sort((a, b) => a.printOrder - b.printOrder)
      .map(g => {
        const config = deptConfigs.find(d => d.categoryId === g.categoryId);
        return {
          dept: {
            id: config?.id ?? (g.categoryId ?? 0),
            categoryId: g.categoryId,
            categoryName: g.categoryName ?? "قسم",
            printerName: config?.printerName ?? null,
            copies: config?.copies ?? 1,
            enabled: true,
            printOrder: g.printOrder,
          },
          items: g.items,
        };
      });
  };

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  // ── طباعة صفحة واحدة عبر المتصفح (مع تطبيق إعدادات الطابعة) ────────
  const browserPrint = async (page: PrintPage) => {
    // تطبيق إعدادات الطابعة ديناميكياً قبل الطباعة
    const ps = printerSettings;
    const styleId = "__pos-dynamic-print__";
    document.getElementById(styleId)?.remove();
    if (ps) {
      const el = document.createElement("style");
      el.id = styleId;
      el.textContent = `
        @page { size: ${ps.paperWidth}mm auto; margin: 0; }
        .hidden-print-container, .print-page {
          width: ${ps.paperWidth}mm !important;
        }
        .receipt-slip {
          font-size: ${ps.fontSize}px !important;
          line-height: ${1 + (ps.lineSpacing ?? 2) / 10} !important;
          padding: ${ps.topMargin}mm ${ps.rightMargin}mm ${ps.bottomMargin}mm ${ps.leftMargin}mm !important;
        }
      `;
      document.head.appendChild(el);
    }

    flushSync(() => setActivePrintPage(page));
    
    // الانتظار الفعلي حتى تحميل الشعار وباقي الصور في نافذة الطباعة لتجنب الطباعة قبل تحميل الشعار
    await new Promise<void>(resolve => {
      const images = document.querySelectorAll("#receipt-print-area img");
      if (images.length === 0) {
        setTimeout(resolve, 150);
        return;
      }
      let loadedCount = 0;
      const onImageLoad = () => {
        loadedCount++;
        if (loadedCount === images.length) {
          setTimeout(resolve, 120); // تأخير إضافي لضمان ثبات الرسم
        }
      };
      images.forEach(img => {
        const htmlImg = img as HTMLImageElement;
        if (htmlImg.complete) {
          onImageLoad();
        } else {
          htmlImg.addEventListener("load", onImageLoad, { once: true });
          htmlImg.addEventListener("error", onImageLoad, { once: true });
        }
      });
    });

    window.print();
    setActivePrintPage(null);
    document.getElementById(styleId)?.remove();
  };

  // ── إرسال فاتورة قسم مباشرة عبر QZ Tray أو الطابعة الشبكية ───────────────────────
  const directPrint = async (order: Order, dept: any, items: any[], printerOverride?: string): Promise<boolean> => {
    const content = generateDeptReceiptText(order, dept, items, settings, printerSettings);
    const printerName = printerOverride ?? dept.printerName;

    // 1. Try QZ Tray if connected
    if (qz.connected) {
      const qzRes = await qz.printData(printerName, content, 1, true);
      if (qzRes.success) {
        return true;
      }
    }

    // 2. Fallback to backend direct print API
    return new Promise<boolean>(resolve => {
      printReceiptDirect.mutate(
        { data: { printerName, content, copies: 1 } },
        {
          onSuccess: (res) => {
            if (!res || !res.ok) {
              console.error(`Direct print failed for dept ${dept.categoryName}:`, res?.message);
              addOfflinePrintJob({
                printerName: printerName || "Default",
                content,
                orderId: order.id,
                invoiceNumber: order.invoiceNumber,
                receiptType: "department",
                departmentName: dept.categoryName ?? "قسم",
                copies: 1,
              });
              resolve(false);
            } else {
              resolve(true);
            }
          },
          onError: (err: any) => {
            console.error(`Direct print error for dept ${dept.categoryName}:`, err);
            addOfflinePrintJob({
              printerName: printerName || "Default",
              content,
              orderId: order.id,
              invoiceNumber: order.invoiceNumber,
              receiptType: "department",
              departmentName: dept.categoryName ?? "قسم",
              copies: 1,
            });
            resolve(false);
          },
        }
      );
    });
  };

  // ── طباعة صامتة كاملة عبر QZ Tray أو الطابعة الشبكية (بدون نافذة حوار) ───────────
  const silentPrintAll = async (order: Order): Promise<boolean> => {
    const mainPrinter = (printerSettings as any)?.mainPrinterName as string | null | undefined;
    const copiesCount = settings?.masterCopiesCount ?? 1;
    const enabledCopies = receiptCopies.filter(c => c.enabled);
    const deptGroups = getDeptGroups(order);

    const mainPrinterName = mainPrinter || "";
    let overallSuccess = true;

    // 1) الفاتورة الرئيسية → إرسال لطابعة الفاتورة الرئيسية
    const masterText = generateReceiptText(order, settings, user?.name ?? "", printerSettings);
    for (let i = 0; i < copiesCount; i++) {
      const copyLabel = enabledCopies[i]?.label ?? `نسخة ${i + 1}`;
      let isOk = false;

      // Try QZ Tray first
      if (qz.connected) {
        const qzRes = await qz.printData(mainPrinterName, masterText, 1, true);
        isOk = qzRes.success;
      }

      if (!isOk) {
        try {
          const res = await new Promise<any>(resolve => {
            printReceiptDirect.mutate(
              { data: { printerName: mainPrinterName, content: masterText, copies: 1 } },
              {
                onSuccess: (data) => resolve(data),
                onError: (err: any) => resolve({ ok: false, message: err?.message }),
              }
            );
          });
          isOk = !!(res && res.ok);
        } catch (err: any) {
          isOk = false;
        }
      }

      if (!isOk) {
        overallSuccess = false;
        addOfflinePrintJob({
          printerName: mainPrinterName || "Default",
          content: masterText,
          orderId: order.id,
          invoiceNumber: order.invoiceNumber,
          receiptType: "master",
          departmentName: copyLabel,
          copies: 1,
        });
      }

      createPrintLog.mutate({ data: {
        orderId: order.id, invoiceNumber: order.invoiceNumber,
        receiptType: "master", departmentName: copyLabel,
        printerName: mainPrinterName || "الطابعة الافتراضية", copies: 1, 
        status: isOk ? "success" : "failed", reprintCount: 0,
      }});
      if (i < copiesCount - 1) await sleep(200);
    }

    // 2) فواتير الأقسام → كل قسم لطابعته
    for (const { dept, items } of deptGroups) {
      if (!items.length) continue;
      if (!dept.printerName || !dept.printerName.trim()) {
        continue;
      }
      for (let c = 0; c < dept.copies; c++) {
        const printedOk = await directPrint(order, dept, items, dept.printerName);
        if (!printedOk) overallSuccess = false;

        createPrintLog.mutate({ data: {
          orderId: order.id, invoiceNumber: order.invoiceNumber,
          receiptType: "department", departmentName: dept.categoryName ?? "قسم",
          printerName: dept.printerName, copies: 1, 
          status: printedOk ? "success" : "failed", reprintCount: 0,
        }});
        if (c < dept.copies - 1) await sleep(200);
      }
    }

    return overallSuccess;
  };

  // ── دالة الطباعة الرئيسية (Queue تسلسلي) ──────────────────────────
  const triggerDirectPrint = async (order: Order, isReprint = false, reprintReasonText?: string) => {
    const enabledCopies = receiptCopies.filter(c => c.enabled);
    const copiesCount = settings?.masterCopiesCount ?? 2;
    const deptGroups = getDeptGroups(order);

    // ── بناء قائمة الانتظار بالترتيب ──
    const queue: PrintJob[] = [];

    // 1) الفاتورة الرئيسية — نسخة لكل تصنيف مفعّل
    for (let i = 0; i < copiesCount; i++) {
      const copyLabel = enabledCopies[i]?.label ?? `نسخة ${i + 1}`;
      queue.push({
        kind: "browser-master",
        copyLabel,
        logData: {
          orderId: order.id,
          invoiceNumber: order.invoiceNumber,
          receiptType: isReprint ? "reprint" : "master",
          departmentName: copyLabel,
          printerName: null,
          copies: 1,
          status: "success",
          reprintReason: isReprint ? (reprintReasonText ?? "إعادة طباعة") : null,
          reprintCount: isReprint ? 1 : 0,
        },
      });
    }

    // 2) فاتورة مستقلة لكل قسم موجود في الطلب
    for (const { dept, items } of deptGroups) {
      if (!items.length) continue;
      const logData = {
        orderId: order.id,
        invoiceNumber: order.invoiceNumber,
        receiptType: "department" as const,
        departmentName: dept.categoryName ?? "قسم",
        printerName: dept.printerName ?? null,
        copies: dept.copies,
        status: "success" as const,
        reprintCount: 0,
      };
      for (let c = 0; c < dept.copies; c++) {
        if (dept.printerName) {
          queue.push({ kind: "direct-dept", dept, items, logData });
        } else {
          queue.push({ kind: "browser-dept", dept, items, logData });
        }
      }
    }

    // ── تنفيذ Queue بالترتيب: فاتورة → انتهت → فاتورة التالية ──
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];

      // تسجيل الطباعة
      createPrintLog.mutate({ data: job.logData });

      if (job.kind === "browser-master") {
        await browserPrint({ type: "master", copyLabel: job.copyLabel });
      } else if (job.kind === "browser-dept") {
        await browserPrint({ type: "dept", dept: job.dept, items: job.items });
      } else if (job.kind === "direct-dept") {
        const success = await directPrint(order, job.dept, job.items);
        if (!success) {
          toast({
            variant: "destructive",
            title: `⚠️ فشلت الطباعة المباشرة لقسم ${job.dept.categoryName}`,
            description: "سيتم تحويل الطباعة إلى المتصفح تلقائياً لطباعة هذا القسم..."
          });
          await browserPrint({ type: "dept", dept: job.dept, items: job.items });
        }
      }

      // تأخير قصير بين كل وظيفة لضمان الاستقرار
      if (i < queue.length - 1) await sleep(250);
    }
  };

  // ── بحث عن موظف برقمه ──
  const lookupEmployee = async () => {
    if (!empNumInput.trim()) return;
    setLookingUpEmp(true);
    try {
      const token = localStorage.getItem("pos_token") ?? "";
      const resp = await fetch(`/api/hr/employees/by-number/${encodeURIComponent(empNumInput.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(await resp.text());
      const emp = await resp.json();
      setFoundEmployee(emp);
      setShowMealConfirm(true);
    } catch (e: any) {
      toast({ variant: "destructive", title: "لم يتم العثور على الموظف", description: "تحقق من رقم الموظف" });
    } finally {
      setLookingUpEmp(false);
    }
  };

  // ── تأكيد تسجيل الوجبة ──
  const confirmMealDeduction = () => {
    if (!foundEmployee || cart.length === 0) return;
    const mealNote = `وجبة موظف: ${foundEmployee.name} (${foundEmployee.employee_number})`;

    const items: OrderItemInput[] = cart.map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.product.price,
    }));

    createOrderMutation.mutate({
      data: {
        items,
        paymentMethod: "cash",
        subtotal,
        discount: discountAmt,
        tax: taxAmt,
        total,
        cashAmount: total,
        cardAmount: null,
        userId: user!.id,
        orderType: "takeout",
        tableNumber: null,
        note: mealNote,
      }
    }, {
      onSuccess: async (order) => {
        // تسجيل خصم الوجبة في سجل الموظف
        const token = localStorage.getItem("pos_token") ?? "";
        await fetch("/api/hr/meal-deductions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            employee_id: foundEmployee.id,
            employee_name: foundEmployee.name,
            employee_number: foundEmployee.employee_number,
            order_id: order.id,
            invoice_number: order.invoiceNumber,
            amount: total,
            notes: `${cart.map(i => i.product.name).join(", ")}`,
          }),
        });
        toast({ title: "✅ تم تسجيل وجبة الموظف", description: `${foundEmployee.name} — ${order.invoiceNumber}` });
        setLastOrder(order);
        setShowMealConfirm(false);
        setCart([]);
        setDiscount(0);
        setEmpNumInput("");
        setFoundEmployee(null);
        setShowReceipt(true);
      },
      onError: () => { toast({ variant: "destructive", title: "فشل في تسجيل الوجبة" }); },
    });
  };

  const confirmPay = () => {
    const items: OrderItemInput[] = cart.map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.product.price,
    }));

    createOrderMutation.mutate({
      data: {
        items,
        paymentMethod,
        subtotal,
        discount: discountAmt,
        tax: taxAmt,
        total,
        cashAmount: paymentMethod === "cash" ? total : paymentMethod === "mixed" ? parseFloat(cashGiven) || 0 : null,
        cardAmount: paymentMethod === "card" ? total : paymentMethod === "mixed" ? total - (parseFloat(cashGiven) || 0) : null,
        userId: user!.id,
        orderType,
        tableNumber: tableNumber || null,
        note: note || null,
      }
    }, {
      onSuccess: (order) => {
        setLastOrder(order);
        setShowPayDialog(false);
        setCart([]);
        setDiscount(0);
        setCashGiven("");
        setPaymentMethod("cash");
        setNote("");
        setTableNumber("");

        const printMode = (settings as any)?.printMode ?? "browser";
        const mainPrinter = (printerSettings as any)?.mainPrinterName as string | null | undefined;
        const hasMainPrinter = !!(mainPrinter && mainPrinter.trim());

        if (printMode === "browser" || !hasMainPrinter) {
          // إذا كانت طريقة الطباعة هي المتصفح، أو لم يتم تحديد طابعة صامتة رئيسية، نستخدم طباعة المتصفح الرسومية الجميلة تلقائياً لتطبيق الشعار والشكل المثالي
          toast({ title: "✅ تم تأكيد الطلب", description: "جاري تحضير وإرسال الفاتورة للطباعة..." });
          setTimeout(() => {
            triggerDirectPrint(order);
          }, 500);
        } else {
          // طباعة صامتة فورية وتلقائية بالترتيب لجميع الفواتير دون أي نوافذ منبثقة أو حوارات معاينة
          toast({ title: "✅ تم تأكيد الطلب وطباعة الفاتورة", description: `${order.invoiceNumber} — جاري إرسال الأوامر للطباعة الصامتة...` });
          silentPrintAll(order).then((success) => {
            if (success) {
              toast({ title: "🖨️ تم إرسال الطباعة المباشرة", description: "تم إرسال كافة فواتير الأقسام والعميل للطابعة بنجاح" });
            } else {
              toast({
                variant: "destructive",
                title: "⚠️ تنبيه الطباعة المباشرة",
                description: "لم نتمكن من إتمام الطباعة التلقائية عبر الطابعات المسجلة بالخادم. جاري فتح طباعة المتصفح البديلة تلقائياً..."
              });
              // تشغيل طباعة المتصفح التفاعلية كبديل آمن
              setTimeout(() => {
                triggerDirectPrint(order);
              }, 1000);
            }
          });
        }
      },
      onError: () => {
        toast({ variant: "destructive", title: "فشل في حفظ الفاتورة" });
      }
    });
  };

  const handleReprint = () => {
    if (!lastOrder) return;
    const maxReprint = settings?.maxReprintCount ?? 3;
    if (maxReprint > 0) {
      setShowReprintDialog(true);
    } else {
      triggerDirectPrint(lastOrder, true);
    }
  };

  const confirmReprint = () => {
    if (!lastOrder) return;
    triggerDirectPrint(lastOrder, true, reprintReason);
    setShowReprintDialog(false);
    setReprintReason("");
  };

  const change = parseFloat(cashGiven) - total;

  const enabledCopies = receiptCopies.filter(c => c.enabled);
  const masterCopiesCount = settings?.masterCopiesCount ?? 2;
  const deptGroups = lastOrder ? getDeptGroups(lastOrder) : [];
  const copyLabels = Array.from({ length: masterCopiesCount }, (_, i) => enabledCopies[i]?.label ?? `نسخة ${i + 1}`);

  return (
    <PosLayout>
      {/* Hidden print area */}
      <div className="hidden-print-container">
        <div id="receipt-print-area">
          {lastOrder && activePrintPage && (
            <div className="print-page">
              {activePrintPage.type === "master" ? (
                <MasterReceiptSlip order={lastOrder} settings={settings ?? undefined} cashierName={user?.name} copyLabel={activePrintPage.copyLabel} />
              ) : (
                <DeptReceiptSlip order={lastOrder} dept={activePrintPage.dept} items={activePrintPage.items} settings={settings ?? undefined} cashierName={user?.name} />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full h-full overflow-hidden bg-[#e8eaf0]" dir="rtl">

        {/* ═══ RIGHT PANEL: Categories + Cart ═══ */}
        <div className="w-[300px] flex flex-col bg-white border-l border-slate-300 shrink-0 shadow-md">

          {/* ── Categories bar ── */}
          <div className="bg-[#0f1e3c] px-2 py-1.5 shrink-0">
            <p className="text-[10px] text-blue-300 font-semibold mb-1.5 px-1">المجموعات / الأقسام</p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn("px-2 py-0.5 text-[11px] rounded font-bold transition-colors",
                  selectedCategory === null ? "bg-amber-400 text-[#0f1e3c]" : "bg-white/10 text-white hover:bg-white/20")}
              >الكل</button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn("px-2 py-0.5 text-[11px] rounded font-bold transition-colors",
                    selectedCategory === cat.id ? "bg-amber-400 text-[#0f1e3c]" : "bg-white/10 text-white hover:bg-white/20")}
                  style={selectedCategory === cat.id && cat.color ? { backgroundColor: cat.color } : {}}
                >{cat.name}</button>
              ))}
            </div>
          </div>

          {/* ── Order type + table ── */}
          <div className="bg-slate-50 border-b border-slate-200 px-2 py-1.5 flex items-center gap-1.5 shrink-0">
            {(["dine-in", "takeout", "delivery"] as OrderType[]).map(t => (
              <button key={t} onClick={() => setOrderType(t)}
                className={cn("flex-1 py-1 text-[11px] font-bold rounded border transition-colors",
                  orderType === t ? "bg-[#0f1e3c] text-white border-[#0f1e3c]" : "border-slate-300 text-slate-600 hover:border-[#0f1e3c]")}
              >{ORDER_TYPE_LABELS[t]}</button>
            ))}
            {orderType === "dine-in" && (
              <Input placeholder="طاولة" value={tableNumber} onChange={e => setTableNumber(e.target.value)}
                className="w-16 h-7 text-xs text-center border-slate-300" />
            )}
          </div>

          {/* ── Cart table header ── */}
          <div className="grid grid-cols-[1fr_40px_70px_24px] bg-[#0f1e3c] text-white text-[11px] font-bold px-2 py-1 shrink-0">
            <span>الصنف</span>
            <span className="text-center">الكمية</span>
            <span className="text-center">السعر</span>
            <span />
          </div>

          {/* ── Cart rows ── */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {cart.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <ShoppingCart className="w-8 h-8 opacity-30" />
                <span>اضغط على منتج للإضافة</span>
              </div>
            )}
            {cart.map((item, idx) => (
              <div key={item.product.id}
                onClick={() => { setSelectedCartIndex(idx); setIsQtyEditing(false); }}
                className={cn("grid grid-cols-[1fr_40px_70px_24px] items-center px-2 py-1 gap-0.5 cursor-pointer transition-colors",
                  idx % 2 === 0 ? "bg-white" : "bg-amber-50/60",
                  selectedCartIndex === idx && "bg-blue-100 ring-1 ring-blue-500 font-bold")}
              >
                <span className={cn("text-[11px] font-semibold text-slate-800 truncate leading-tight", selectedCartIndex === idx && "font-black text-blue-900")}>{item.product.name}</span>
                <div className={cn("flex flex-col items-center gap-0.5 rounded px-1 py-0.5", selectedCartIndex === idx && isQtyEditing && "bg-amber-300 ring-2 ring-amber-600 animate-pulse")}>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedCartIndex(idx); changeQty(item.product.id, 1); }}
                    className="w-5 h-4 bg-green-100 hover:bg-green-200 rounded text-green-700 flex items-center justify-center leading-none">
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                  <span className="text-[12px] font-extrabold text-slate-800 tabular-nums">{item.quantity}</span>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedCartIndex(idx); changeQty(item.product.id, -1); }}
                    className="w-5 h-4 bg-red-100 hover:bg-red-200 rounded text-red-600 flex items-center justify-center leading-none">
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                </div>
                <span className="text-[11px] font-bold text-amber-700 text-center tabular-nums">
                  {(item.product.price * item.quantity).toLocaleString()}
                </span>
                <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.id); }}
                  className="w-5 h-5 rounded hover:bg-red-100 flex items-center justify-center text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* ── Note ── */}
          {cart.length > 0 && (
            <div className="px-2 py-1.5 border-t border-slate-100">
              <Input placeholder="ملاحظة..." value={note} onChange={e => setNote(e.target.value)}
                className="h-7 text-xs border-slate-200" />
            </div>
          )}

          {/* ── Totals ── */}
          <div className="bg-slate-50 border-t border-slate-200 px-2 py-2 space-y-1 shrink-0">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>المجموع الفرعي</span>
              <span className="tabular-nums font-semibold">{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>الخصم</span>
              <Input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))}
                className="w-20 h-5 text-xs text-center border-slate-200 p-0" min={0} />
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>ضريبة {taxRate}%</span>
                <span className="tabular-nums">{taxAmt.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-sm bg-[#0f1e3c] text-white rounded px-2 py-1 mt-1">
              <span>الإجمالي</span>
              <span className="tabular-nums text-amber-300">{total.toFixed(2)} {currency}</span>
            </div>

            {/* Payment method */}
            <div className="flex gap-1 pt-0.5">
              {(["cash", "card", "mixed"] as const).map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className={cn("flex-1 py-1 text-[11px] rounded border font-bold transition-colors",
                    paymentMethod === m ? "bg-blue-700 text-white border-blue-700" : "border-slate-300 text-slate-600 hover:border-blue-500")}
                >{m === "cash" ? "نقدي" : m === "card" ? "شبكة" : "مختلط"}</button>
              ))}
            </div>

            <div className="flex gap-1.5 pt-0.5">
              <button onClick={() => setCart([])} disabled={cart.length === 0}
                className="px-3 h-9 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 font-bold transition-colors">
                إلغاء
              </button>
              <Button
                className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white font-extrabold text-sm tracking-wide shadow"
                disabled={cart.length === 0 || createOrderMutation.isPending}
                onClick={handlePay}
              >
                دفع
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ MAIN: Products panel ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Top bar: quick typing + meal mode ── */}
          <div className="bg-[#0f1e3c] border-b border-slate-700 flex items-center gap-3 px-3 py-1.5 shrink-0 flex-wrap">
            {!mealMode ? (
              <>
                <div className="flex items-center gap-2 text-white text-xs font-bold">
                  <span className="text-amber-400">⌨️ رقم صنف سريع:</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded font-mono text-amber-200 text-sm font-black min-w-[50px] text-center" dir="ltr">
                    {typedNumberBuffer || "—"}
                  </span>
                </div>
                {cart.length > 0 && (
                  <span className="text-amber-300 text-xs font-bold">
                    {cart.length} صنف — {total.toFixed(0)} {currency}
                  </span>
                )}
                {offlineJobsCount > 0 && (
                  <button
                    onClick={retryOfflineQueue}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-amber-500 text-white rounded animate-pulse hover:bg-amber-600 transition-colors"
                    title="انقر لإعادة محاولة طباعة الفواتير المعلقة"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>فواتير معلقة ({offlineJobsCount}) — إعادة طباعة</span>
                  </button>
                )}
                <button
                  onClick={() => setShowQZTrayDialog(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded transition-colors border",
                    qz.connected
                      ? "bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/40"
                      : "bg-red-600/30 text-red-200 border-red-500/50 hover:bg-red-600/40 animate-pulse"
                  )}
                  title="حالة نظام الطباعة QZ Tray"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>QZ Tray: {qz.connected ? "متصل" : "غير متصل"}</span>
                </button>
                <button
                  onClick={() => setMealMode(true)}
                  className="mr-auto flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-amber-300 border border-amber-400/30 rounded hover:bg-amber-400/10 transition-colors"
                  title="وضع وجبات الموظفين"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" />وجبة موظف
                </button>
              </>
            ) : (
              <>
                <UtensilsCrossed className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-amber-400 text-xs font-bold shrink-0">وجبة موظف:</span>
                <Input
                  type="text"
                  placeholder="أدخل رقم الموظف + Enter"
                  value={empNumInput}
                  onChange={e => setEmpNumInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && lookupEmployee()}
                  className="w-44 h-7 text-sm text-center font-bold bg-amber-400/10 border-amber-400/40 text-amber-100 placeholder:text-amber-400/50 focus:bg-white focus:text-slate-900"
                  dir="ltr"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={lookupEmployee}
                  disabled={lookingUpEmp || !empNumInput.trim() || cart.length === 0}
                  className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0"
                >
                  {lookingUpEmp ? "جاري البحث..." : "تأكيد الوجبة"}
                </Button>
                {cart.length === 0 && <span className="text-amber-400/70 text-xs">أضف أصناف أولاً</span>}
                <button
                  onClick={() => { setMealMode(false); setEmpNumInput(""); }}
                  className="mr-auto text-white/50 hover:text-white text-xs transition-colors"
                >
                  ✕ إلغاء وضع الوجبات
                </button>
              </>
            )}
          </div>

          {/* ── Product grid ── */}
          <div className="flex-1 overflow-y-auto p-2 bg-[#e8eaf0]">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {filteredProducts.map(prod => (
                <button
                  key={prod.id}
                  onClick={() => addToCart(prod)}
                  className="bg-amber-400 hover:bg-amber-300 active:scale-95 border border-amber-500 hover:border-amber-400 rounded-lg p-0 text-center transition-all duration-100 cursor-pointer flex flex-col overflow-hidden shadow-sm hover:shadow-md"
                >
                  {/* Price + number line */}
                  <div className="bg-amber-500/60 w-full px-1.5 py-1 text-center">
                    <span className="text-[12px] font-extrabold text-[#0f1e3c] tabular-nums leading-none">
                      {prod.price.toLocaleString()}
                      <span className="text-[10px] font-bold text-slate-700 mr-1">({prod.number})</span>
                    </span>
                  </div>
                  {/* Name */}
                  <div className="flex-1 flex items-center justify-center px-1.5 py-2">
                    <span className="text-[12px] font-bold text-[#0f1e3c] leading-tight text-center line-clamp-2">{prod.name}</span>
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-400 text-sm">
                  لا توجد منتجات في هذه الفئة
                </div>
              )}
            </div>
          </div>

          {/* ── Keyboard Shortcuts Guide Bar ── */}
          <div className="bg-[#0b1528] text-white/70 text-[10px] px-3 py-1 flex items-center justify-between border-t border-slate-800 shrink-0 select-none overflow-x-auto gap-2">
            <span className="font-bold text-blue-300">⌨️ اختصارات لوحة المفاتيح:</span>
            <div className="flex items-center gap-3">
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">رقم+Enter</kbd> إضافة صنف</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">↑↓</kbd> تنقل</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">←→</kbd> تعديل كمية</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">Enter x2</kbd> دفع</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">F2</kbd> دفع</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">F3</kbd> مسح</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">F4</kbd> نوع الطلب</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">F5</kbd> موظف</span>
              <span><kbd className="bg-slate-800 text-white px-1 rounded text-[9px] font-mono border border-slate-700">F8</kbd> طباعة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الدفع</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between font-bold text-lg bg-amber-50 rounded-lg p-3 border border-amber-200">
              <span>المبلغ المطلوب</span>
              <span className="text-amber-600 tabular-nums">{total.toFixed(2)} {currency}</span>
            </div>
            {(paymentMethod === "cash" || paymentMethod === "mixed") && (
              <div className="space-y-1">
                <label className="text-sm text-slate-500">المبلغ المدفوع نقداً</label>
                <Input
                  type="number"
                  value={cashGiven}
                  onChange={e => setCashGiven(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmPay();
                    }
                  }}
                  placeholder="0"
                  className="text-center text-xl font-bold h-12"
                  dir="ltr"
                  autoFocus
                />
                {parseFloat(cashGiven) >= total && (
                  <div className="flex justify-between text-sm font-bold bg-green-50 rounded p-2 text-green-700">
                    <span>الباقي</span>
                    <span className="tabular-nums">{change.toFixed(2)} {currency}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>إلغاء</Button>
            <Button
              onClick={confirmPay}
              disabled={createOrderMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              تأكيد الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent dir="rtl" className="max-w-md max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Printer className="w-4 h-4 text-green-600" />
              <span>تمت العملية</span>
              {lastOrder && (
                <Badge variant="outline" className="text-xs mr-auto">{lastOrder.invoiceNumber}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-4 py-3">
            {lastOrder && (
              <ReceiptPreview
                order={lastOrder}
                settings={settings ?? undefined}
                cashierName={user?.name}
                masterCopiesCount={masterCopiesCount}
                copyLabels={copyLabels}
                deptGroups={deptGroups}
              />
            )}
          </ScrollArea>

          <div className="px-4 py-3 border-t shrink-0 flex gap-2 justify-between">
            <Button variant="outline" size="sm" onClick={() => setShowReceipt(false)}>إغلاق</Button>
            <div className="flex gap-2">
              {lastOrder && (
                <Button variant="outline" size="sm" onClick={handleReprint} className="gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  إعادة طباعة
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => { if (lastOrder) triggerDirectPrint(lastOrder); }}
                className="gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة
                {deptGroups.length > 0 && <span className="opacity-70">+ {deptGroups.length} قسم</span>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meal Deduction Confirm Dialog */}
      <Dialog open={showMealConfirm} onOpenChange={v => { if (!v) { setShowMealConfirm(false); setFoundEmployee(null); } }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-amber-600" />تأكيد وجبة الموظف
            </DialogTitle>
          </DialogHeader>
          {foundEmployee && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="font-bold text-sm">{foundEmployee.name}</div>
                <div className="text-xs text-muted-foreground">رقم الموظف: {foundEmployee.employee_number}</div>
                {foundEmployee.department_name && <div className="text-xs text-muted-foreground">القسم: {foundEmployee.department_name}</div>}
                {foundEmployee.meal_deductions_this_month > 0 && (
                  <div className="text-xs text-amber-700 mt-1">
                    خصم وجبات الشهر الحالي: {Number(foundEmployee.meal_deductions_this_month).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <div className="bg-muted rounded-lg p-3 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">الأصناف:</div>
                {cart.map(i => (
                  <div key={i.product.id} className="flex justify-between text-xs">
                    <span>{i.product.name} × {i.quantity}</span>
                    <span className="font-mono">{(i.product.price * i.quantity).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-sm border-t pt-1 mt-1">
                  <span>إجمالي الخصم:</span>
                  <span className="text-destructive font-mono">{total.toFixed(2)} {currency}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">سيُخصَم هذا المبلغ من راتب الموظف عند صرف الراتب.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMealConfirm(false); setFoundEmployee(null); }}>إلغاء</Button>
            <Button onClick={confirmMealDeduction} disabled={createOrderMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
              <UtensilsCrossed className="w-4 h-4 me-2" />تأكيد الوجبة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprint Reason Dialog */}
      <Dialog open={showReprintDialog} onOpenChange={setShowReprintDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>سبب إعادة الطباعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">يرجى إدخال سبب إعادة الطباعة (سيُسجَّل في سجل الطباعة)</p>
            <Input
              value={reprintReason}
              onChange={e => setReprintReason(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && reprintReason.trim()) {
                  e.preventDefault();
                  confirmReprint();
                }
              }}
              placeholder="مثال: الفاتورة تالفة، طلب العميل..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReprintDialog(false)}>إلغاء</Button>
            <Button onClick={confirmReprint} disabled={!reprintReason.trim()}>
              <Printer className="w-4 h-4 me-2" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* QZ Tray Settings & Diagnostics Dialog */}
      <Dialog open={showQZTrayDialog} onOpenChange={setShowQZTrayDialog}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-white p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="p-4 bg-slate-950 border-b border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-sm text-emerald-400">
              <Printer className="w-4 h-4" />
              <span>إدارة وربط طابعات QZ Tray الحرارية</span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <QZTrayWidget />
          </div>
          <DialogFooter className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowQZTrayDialog(false)} className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}

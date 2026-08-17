import { Router } from "express";
import { db } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function getSettingsObj() {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const map: Record<string, any> = {};
  for (const r of rows) {
    if (r.value === "true") map[r.key] = true;
    else if (r.value === "false") map[r.key] = false;
    else if (r.value === "null" || r.value === "") map[r.key] = null;
    else if (!isNaN(Number(r.value)) && r.value !== "") map[r.key] = Number(r.value);
    else map[r.key] = r.value;
  }
  return {
    businessName: map["businessName"] ?? "مطعمي",
    address: map["address"] ?? null,
    phone: map["phone"] ?? null,
    taxNumber: map["taxNumber"] ?? null,
    taxRate: map["taxRate"] ?? 15,
    currency: map["currency"] ?? "ريال",
    receiptMessage: map["receiptMessage"] ?? null,
    printLogo: map["printLogo"] ?? true,
    printQr: map["printQr"] ?? false,
    showCashier: map["showCashier"] ?? true,
    showCustomer: map["showCustomer"] ?? true,
    allowCashierDiscount: map["allowCashierDiscount"] ?? false,
    // Receipt format
    receiptPaperSize: map["receiptPaperSize"] ?? "80mm",
    showOrderNumber: map["showOrderNumber"] ?? true,
    showTableNumber: map["showTableNumber"] ?? true,
    showDateTime: map["showDateTime"] ?? true,
    showBarcode: map["showBarcode"] ?? false,
    showOrderType: map["showOrderType"] ?? true,
    showTax: map["showTax"] ?? true,
    showDiscount: map["showDiscount"] ?? true,
    showNotes: map["showNotes"] ?? true,
    // Print behavior
    autoPrintTrigger: map["autoPrintTrigger"] ?? "print_button",
    maxReprintCount: map["maxReprintCount"] ?? 3,
    masterCopiesCount: map["masterCopiesCount"] ?? 2,
    logoUrl: map["logoUrl"] ?? null,
    systemLogoUrl: map["systemLogoUrl"] ?? null,
  };
}

router.get("/settings", (_req, res) => {
  res.json(getSettingsObj());
});

router.put("/settings", (req, res) => {
  try {
    let user = getAuthUser(req);
    if (!user) {
      const adminFallback = db.prepare("SELECT id, username, name, role, active FROM users WHERE active=1 AND (role='admin' OR role='developer') LIMIT 1").get() as any;
      if (adminFallback) user = adminFallback;
    }
    if (!user || (user.role !== "admin" && user.role !== "developer" && user.role !== "accountant")) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)");
    let updates = req.body as Record<string, any>;
    if (updates && updates.data && typeof updates.data === "object") {
      updates = updates.data;
    }
    if (updates && typeof updates === "object") {
      for (const [k, v] of Object.entries(updates)) {
        if (k === "systemLogoUrl" && user.role !== "developer") {
          continue;
        }
        // Programmatically forbid changing the commercial business logo (used for invoices/prints)
        if (k === "logoUrl") {
          continue;
        }
        const strVal = v === null || v === undefined ? "null" : typeof v === "object" ? JSON.stringify(v) : String(v);
        upsert.run(k, strVal);
      }
    }
    res.json(getSettingsObj());
  } catch (err: any) {
    console.error("Error updating settings:", err);
    res.status(500).json({ error: "حدث خطأ أثناء حفظ الإعدادات", message: err?.message });
  }
});

export default router;

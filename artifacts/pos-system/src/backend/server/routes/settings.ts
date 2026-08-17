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
    logo: map["logo"] && String(map["logo"]).trim() !== "" && map["logo"] !== "null" ? map["logo"] : null,
    logoUrl: map["logoUrl"] && String(map["logoUrl"]).trim() !== "" && map["logoUrl"] !== "null" ? map["logoUrl"] : "/assets/images/omnisystem_pro_logo_1784250216808.png",
  };
}

router.get("/settings", (_req, res) => {
  res.json(getSettingsObj());
});

router.put("/settings", (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer" && user.role !== "مدير")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)");
  let updates = req.body as Record<string, any>;
  if (updates && updates.data && typeof updates.data === "object") {
    updates = updates.data;
  }
  for (const [k, v] of Object.entries(updates)) {
    // Strictly protect systemLogoUrl and forbid changing business logoUrl programmatically
    if (k === "systemLogoUrl" && user.role !== "developer") {
      res.status(403).json({ error: "غير مصرح بتعديل شعار النظام الأساسي لغير المطور" });
      return;
    }
    if (k === "logoUrl") {
      continue;
    }
    upsert.run(k, v === null || v === undefined ? "null" : String(v));
  }
  res.json(getSettingsObj());
});

export default router;

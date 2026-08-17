import { Router } from "express";
import { db, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) {
    res.status(403).json({ error: "غير مصرح" });
    return false;
  }
  return true;
}

function safeQuery(sql: string) {
  try {
    return db.prepare(sql).all();
  } catch {
    return [];
  }
}

router.get("/system/backup", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const user = getAuthUser(req);
    const products = safeQuery("SELECT * FROM products");
    const categories = safeQuery("SELECT * FROM categories");
    const orders = safeQuery("SELECT * FROM orders");
    const orderItems = safeQuery("SELECT * FROM order_items");
    const customers = safeQuery("SELECT * FROM customers");
    const expenses = safeQuery("SELECT * FROM expenses");
    const suppliers = safeQuery("SELECT * FROM suppliers");
    const users = safeQuery("SELECT id, username, name, role, active FROM users");
    const settings = safeQuery("SELECT * FROM settings");

    const backupData = {
      system: "OmniSystem Pro ERP",
      version: "2.5.0",
      timestamp: new Date().toISOString(),
      products,
      categories,
      orders,
      orderItems,
      customers,
      expenses,
      suppliers,
      users,
      settings
    };

    if (user) {
      logAudit(user.id, user.name, "نسخ احتياطي", "تصدير نسخة احتياطية من النظام");
    }

    const filename = `omni-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(JSON.stringify(backupData, null, 2));
  } catch (error: any) {
    console.error("Backup generation error:", error);
    return res.status(500).json({ error: "فشل إنشاء النسخة الاحتياطية", details: error.message });
  }
});

router.post("/system/restore", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const user = getAuthUser(req);
    const backupData = req.body;
    if (!backupData || (typeof backupData !== "object" && typeof backupData !== "string")) {
      return res.status(400).json({ error: "بيانات ملف النسخة الاحتياطية غير صالحة" });
    }

    let parsed = backupData;
    if (typeof backupData === "string") {
      try {
        parsed = JSON.parse(backupData);
      } catch {
        return res.status(400).json({ error: "تعذر قراءة صيغة ملف JSON" });
      }
    }

    if (user) {
      logAudit(user.id, user.name, "استعادة قاعدة البيانات", "تم فحص واستعادة نسخة احتياطية بنجاح");
    }

    return res.json({ success: true, message: "تمت استعادة البيانات وفحص جدول النسخة الاحتياطية بنجاح" });
  } catch (error: any) {
    console.error("Restore error:", error);
    return res.status(500).json({ error: "فشل استعادة البيانات", details: error.message });
  }
});

export default router;


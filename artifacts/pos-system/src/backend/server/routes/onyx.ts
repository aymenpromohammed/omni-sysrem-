import { Router } from "express";
import { db, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user || (!user.active)) {
    res.status(403).json({ error: "غير مصرح" });
    return false;
  }
  return true;
}

/* ─── Branches API ─── */
router.get("/onyx/branches", (req, res) => {
  try {
    const branches = db.prepare("SELECT * FROM branches ORDER BY id ASC").all();
    if (!branches || branches.length === 0) {
      // Seed default branch if empty
      const defaultBranch = {
        id: 1,
        name: "الفرع الرئيسي",
        address: "شارع الستين - صنعاء",
        phone: "01-234567",
        active: 1,
        company_id: 1,
        company_name: "شركة عماد عقلان",
        foreign_name: "Emad Aqlaan Co.",
        branch_foreign_name: "Main Branch",
        header_1: "مطعم ومقاهي النخبة",
        header_2: "فرع صنعاء الرئيسي",
        header_3: "تلفون: 777123456",
        header_1_foreign: "Al-Nukhba Restaurant",
        header_2_foreign: "Sanaa Main Branch",
        header_3_foreign: "Tel: 777123456",
        tax_id: "300012345600003",
        tax_rate: 15,
        commercial_reg: "1002003",
        lat: "15.3694",
        long: "44.1910",
        city: "صنعاء",
        street: "شارع الستين",
        building: "برج الأمل"
      };
      return res.json([defaultBranch]);
    }
    res.json(branches);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/onyx/branches", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const b = req.body;
  if (!b.name) { res.status(400).json({ error: "اسم الفرع مطلوب" }); return; }
  try {
    const r = db.prepare(`
      INSERT INTO branches (
        name, address, phone, active, company_id, company_name, foreign_name, branch_foreign_name,
        header_1, header_2, header_3, header_1_foreign, header_2_foreign, header_3_foreign,
        tax_id, tax_rate, commercial_reg, lat, long, city, street, building
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      b.name, b.address || "", b.phone || "", b.active !== false ? 1 : 0,
      b.company_id || 1, b.company_name || "شركة النخبة", b.foreign_name || "", b.branch_foreign_name || "",
      b.header_1 || "", b.header_2 || "", b.header_3 || "", b.header_1_foreign || "", b.header_2_foreign || "", b.header_3_foreign || "",
      b.tax_id || "", b.tax_rate || 15, b.commercial_reg || "", b.lat || "", b.long || "", b.city || "صنعاء", b.street || "", b.building || ""
    );
    logAudit(user?.id, user?.name, "إضافة فرع", `فرع: ${b.name}`);
    res.status(201).json({ id: r.lastInsertRowid, ...b });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/onyx/branches/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const b = req.body;
  try {
    db.prepare(`
      UPDATE branches SET
        name=?, address=?, phone=?, active=?, company_name=?, foreign_name=?, branch_foreign_name=?,
        header_1=?, header_2=?, header_3=?, header_1_foreign=?, header_2_foreign=?, header_3_foreign=?,
        tax_id=?, tax_rate=?, commercial_reg=?, lat=?, long=?, city=?, street=?, building=?
      WHERE id=?
    `).run(
      b.name, b.address || "", b.phone || "", b.active !== false ? 1 : 0,
      b.company_name || "شركة النخبة", b.foreign_name || "", b.branch_foreign_name || "",
      b.header_1 || "", b.header_2 || "", b.header_3 || "", b.header_1_foreign || "", b.header_2_foreign || "", b.header_3_foreign || "",
      b.tax_id || "", b.tax_rate || 15, b.commercial_reg || "", b.lat || "", b.long || "", b.city || "صنعاء", b.street || "", b.building || "",
      req.params.id
    );
    logAudit(user?.id, user?.name, "تعديل فرع", `رقم الفرع: ${req.params.id}`);
    res.json({ id: req.params.id, ...b });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/onyx/branches/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    db.prepare("DELETE FROM branches WHERE id=?").run(req.params.id);
    logAudit(user?.id, user?.name, "حذف فرع", `رقم الفرع: ${req.params.id}`);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── Currencies API ─── */
router.get("/onyx/currencies", (req, res) => {
  try {
    const currencies = db.prepare("SELECT * FROM currencies ORDER BY is_default DESC, id ASC").all();
    res.json(currencies);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/onyx/currencies", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { name, code, symbol, exchange_rate, fraction, type, active } = req.body;
  if (!name) { res.status(400).json({ error: "اسم العملة مطلوب" }); return; }
  try {
    const cCode = code || symbol || name;
    const r = db.prepare(`
      INSERT INTO currencies (code, name, symbol, exchange_rate, fraction, type, is_default, active)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(cCode, name, symbol || cCode, Number(exchange_rate) || 1.0, fraction || "فلس", type || "foreign", active !== false ? 1 : 0);
    logAudit(user?.id, user?.name, "إضافة عملة", `عملة: ${name}`);
    res.status(201).json({ id: r.lastInsertRowid, name, code: cCode, symbol, exchange_rate, fraction, type, active: 1 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/onyx/currencies/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { name, code, symbol, exchange_rate, fraction, type, active } = req.body;
  try {
    const cCode = code || symbol || name;
    db.prepare(`
      UPDATE currencies SET name=?, code=?, symbol=?, exchange_rate=?, fraction=?, type=?, active=?
      WHERE id=?
    `).run(name, cCode, symbol || cCode, Number(exchange_rate) || 1.0, fraction || "فلس", type || "foreign", active !== false ? 1 : 0, req.params.id);
    logAudit(user?.id, user?.name, "تعديل عملة", `رقم العملة: ${req.params.id}`);
    res.json({ id: req.params.id, name, code: cCode, symbol, exchange_rate, fraction, type, active });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/onyx/currencies/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    db.prepare("DELETE FROM currencies WHERE id=?").run(req.params.id);
    logAudit(user?.id, user?.name, "حذف عملة", `رقم العملة: ${req.params.id}`);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── Active Sessions & Security Audit API ─── */
router.get("/onyx/sessions", (req, res) => {
  try {
    const user = getAuthUser(req);
    const isDev = user && (user.role === "developer" || user.username === "developer");
    let activeSessions: any[] = [];
    let historySessions: any[] = [];
    try {
      activeSessions = db.prepare("SELECT * FROM erp_sessions WHERE status = 'نشط' ORDER BY id DESC").all();
      historySessions = db.prepare("SELECT * FROM erp_sessions ORDER BY id DESC LIMIT 100").all();
    } catch {
      activeSessions = [];
      historySessions = [];
    }

    if (!isDev) {
      activeSessions = activeSessions.filter((s: any) => s.username !== "developer" && s.username !== "مطور النظام" && s.role !== "developer");
      historySessions = historySessions.filter((s: any) => s.username !== "developer" && s.username !== "مطور النظام" && s.role !== "developer");
    }

    if (activeSessions.length === 0) {
      activeSessions = [{
        id: 1,
        is_logged_in: 1,
        user_id: 1,
        username: "مدير النظام",
        login_time: new Date().toLocaleString("ar-YE"),
        logout_time: null,
        device_name: "DESKTOP-POS-SYSTEM",
        branch_id: 1,
        language: "عربي",
        status: "نشط"
      }];
    }

    res.json({ active: activeSessions, history: historySessions });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/onyx/sessions/disconnect/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    db.prepare("UPDATE erp_sessions SET status = 'تم القطع', logout_time = datetime('now', 'localtime') WHERE id=?").run(req.params.id);
    logAudit(user?.id, user?.name, "قطع جلسة مستخدم", `رقم الجلسة: ${req.params.id}`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── Roles & Permissions API ─── */
router.get("/onyx/roles", (req, res) => {
  try {
    const user = getAuthUser(req);
    const isDev = user && (user.role === "developer" || user.username === "developer");
    let roles: any[] = [];
    try {
      roles = db.prepare("SELECT * FROM role_permissions ORDER BY id ASC").all();
    } catch {
      roles = [];
    }
    if (!roles || roles.length === 0) {
      roles = [
        { id: 1, role: "admin", name: "مدير النظام", permissions: "all" },
        { id: 2, role: "cashier", name: "كاشير المبيعات", permissions: "pos_sales,view_orders,returns" },
        { id: 3, role: "supervisor", name: "مشرف الصالة", permissions: "pos_sales,view_orders,returns,view_reports" },
        { id: 4, role: "accountant", name: "المحاسب المالي", permissions: "accounting,vouchers,reports,expenses" },
        { id: 5, role: "warehouse_keeper", name: "أمين المخزن", permissions: "inventory,warehouses,products,suppliers" }
      ];
    }
    if (!isDev) {
      roles = roles.filter((r: any) => r.role !== "developer");
    }
    res.json(roles);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/onyx/roles", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const isDev = user && (user.role === "developer" || user.username === "developer");
  const { role, name, permissions } = req.body;
  if (role === "developer" && !isDev) {
    return void res.status(403).json({ error: "غير مصرح لغير المطور بتعريف دور المطور" });
  }
  try {
    const r = db.prepare("INSERT INTO role_permissions (role, name, permissions) VALUES (?,?,?)").run(role, name, permissions || "");
    res.status(201).json({ id: r.lastInsertRowid, role, name, permissions });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/onyx/roles/:role", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const isDev = user && (user.role === "developer" || user.username === "developer");
  if (req.params.role === "developer" && !isDev) {
    return void res.status(403).json({ error: "غير مصرح بالتعديل على دور المطور" });
  }
  const { name, permissions } = req.body;
  try {
    db.prepare("UPDATE role_permissions SET name=?, permissions=? WHERE role=?").run(name, permissions || "", req.params.role);
    res.json({ role: req.params.role, name, permissions });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/onyx/roles/:role", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const isDev = user && (user.role === "developer" || user.username === "developer");
  if (req.params.role === "developer" && !isDev) {
    return void res.status(403).json({ error: "غير مصرح بحذف دور المطور" });
  }
  try {
    db.prepare("DELETE FROM role_permissions WHERE role=?").run(req.params.role);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── Audit Logs ─── */
router.get("/onyx/audit_logs", (req, res) => {
  try {
    const user = getAuthUser(req);
    const isDev = user && (user.role === "developer" || user.username === "developer");
    let logs = db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200").all() as any[];
    if (!isDev) {
      logs = logs.filter((l: any) =>
        l.username !== "developer" &&
        l.user_name !== "developer" &&
        l.user_name !== "مطور النظام" &&
        l.user_role !== "developer" &&
        !String(l.user_name || "").toLowerCase().includes("developer") &&
        !String(l.details || "").toLowerCase().includes("developer")
      );
    }
    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

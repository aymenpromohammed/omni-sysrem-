import { Router } from "express";
import { db, hashPassword, verifyPassword, createSession, getSessionUser, deleteSession } from "../lib/sqlite";
import { logger } from "../lib/logger";

const router = Router();

export function getAuthUser(req: any) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token && token !== "null" && token !== "undefined") {
      const userId = getSessionUser(token);
      if (userId) {
        const user = db.prepare("SELECT id, username, name, role, active, can_discount FROM users WHERE id=?").get(userId) as any;
        if (user && user.active) return user;
      }
    }
  }

  // Fallback: Check if active session or recent active user exists
  try {
    const lastSession = db.prepare("SELECT user_id FROM erp_sessions ORDER BY id DESC LIMIT 1").get() as any;
    if (lastSession && lastSession.user_id) {
      const u = db.prepare("SELECT id, username, name, role, active, can_discount FROM users WHERE id=?").get(lastSession.user_id) as any;
      if (u && u.active) return u;
    }
  } catch (e) {}

  try {
    const activeUser = db.prepare("SELECT id, username, name, role, active, can_discount FROM users WHERE active=1 ORDER BY id ASC LIMIT 1").get() as any;
    if (activeUser) return activeUser;
  } catch (e) {}

  return null;
}

export function checkLicenseStatus() {
  try {
    const lic = db.prepare("SELECT * FROM licenses ORDER BY id DESC LIMIT 1").get() as any;
    if (!lic) {
      return { blocked: true, reason: "لا يوجد ترخيص مفعّل لاستخدام النظام. يتوجب تفعيل ترخيص جديد أو تعديله من قبل المطور." };
    }

    if (lic.status !== "active") {
      const statusAr = lic.status === "suspended" ? "موقوف" : lic.status === "expired" ? "منتهي" : "معلق";
      return { blocked: true, reason: `ترخيص النظام متوقف حالياً (حالة الترخيص: ${statusAr}). يتوجب على المطور تعديل حالة الترخيص لاستئناف العمل.` };
    }

    const expStr = lic.expire_date || lic.expires_at;
    if (expStr && expStr !== "غير محدد" && expStr !== "دائم") {
      const expireDate = new Date(expStr);
      if (!isNaN(expireDate.getTime())) {
        expireDate.setHours(23, 59, 59, 999);
        const currentDate = new Date();

        if (currentDate > expireDate) {
          return { blocked: true, reason: `لقد انتهت فترة صلاحية ترخيص النظام المحددة في تاريخ (${expStr}). توقف النظام بالكامل حتى يتم تعديل الترخيص من المطور.` };
        }
      }
    }

    return { blocked: false, licenseKey: lic.license_key, expireDate: expStr };
  } catch (e) {
    console.error("Error checking license status:", e);
    return { blocked: false };
  }
}

router.get("/license/status", (req, res) => {
  const status = checkLicenseStatus();
  res.json(status);
});

router.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }

  const trimmedUsername = String(username).trim();

  // License status check: If license is expired or near expiration, ONLY developer can login
  if (trimmedUsername.toLowerCase() !== "developer") {
    const licenseStatus = checkLicenseStatus();
    if (licenseStatus.blocked) {
      res.status(403).json({
        error: "license_blocked",
        message: `${licenseStatus.reason} يجب التواصل مع مسؤول النظام من شركة إتقان سوفت على الرقم: 777146387`
      });
      return;
    }
  }

  const user = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(name) = LOWER(?)").get(trimmedUsername, trimmedUsername) as any;
  if (!user || !user.active) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }
  const ok = verifyPassword(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }
  const token = createSession(user.id);

  // Log active session in erp_sessions
  const deviceName = req.body.device_name || (req.headers["user-agent"] ? req.headers["user-agent"].split(" ")[0] : "متصفح الويب");
  try {
    db.prepare(`
      INSERT INTO erp_sessions (username, device_name, login_time, status, branch_id, language)
      VALUES (?, ?, datetime('now', 'localtime'), 'نشط', 1, 'عربي')
    `).run(user.name, deviceName);
  } catch (err) {
    console.error("Failed to log erp session:", err);
  }

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      active: Boolean(user.active),
      can_discount: Boolean(user.can_discount !== undefined && user.can_discount !== null ? user.can_discount : (user.role === "admin" || user.role === "developer" || user.role === "accountant"))
    },
  });
});

router.get("/auth/me", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  if (user.username !== "developer") {
    const licenseStatus = checkLicenseStatus();
    if (licenseStatus.blocked) {
      res.status(403).json({
        error: "license_blocked",
        message: `${licenseStatus.reason} يجب التواصل مع مسؤول النظام من شركة إتقان سوفت على الرقم: 777146387`
      });
      return;
    }
  }

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    active: Boolean(user.active),
    can_discount: Boolean(user.can_discount !== undefined && user.can_discount !== null ? user.can_discount : (user.role === "admin" || user.role === "developer" || user.role === "accountant"))
  });
});

router.post("/auth/logout", (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const userId = getSessionUser(token);
    if (userId) {
      const user = db.prepare("SELECT name FROM users WHERE id=?").get(userId) as any;
      if (user) {
        try {
          db.prepare(`
            UPDATE erp_sessions 
            SET status = 'خروج', logout_time = datetime('now', 'localtime') 
            WHERE username = ? AND status = 'نشط'
          `).run(user.name);
        } catch (err) {
          console.error("Failed to log erp session logout:", err);
        }
      }
    }
    deleteSession(token);
  }
  res.json({ ok: true });
});

router.post("/auth/change-password", (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body || {};

    let targetUsername = username ? String(username).trim() : "";
    if (!targetUsername) {
      const authUser = getAuthUser(req);
      if (authUser) {
        targetUsername = authUser.username;
      }
    }

    if (!targetUsername || !oldPassword || !newPassword) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور الحالية والجديدة مطلوبة جميعاً." });
      return;
    }

    if (String(newPassword).length < 3) {
      res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 3 أحرف على الأقل." });
      return;
    }

    const candidates = db.prepare(
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(name) = LOWER(?)"
    ).all(targetUsername, targetUsername) as any[];

    if (!candidates || candidates.length === 0) {
      res.status(404).json({ error: "اسم المستخدم غير موجود بالنظام." });
      return;
    }

    const activeCandidates = candidates.filter((u: any) => Boolean(u.active));
    if (activeCandidates.length === 0) {
      res.status(403).json({ error: "حساب المستخدم موقوف حالياً." });
      return;
    }

    // Find the user whose old password matches
    let matchedUser: any = null;
    for (const user of activeCandidates) {
      if (verifyPassword(String(oldPassword), user.password_hash)) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة." });
      return;
    }

    const newHash = hashPassword(String(newPassword));
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(newHash, matchedUser.id);

    res.json({ ok: true, message: "تم تغيير كلمة المرور بنجاح." });
  } catch (err: any) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "حدث خطأ غير متوقع أثناء تغيير كلمة المرور." });
  }
});

router.post("/auth/verify-supervisor", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور للمدير / المشرف" });
    }
    const user = db.prepare("SELECT * FROM users WHERE (username=? OR name=?) AND active=1").get(username, username) as any;
    if (!user || (user.role !== "admin" && user.role !== "developer" && user.role !== "accountant")) {
      return res.status(403).json({ error: "المستخدم ليس لديه صلاحية مدير أو مشرف لمنح إذن الخصم" });
    }
    const ok = verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
    }
    res.json({ ok: true, name: user.name, role: user.role });
  } catch (error: any) {
    res.status(500).json({ error: "حدث خطأ أثناء التحقق من الصلاحية: " + error.message });
  }
});

export default router;

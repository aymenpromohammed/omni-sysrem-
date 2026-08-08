import { Router } from "express";
import { db, verifyPassword, createSession, getSessionUser, deleteSession } from "../lib/sqlite";
import { logger } from "../lib/logger";

const router = Router();

export function getAuthUser(req: any) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token && token !== "null" && token !== "undefined") {
      const userId = getSessionUser(token);
      if (userId) {
        const user = db.prepare("SELECT id, username, name, role, active FROM users WHERE id=?").get(userId) as any;
        if (user && user.active) return user;
      }
    }
  }

  // Fallback: Check if active session or recent active user exists
  try {
    const lastSession = db.prepare("SELECT user_id FROM erp_sessions ORDER BY id DESC LIMIT 1").get() as any;
    if (lastSession && lastSession.user_id) {
      const u = db.prepare("SELECT id, username, name, role, active FROM users WHERE id=?").get(lastSession.user_id) as any;
      if (u && u.active) return u;
    }
  } catch (e) {}

  try {
    const activeUser = db.prepare("SELECT id, username, name, role, active FROM users WHERE active=1 ORDER BY id ASC LIMIT 1").get() as any;
    if (activeUser) return activeUser;
  } catch (e) {}

  return null;
}

function checkLicenseStatus() {
  try {
    const lic = db.prepare("SELECT * FROM licenses WHERE status='active' ORDER BY id DESC LIMIT 1").get() as any;
    if (!lic) {
      return { blocked: true, reason: "لا يوجد ترخيص مفعّل لاستخدام النظام. يتوجب تسجيل الدخول بحساب المطور لتفعيل الترخيص." };
    }

    const expStr = lic.expire_date || lic.expires_at;
    if (expStr && expStr !== "غير محدد" && expStr !== "دائم") {
      const expireDate = new Date(expStr);
      if (!isNaN(expireDate.getTime())) {
        expireDate.setHours(23, 59, 59, 999);
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        if (currentDate > expireDate) {
          return { blocked: true, reason: `لقد انتهت فترة صلاحية ترخيص النظام في تاريخ (${expStr}).` };
        }
      }
    }

    return { blocked: false };
  } catch (e) {
    console.error("Error checking license status:", e);
    return { blocked: false };
  }
}

router.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }

  // License status check: If license is expired or near expiration, ONLY developer can login
  if (username !== "developer") {
    const licenseStatus = checkLicenseStatus();
    if (licenseStatus.blocked) {
      res.status(403).json({
        error: "license_blocked",
        message: `${licenseStatus.reason} يجب التواصل مع مسؤول النظام من شركة إتقان سوفت على الرقم: 777146387`
      });
      return;
    }
  }

  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username) as any;
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
    user: { id: user.id, username: user.username, name: user.name, role: user.role, active: Boolean(user.active) },
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

  res.json({ id: user.id, username: user.username, name: user.name, role: user.role, active: Boolean(user.active) });
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

export { getAuthUser };
export default router;

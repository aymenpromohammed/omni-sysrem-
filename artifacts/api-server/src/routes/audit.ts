import { Router } from "express";
import { db } from "../lib/sqlite";
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

router.get("/audit-logs", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  let logs: any[];
  if (user && user.role === "developer") {
    logs = db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200").all();
  } else {
    // Non-developers must NOT see developer logs or operations
    logs = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE user_name NOT IN ('المطور', 'developer')
        AND (user_id IS NULL OR user_id NOT IN (SELECT id FROM users WHERE role = 'developer' OR username = 'developer'))
        AND action NOT LIKE '%ترخيص%'
        AND action NOT LIKE '%مطور%'
        AND details NOT LIKE '%مطور%'
      ORDER BY created_at DESC LIMIT 200
    `).all();
  }
  res.json(logs);
});

export default router;

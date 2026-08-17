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
  let logs = db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200").all() as any[];
  if (user && user.role !== "developer") {
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
});

export default router;

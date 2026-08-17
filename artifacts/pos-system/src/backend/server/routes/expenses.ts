import { Router } from "express";
import { db, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function requireAuth(req: any, res: any): any {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return null; }
  return user;
}

router.get("/expenses", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const expenses = db.prepare(`
    SELECT e.*, u.name as user_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.user_id
    ORDER BY e.expense_date DESC, e.id DESC
  `).all();
  res.json(expenses);
});

router.post("/expenses", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { category, amount, expense_date, notes } = req.body;
  if (!category || !amount) { res.status(400).json({ category, amount, error: "التصنيف والمبلغ مطلوبان" }); return; }
  const r = db.prepare("INSERT INTO expenses (category, amount, expense_date, notes, user_id) VALUES (?,?,?,?,?)")
    .run(category, amount, expense_date ?? new Date().toISOString().slice(0, 10), notes ?? null, user.id);
  logAudit(user.id, user.name, "إضافة مصروف", `مصروف ${category} بمبلغ ${amount}`);
  res.status(201).json({ id: r.lastInsertRowid, category, amount, expense_date, notes, user_id: user.id });
});

router.delete("/expenses/:id", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  db.prepare("DELETE FROM expenses WHERE id=?").run(req.params.id);
  logAudit(user.id, user.name, "حذف مصروف", `رقم المصروف: ${req.params.id}`);
  res.status(204).send();
});

export default router;

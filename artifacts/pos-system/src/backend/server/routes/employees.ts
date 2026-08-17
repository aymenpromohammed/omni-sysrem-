import { Router } from "express";
import { db } from "../lib/sqlite";

const router = Router();

function fmt(e: any) {
  if (!e) return e;
  return {
    ...e,
    salary: e.salary ? Number(e.salary) : null,
    isActive: e.is_active === 1 || e.is_active === true,
    joinDate: e.join_date ?? e.joinDate ?? null,
  };
}

router.get("/employees", async (req, res) => {
  try {
    const { search, role } = req.query;
    let rows = db.prepare("SELECT * FROM restaurant_employees ORDER BY name ASC").all() as any[];
    if (role) rows = rows.filter((e) => e.role === role);
    if (search) {
      const s = String(search).toLowerCase();
      rows = rows.filter((e) => (e.name ?? "").toLowerCase().includes(s) || (e.phone ?? "").includes(s));
    }
    res.json(rows.map(fmt));
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/employees", async (req, res) => {
  try {
    const { name, phone, email, role, salary, joinDate } = req.body;
    const resInsert = db.prepare(
      "INSERT INTO restaurant_employees (name, phone, email, role, salary, join_date) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(name, phone || null, email || null, role ?? "waiter", salary ? Number(salary) : null, joinDate || null);
    const emp = db.prepare("SELECT * FROM restaurant_employees WHERE id = ?").get(resInsert.lastInsertRowid);
    res.status(201).json(fmt(emp));
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/employees/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const emp = db.prepare("SELECT * FROM restaurant_employees WHERE id = ?").get(id);
    if (!emp) return res.status(404).json({ error: "Not found" });
    res.json(fmt(emp));
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/employees/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, email, role, salary, isActive, joinDate } = req.body;
    const existing = db.prepare("SELECT * FROM restaurant_employees WHERE id = ?").get(id) as any;
    if (!existing) return res.status(404).json({ error: "Not found" });

    db.prepare(
      "UPDATE restaurant_employees SET name=?, phone=?, email=?, role=?, salary=?, is_active=?, join_date=? WHERE id=?"
    ).run(
      name !== undefined ? name : existing.name,
      phone !== undefined ? phone : existing.phone,
      email !== undefined ? email : existing.email,
      role !== undefined ? role : existing.role,
      salary !== undefined ? (salary ? Number(salary) : null) : existing.salary,
      isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
      joinDate !== undefined ? joinDate : existing.join_date,
      id
    );

    const updated = db.prepare("SELECT * FROM restaurant_employees WHERE id = ?").get(id);
    res.json(fmt(updated));
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/employees/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare("DELETE FROM restaurant_employees WHERE id = ?").run(id);
    res.status(204).send();
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

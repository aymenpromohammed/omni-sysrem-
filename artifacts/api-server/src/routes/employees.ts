import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function fmt(e: typeof employeesTable.$inferSelect) {
  return { ...e, salary: e.salary ? Number(e.salary) : null };
}

router.get("/employees", async (req, res) => {
  try {
    const { search, role } = req.query;
    let rows = await db.select().from(employeesTable).orderBy(employeesTable.name);
    if (role) rows = rows.filter((e) => e.role === role);
    if (search) {
      const s = String(search).toLowerCase();
      rows = rows.filter((e) => e.name.toLowerCase().includes(s) || (e.phone ?? "").includes(s));
    }
    res.json(rows.map(fmt));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/employees", async (req, res) => {
  try {
    const { name, phone, email, role, salary, joinDate } = req.body;
    const [emp] = await db.insert(employeesTable).values({
      name, phone, email,
      role: role ?? "waiter",
      salary: salary ? String(salary) : null,
      joinDate,
    }).returning();
    res.status(201).json(fmt(emp));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/employees/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
    if (!emp) return res.status(404).json({ error: "Not found" });
    res.json(fmt(emp));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/employees/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, email, role, salary, isActive, joinDate } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (salary !== undefined) updates.salary = salary ? String(salary) : null;
    if (isActive !== undefined) updates.isActive = isActive;
    if (joinDate !== undefined) updates.joinDate = joinDate;
    const [emp] = await db.update(employeesTable).set(updates).where(eq(employeesTable.id, id)).returning();
    if (!emp) return res.status(404).json({ error: "Not found" });
    res.json(fmt(emp));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/employees/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(employeesTable).where(eq(employeesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

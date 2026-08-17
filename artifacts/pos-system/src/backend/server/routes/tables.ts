import { Router } from "express";
import { db } from "../lib/sqlite";

const router = Router();

router.get("/tables", async (req, res) => {
  try {
    const { status } = req.query;
    let rows = db.prepare("SELECT * FROM restaurant_tables ORDER BY number ASC").all() as any[];
    if (status) rows = rows.filter((t) => t.status === status);
    res.json(rows);
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tables", async (req, res) => {
  try {
    const { number, name, capacity, section } = req.body;
    const resInsert = db.prepare(
      "INSERT INTO restaurant_tables (number, name, capacity, section) VALUES (?, ?, ?, ?)"
    ).run(Number(number), name, Number(capacity || 4), section || null);
    const table = db.prepare("SELECT * FROM restaurant_tables WHERE id = ?").get(resInsert.lastInsertRowid);
    res.status(201).json(table);
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tables/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const table = db.prepare("SELECT * FROM restaurant_tables WHERE id = ?").get(id);
    if (!table) return res.status(404).json({ error: "Not found" });
    res.json(table);
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tables/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { number, name, capacity, status, section } = req.body;
    const existing = db.prepare("SELECT * FROM restaurant_tables WHERE id = ?").get(id) as any;
    if (!existing) return res.status(404).json({ error: "Not found" });

    db.prepare(
      "UPDATE restaurant_tables SET number=?, name=?, capacity=?, status=?, section=? WHERE id=?"
    ).run(
      number !== undefined ? Number(number) : existing.number,
      name !== undefined ? name : existing.name,
      capacity !== undefined ? Number(capacity) : existing.capacity,
      status !== undefined ? status : existing.status,
      section !== undefined ? section : existing.section,
      id
    );

    const updated = db.prepare("SELECT * FROM restaurant_tables WHERE id = ?").get(id);
    res.json(updated);
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tables/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare("DELETE FROM restaurant_tables WHERE id = ?").run(id);
    res.status(204).send();
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

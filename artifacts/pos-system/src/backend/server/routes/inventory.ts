import { Router } from "express";
import { db } from "../lib/sqlite";

const router = Router();

function fmt(item: any) {
  if (!item) return item;
  const cur = Number(item.current_stock ?? item.currentStock ?? 0);
  const min = Number(item.min_stock ?? item.minStock ?? 0);
  const cost = Number(item.cost_per_unit ?? item.costPerUnit ?? 0);
  const max = item.max_stock ?? item.maxStock ? Number(item.max_stock ?? item.maxStock) : null;
  return {
    id: item.id,
    name: item.name,
    nameAr: item.name_ar ?? item.nameAr ?? item.name,
    unit: item.unit,
    currentStock: cur,
    minStock: min,
    maxStock: max,
    costPerUnit: cost,
    supplier: item.supplier ?? null,
    totalValue: cur * cost,
    isLowStock: cur <= min,
  };
}

router.get("/inventory/summary", async (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM inventory_items").all() as any[];
    const formatted = rows.map(fmt);
    const totalItems = formatted.length;
    const lowStockItems = formatted.filter((i) => i.currentStock <= i.minStock).length;
    const outOfStockItems = formatted.filter((i) => i.currentStock === 0).length;
    const totalValue = formatted.reduce((acc, i) => acc + i.totalValue, 0);
    res.json({ totalItems, lowStockItems, outOfStockItems, totalValue: Number(totalValue.toFixed(2)) });
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/inventory", async (req, res) => {
  try {
    const { search, lowStock } = req.query;
    let rows = db.prepare("SELECT * FROM inventory_items ORDER BY name ASC").all() as any[];
    let formatted = rows.map(fmt);
    if (lowStock === "true") formatted = formatted.filter((i) => i.currentStock <= i.minStock);
    if (search) {
      const s = String(search).toLowerCase();
      formatted = formatted.filter((i) => i.name.toLowerCase().includes(s) || i.nameAr.toLowerCase().includes(s));
    }
    res.json(formatted);
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/inventory", async (req, res) => {
  try {
    const { name, nameAr, unit, currentStock, minStock, maxStock, costPerUnit, supplier } = req.body;
    const resInsert = db.prepare(
      "INSERT INTO inventory_items (name, name_ar, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      name,
      nameAr || name,
      unit,
      Number(currentStock || 0),
      Number(minStock || 0),
      maxStock ? Number(maxStock) : null,
      Number(costPerUnit || 0),
      supplier || null
    );
    const item = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(resInsert.lastInsertRowid);
    res.status(201).json(fmt(item));
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/inventory/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(fmt(item));
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/inventory/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, nameAr, unit, currentStock, minStock, maxStock, costPerUnit, supplier } = req.body;
    const existing = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(id) as any;
    if (!existing) return res.status(404).json({ error: "Not found" });

    db.prepare(
      "UPDATE inventory_items SET name=?, name_ar=?, unit=?, current_stock=?, min_stock=?, max_stock=?, cost_per_unit=?, supplier=? WHERE id=?"
    ).run(
      name !== undefined ? name : existing.name,
      nameAr !== undefined ? nameAr : existing.name_ar,
      unit !== undefined ? unit : existing.unit,
      currentStock !== undefined ? Number(currentStock) : existing.current_stock,
      minStock !== undefined ? Number(minStock) : existing.min_stock,
      maxStock !== undefined ? (maxStock ? Number(maxStock) : null) : existing.max_stock,
      costPerUnit !== undefined ? Number(costPerUnit) : existing.cost_per_unit,
      supplier !== undefined ? supplier : existing.supplier,
      id
    );

    const updated = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(id);
    res.json(fmt(updated));
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/inventory/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare("DELETE FROM inventory_items WHERE id = ?").run(id);
    res.status(204).send();
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

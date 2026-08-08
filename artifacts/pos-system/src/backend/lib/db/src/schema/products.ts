import { sqliteTable, integer, text, numeric } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const productsTable = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description"),
  price: numeric("price").notNull(),
  costPrice: numeric("cost_price"),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  barcode: text("barcode"),
  image: text("image"),
  isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
  preparationTime: integer("preparation_time"),
  calories: integer("calories"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

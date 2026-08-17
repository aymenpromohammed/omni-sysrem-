import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tablesTable = sqliteTable("restaurant_tables", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: integer("number").notNull().unique(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  status: text("status").notNull().default("available"),
  section: text("section"),
  currentOrderId: integer("current_order_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const insertTableSchema = createInsertSchema(tablesTable).omit({ id: true, createdAt: true });
export type InsertTable = z.infer<typeof insertTableSchema>;
export type RestaurantTable = typeof tablesTable.$inferSelect;

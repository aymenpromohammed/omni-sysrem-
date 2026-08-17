import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { tablesTable } from "./tables";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  type: text("type").notNull().default("dine_in"), // dine_in, takeaway, delivery
  status: text("status").notNull().default("pending"), // pending, confirmed, preparing, ready, served, paid, cancelled
  tableId: integer("table_id").references(() => tablesTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method"), // cash, card, transfer, wallet
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  productNameAr: text("product_name_ar").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending, preparing, ready, served
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true, orderNumber: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;

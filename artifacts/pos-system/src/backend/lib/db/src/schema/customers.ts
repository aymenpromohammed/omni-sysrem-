import { sqliteTable, integer, text, numeric } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: numeric("total_spent").notNull().default("0"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(new Date()),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, totalOrders: true, totalSpent: true, loyaltyPoints: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;

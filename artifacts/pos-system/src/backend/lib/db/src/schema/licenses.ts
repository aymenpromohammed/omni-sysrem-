import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const licensesTable = pgTable("licenses", {
  id: serial("id").primaryKey(),
  licenseKey: text("license_key").notNull().unique(),
  customerId: text("customer_id"),
  companyName: text("company_name").notNull(),
  licenseType: text("license_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  expireDate: timestamp("expire_date"),
  status: text("status").notNull().default("pending"),
  machineId: text("machine_id"),
  branchLimit: integer("branch_limit").notNull().default(1),
  userLimit: integer("user_limit").notNull().default(5),
  posLimit: integer("pos_limit").notNull().default(1),
  notes: text("notes"),
  createdDate: timestamp("created_date").notNull().defaultNow(),
});

export const licenseActivationsTable = pgTable("license_activations", {
  id: serial("id").primaryKey(),
  licenseId: integer("license_id").notNull(),
  machineId: text("machine_id").notNull(),
  ipAddress: text("ip_address"),
  activationDate: timestamp("activation_date").notNull().defaultNow(),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
});

export const licenseLogsTable = pgTable("license_logs", {
  id: serial("id").primaryKey(),
  licenseId: integer("license_id").notNull(),
  action: text("action").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  user: text("user"),
  details: text("details"),
});

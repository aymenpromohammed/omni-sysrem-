import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbPath = process.env.DATABASE_URL.replace("file:", "");
export const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

export * from "./schema";

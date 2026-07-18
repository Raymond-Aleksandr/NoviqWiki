import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki"
  },
  verbose: true,
  strict: true
});

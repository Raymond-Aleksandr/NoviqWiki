import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://nextwiki:nextwiki@localhost:5432/nextwiki"
  },
  verbose: true,
  strict: true
});

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Tests never touch a real database: lib/db.ts returns empty results when
    // DATABASE_URL is unset, so make sure it is unset here.
    env: { DATABASE_URL: "" },
  },
});

import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  aiGateway: true,
  buckets: {
    birds: { access: "private" },
  },
  functions: {
    api: {
      name: "Bird ID API",
      source: "./functions/api.ts",
      env: {
        NEON_AI_MODEL: process.env.NEON_AI_MODEL ?? "gpt-5-4-mini",
      },
    },
  },
  branch: (branch) => {
    if (branch.isDefault) return {};
    if (!branch.exists) return { ttl: "7d" };
    return {};
  },
});

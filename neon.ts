import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  aiGateway: true,
  buckets: {
    birds: { access: "private" },
    previews: { access: "private" },
    screens: { access: "private" },
  },
  functions: {
    api: {
      name: "Bird ID API",
      source: "./functions/api.ts",
      externalPackages: ["sharp"],
      env: {
        NEON_AI_MODEL: process.env.NEON_AI_MODEL ?? "gpt-5-4-mini",
        SHARE_APP_URL:
          process.env.SHARE_APP_URL ?? "https://bird-id.app/",
        SHARE_PUBLIC_URL:
          process.env.SHARE_PUBLIC_URL ?? "https://share.bird-id.app/",
      },
    },
  },
  branch: (branch) => {
    if (branch.isDefault) return {};
    if (!branch.exists) return { ttl: "7d" };
    return {};
  },
});

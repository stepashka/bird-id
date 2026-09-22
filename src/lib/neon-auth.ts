import { createInternalNeonAuth } from "@neondatabase/auth";
import {
  BetterAuthReactAdapter,
  type BetterAuthReactAdapterInstance,
} from "@neondatabase/auth/react/adapters";
import { createBirdApi } from "./browser-api";
import { readPublicConfig } from "./public-config";

const config = readPublicConfig(import.meta.env);
const neonAuth = createInternalNeonAuth<BetterAuthReactAdapterInstance>(
  config.authUrl,
  {
  adapter: BetterAuthReactAdapter(),
  },
);

export const authClient = neonAuth.adapter;
export const birdApi = createBirdApi({
  baseUrl: config.functionUrl,
  getToken: neonAuth.getJWTToken,
});

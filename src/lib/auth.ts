import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/app-url";

/**
 * Better Auth server instance (FEAT-0008). Used by the API route handler and server-side session helpers.
 * Email/password and Google are enabled; UI and redirects are implemented in later slices.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: getAppBaseUrl(),
  trustedOrigins: [getAppBaseUrl()],
  plugins: [nextCookies()],
  emailAndPassword: {
    enabled: true,
  },
});

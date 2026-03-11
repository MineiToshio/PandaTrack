import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/app-url";
import { buildVerificationConfirmHref, getLocaleSegment } from "@/lib/authRedirect";
import { buildAuthVerificationEmail } from "@/lib/authVerificationEmail";
import { sendEmailWithResend } from "@/lib/resend";

/**
 * Better Auth server instance used by the API route handler and server-side session helpers.
 * Email/password and Google providers are enabled.
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
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, token, url }, request) => {
      const rawVerificationUrl = new URL(url);
      const originalCallbackURL = rawVerificationUrl.searchParams.get("callbackURL");
      const callbackPathname = originalCallbackURL
        ? new URL(originalCallbackURL, "https://pandatrack.local").pathname
        : null;
      const locale = callbackPathname ? (getLocaleSegment(callbackPathname) ?? "es") : "es";
      const verificationPath = buildVerificationConfirmHref(locale, token, originalCallbackURL);
      const verificationUrl = new URL(verificationPath, getAppBaseUrl()).toString();

      const emailContent = await buildAuthVerificationEmail({
        verificationUrl,
        request,
      });

      await sendEmailWithResend({
        to: user.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.BETTER_AUTH_GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.BETTER_AUTH_GOOGLE_CLIENT_SECRET ?? "",
    },
  },
});

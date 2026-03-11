import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/app-url";
import { handlePasswordRecoveryRequest } from "@/lib/auth/authPasswordRecovery";
import { buildVerificationConfirmHref, getLocaleSegment } from "@/lib/auth/authRedirect";
import { buildAuthVerificationEmail } from "@/lib/auth/authVerificationEmail";
import { syncAuthenticatedUserToKit } from "@/lib/integrations/kit";
import { sendEmailWithResend } from "@/lib/integrations/resend";

/**
 * Better Auth server instance used by the API route handler and server-side session helpers.
 * Email/password and Google providers are enabled.
 * Account linking: when a user signs in with Google using an email that already has an
 * email/password account, the Google account is linked to the same user (no duplicate).
 * Profile hydration: name and image from Google are stored when available.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: getAppBaseUrl(),
  trustedOrigins: [getAppBaseUrl()],
  plugins: [nextCookies()],
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      updateUserInfoOnLink: true,
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, token, url }, request) => {
      await handlePasswordRecoveryRequest({
        email: user.email,
        request,
        token,
        url,
      });
    },
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
      mapProfileToUser: (profile) => {
        const name =
          (profile.name && profile.name.trim()) ||
          [profile.given_name, profile.family_name].filter(Boolean).join(" ").trim() ||
          profile.email?.split("@")[0] ||
          "User";
        return {
          name,
          image: profile.picture ?? null,
        };
      },
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (newSession?.user?.email) {
        const email = newSession.user.email;
        const name = newSession.user.name ?? null;
        void syncAuthenticatedUserToKit(email, name).catch(() => {});
      }
    }),
  },
});

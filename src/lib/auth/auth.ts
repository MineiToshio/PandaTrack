import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl, getPublicSiteUrl } from "@/lib/app-url";
import { captureBrowsingLocaleOnSignIn } from "@/lib/auth/authLocaleCapture";
import { handlePasswordRecoveryRequest } from "@/lib/auth/authPasswordRecovery";
import { buildVerificationConfirmHref, getLocaleSegment } from "@/lib/auth/authRedirect";
import { buildAuthVerificationEmail } from "@/lib/auth/authVerificationEmail";
import { syncAuthenticatedUserToKit } from "@/lib/integrations/kit";
import { sendEmailWithResend } from "@/lib/integrations/resend";
import { generateUniqueUsernameForNewUser } from "@/lib/user-settings/usernameGeneration";
import { clearUnverifiedGraceStartsAt } from "@/lib/data/auth/userMutations";

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
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = typeof user.email === "string" ? user.email.trim() : "";
          if (!email) {
            return false;
          }
          try {
            const generated = await generateUniqueUsernameForNewUser(email);
            return {
              data: {
                ...user,
                username: generated.username,
              },
            };
          } catch (error) {
            Sentry.captureException(error);
            return false;
          }
        },
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: getPublicSiteUrl(),
  /**
   * Origins allowed to talk to Better Auth. The base + public URLs cover production
   * and the canonical local dev URL. `BETTER_AUTH_EXTRA_ORIGINS` is a dev-only
   * escape hatch — comma-separated list of additional origins to trust (e.g. when
   * serving the dev server bound to `0.0.0.0` so a phone on the same LAN can sign
   * in via `http://192.168.x.x:3001`). Empty / unset in production.
   */
  trustedOrigins: [
    ...new Set([
      getAppBaseUrl(),
      getPublicSiteUrl(),
      ...(process.env.BETTER_AUTH_EXTRA_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter(Boolean),
    ]),
  ],
  advanced: {
    /**
     * Force non-secure cookies in dev so the session works over plain HTTP
     * (localhost + LAN IP like `192.168.x.x:3001`). Better Auth's auto-detect
     * adds `Secure` + the `__Secure-` prefix even when baseURL is HTTP, which
     * silently breaks sign-in on a LAN IP because browsers only allow Secure
     * cookies on `localhost` HTTP (never on a non-loopback host). In production
     * (Vercel / any HTTPS deploy) NODE_ENV is `production` → secure cookies
     * stay enabled.
     */
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  /**
   * Load session user from the database on each request so server actions that update `user.email`
   * (immediate email change) are visible to the next Better Auth call in the same flow without stale
   * JWT-in-cookie user snapshots.
   */
  session: {
    cookieCache: {
      enabled: false,
    },
  },
  // `admin` adds the database-backed role and the plugin's forward-compatible ban/impersonation
  // fields. `adminRoles` and `defaultRole` are both explicit; new accounts default to `user` and no
  // account is an administrator until the bootstrap grants the first one. `nextCookies` stays last.
  plugins: [admin({ adminRoles: ["admin"], defaultRole: "user" }), nextCookies()],
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      updateUserInfoOnLink: true,
    },
  },
  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
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
    afterEmailVerification: async (user) => {
      try {
        await clearUnverifiedGraceStartsAt(user.id);
      } catch (error) {
        Sentry.captureException(error);
      }
    },
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
    /**
     * Runs after every successful authentication, including Google and including a sign-in
     * that links an existing account (where the user-create database hook never fires), so
     * it is the one place that sees every collector who arrives with a fresh session.
     */
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (!newSession?.user) {
        return;
      }

      const { id, email, name } = newSession.user;

      if (email) {
        void syncAuthenticatedUserToKit(email, name ?? null).catch(() => {});
      }

      // Email sign-in / sign-up carry the locale-prefixed callback in the request body; the
      // OAuth callback endpoint carries no body and instead redirects to it, so its redirect
      // location is the equivalent signal.
      const body = ctx.body as { callbackURL?: unknown } | undefined;
      const query = ctx.query as { callbackURL?: unknown } | undefined;

      await captureBrowsingLocaleOnSignIn(id, {
        bodyCallbackURL: body?.callbackURL,
        queryCallbackURL: query?.callbackURL,
        redirectLocation: ctx.context.responseHeaders?.get("location") ?? null,
        cookieHeader: ctx.headers?.get("cookie") ?? null,
      });
    }),
  },
});

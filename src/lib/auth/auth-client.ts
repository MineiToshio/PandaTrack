"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client for browser. Use in auth entry pages and any client component
 * that needs sign-in, sign-up, sign-out, or session. Same-origin: no baseURL needed.
 */
export const authClient = createAuthClient();

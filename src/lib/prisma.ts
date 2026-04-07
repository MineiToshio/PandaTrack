import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../generated/prisma/client";
import { generateUniqueUsernameForNewUser } from "@/lib/user-settings/usernameGeneration";

declare global {
  var prisma: PrismaClient | undefined;
}

const globalForPrisma = global as typeof globalThis & {
  prisma?: PrismaClient;
};

const LEGACY_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

function normalizeDatabaseUrlSslMode(databaseUrl: string | undefined): string | undefined {
  if (!databaseUrl) {
    return databaseUrl;
  }

  try {
    const parsedUrl = new URL(databaseUrl);
    const sslMode = parsedUrl.searchParams.get("sslmode");

    if (sslMode && LEGACY_SSL_MODES.has(sslMode.toLowerCase())) {
      parsedUrl.searchParams.set("sslmode", "verify-full");
      return parsedUrl.toString();
    }

    return databaseUrl;
  } catch {
    // Keep original value if URL parsing fails.
    return databaseUrl;
  }
}

const pool = new Pool({
  connectionString: normalizeDatabaseUrlSslMode(process.env.DATABASE_URL),
  allowExitOnIdle: true,
});

const adapter = new PrismaPg(pool);

const basePrisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

const prisma = basePrisma.$extends({
  query: {
    user: {
      async create({ args, query }) {
        const currentUsername = "username" in args.data ? args.data.username : undefined;
        const email = "email" in args.data && typeof args.data.email === "string" ? args.data.email.trim() : "";

        if (!currentUsername && email) {
          const generated = await generateUniqueUsernameForNewUser(basePrisma, email);
          args.data = {
            ...args.data,
            username: generated.username,
          };
        }

        return query(args);
      },
    },
  },
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

export { prisma };

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../generated/prisma/client";

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

const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { prisma };

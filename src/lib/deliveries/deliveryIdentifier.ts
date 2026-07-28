import type { Prisma } from "../../../generated/prisma/client";

const IDENTIFIER_PREFIX = "DLV";
const SEQUENCE_PADDING_LENGTH = 2;

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function buildDailyPrefix(date: Date): string {
  return `${IDENTIFIER_PREFIX}-${formatUtcDate(date)}-`;
}

function parseSequenceFromId(humanReadableId: string): number {
  const lastDashIndex = humanReadableId.lastIndexOf("-");
  if (lastDashIndex === -1) return 0;
  const raw = humanReadableId.slice(lastDashIndex + 1);
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export async function generateDeliveryHumanReadableId(
  tx: Prisma.TransactionClient,
  userId: string,
  date: Date,
): Promise<string> {
  const prefix = buildDailyPrefix(date);

  // Lexicographic ordering breaks once sequences reach three digits ("99" > "100"),
  // so the highest sequence must be computed numerically over the day's identifiers.
  const sameDayDeliveries = await tx.delivery.findMany({
    where: {
      userId,
      humanReadableId: { startsWith: prefix },
    },
    select: { humanReadableId: true },
  });

  const highestSequence = sameDayDeliveries.reduce(
    (max, delivery) => Math.max(max, parseSequenceFromId(delivery.humanReadableId)),
    0,
  );
  const nextSequence = highestSequence + 1;
  const paddedSequence = String(nextSequence).padStart(SEQUENCE_PADDING_LENGTH, "0");
  return `${prefix}${paddedSequence}`;
}

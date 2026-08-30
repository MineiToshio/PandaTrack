import { Prisma, type StoreStatus } from "../../../../generated/prisma/client";
import { runSerializableTransaction } from "../serializableTransaction";
import {
  findIntakeStoreRelation,
  MIN_PHONE_MATCH_DIGITS,
  normalizePhoneDigits,
  phoneDigitsMatch,
} from "./storeMatchingQueries";
import { createStore, type ContactChannelInput } from "./storeMutations";

/**
 * Store writes for the image-intake store step: inline creation on an `unknown` match, and
 * remembering a confirmed or corrected phone match on an `ambiguous` one.
 */

export type CreateStoreFromIntakeInput = {
  name: string;
  phone: string | null;
  countryCode: string;
  createdByUserId: string;
  status: StoreStatus;
  approvedByUserId: string | null;
};

/**
 * Creates the store for an intake draft with no confident match. Calls the same
 * `createStore` write the manual store-creation form uses, so the result is indistinguishable from
 * a store created by hand: same slug generation, same `searchName`, same moderation default.
 *
 * The draft carries no seller-type signal (`ImageIntakeDraft["store"]` has only a name, a phone and
 * candidate ids), and `sellerType` is immutable once written (`BR-04-17`), so this picks the only
 * value that is safe to be wrong about: `PERSON` with `isPrivate: true` keeps a counterparty read
 * out of somebody's private chat out of the shared directory. Asking the collector instead was
 * considered and rejected: at this moment they are recording an order, not curating a catalog, and
 * a forced choice on a permanent field would record a guess as a decision.
 *
 * The phone is written non-public. It is a matching hint the app inferred from a screenshot, never
 * a number the seller published, and it must not become one if the store's type or privacy ever
 * changes — the same rule, for the same reason, that `recordConfirmedStoreMatch` applies below.
 */
export async function createStoreFromIntake(input: CreateStoreFromIntakeInput): Promise<{ id: string; slug: string }> {
  const digits = input.phone ? normalizePhoneDigits(input.phone) : "";
  const contactChannels: ContactChannelInput[] =
    digits.length >= MIN_PHONE_MATCH_DIGITS ? [{ type: "PHONE", value: digits, label: null, isPublic: false }] : [];

  return createStore({
    name: input.name,
    sellerType: "PERSON",
    countryCode: input.countryCode,
    status: input.status,
    createdByUserId: input.createdByUserId,
    approvedByUserId: input.approvedByUserId,
    isPrivate: true,
    presenceTypes: ["ONLINE"],
    productTypeKeys: [],
    contactChannels,
  });
}

/**
 * Ceiling on how many inferred (non-public) phone channels a single store can accumulate from
 * intake confirmations.
 *
 * A store legitimately has a handful of numbers at most, and every row added here widens what the
 * phone matcher will accept as that store. Without a ceiling, a caller with a real relationship to
 * one store could still keep appending numbers to it until every receipt in the catalog resolved
 * there. Public channels, which only the store's own moderated record can produce, are not counted:
 * the cap governs what intake is allowed to add, not what the store already declared.
 */
export const MAX_LEARNED_PHONE_CHANNELS_PER_STORE = 5;

/**
 * Why a confirmation did or did not teach the matcher anything. Every value except `recorded` means
 * nothing was written.
 */
export type RecordConfirmedStoreMatchOutcome =
  "recorded" | "no-phone" | "already-known" | "not-related" | "limit-reached";

/**
 * Remembers a confirmed or corrected phone-to-store association by attaching a private `PHONE`
 * contact channel to the store the user picked, reusing the existing `StoreContactChannel` model
 * rather than a dedicated table.
 *
 * Learning is deliberately restricted to stores the caller created or has already bought from. The
 * review screen is handed the entire orderable catalog, so the store id reaching this function is
 * fully caller-controlled: without the relationship check, any authenticated user could attach their
 * own number to a store they have never dealt with, and from then on every other user's receipt
 * carrying that number would resolve to it. Seeding one number across many stores would equally let
 * a caller force everyone else's match into the ambiguous branch. Restricting the write to a store
 * the caller demonstrably transacts with keeps the useful half of the behaviour (the matcher learns
 * the numbers of the sellers a collector actually buys from) and removes the reach into other
 * people's stores entirely. A caller with no relationship gets `not-related` and no write at all;
 * matching still works for them on the name and phone signals already in the catalog, it simply
 * learns nothing new.
 *
 * `isPrimary` is reserved for the store's creator. A primary channel is the store's headline contact
 * detail, and a contributor who merely bought there has no standing to decide it.
 *
 * The channel is written `isPublic: false`: it is an inferred hint for future matching, not a
 * verified contact detail the store owner published.
 */
export async function recordConfirmedStoreMatch(input: {
  userId: string;
  storeId: string;
  phone: string | null;
}): Promise<RecordConfirmedStoreMatchOutcome> {
  const digits = input.phone ? normalizePhoneDigits(input.phone) : "";
  if (digits.length < MIN_PHONE_MATCH_DIGITS) return "no-phone";

  // The relationship check, the dedupe check, and the anti-abuse cap all read state that the
  // `create` below can invalidate: two confirmations racing the same store could each read the
  // same pre-write channel list, both pass the cap, and both write, or elect two primary channels.
  // Serializable isolation makes that read-then-write conflict detectable (the database aborts the
  // loser and `runSerializableTransaction` replays it against fresh data), which a plain read
  // outside a transaction cannot. Every refusal here is decided before the single write, so
  // replaying the whole callback on a serialization conflict is safe (ADR 0022).
  return runSerializableTransaction(async (tx) => {
    const relation = await findIntakeStoreRelation(input.userId, input.storeId, tx);
    if (relation === "none") return "not-related";

    const existingChannels = await tx.storeContactChannel.findMany({
      where: { storeId: input.storeId, type: { in: ["PHONE", "WHATSAPP"] } },
      select: { value: true, isPublic: true },
    });
    const alreadyRemembered = existingChannels.some((channel) =>
      phoneDigitsMatch(digits, normalizePhoneDigits(channel.value)),
    );
    if (alreadyRemembered) return "already-known";

    const learnedChannelCount = existingChannels.filter((channel) => !channel.isPublic).length;
    if (learnedChannelCount >= MAX_LEARNED_PHONE_CHANNELS_PER_STORE) return "limit-reached";

    try {
      await tx.storeContactChannel.create({
        data: {
          storeId: input.storeId,
          type: "PHONE",
          value: digits,
          isPrimary: relation === "creator" && existingChannels.length === 0,
          isPublic: false,
        },
      });
      return "recorded";
    } catch (error) {
      // The `@@unique([storeId, type, value])` DB backstop is the last line of defense against a
      // duplicate learned channel; the dedupe check above should already make it unreachable under
      // Serializable isolation, but if it ever fires, the create wrote nothing (Postgres rejected
      // the statement), so mapping straight to the outcome the dedupe check itself would have
      // produced is safe: no write to roll back, and the caller sees the same benign "already-known"
      // result instead of a raw failure.
      if (isUniqueConstraintViolation(error)) return "already-known";
      throw error;
    }
  });
}

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_ERROR_CODE;
}

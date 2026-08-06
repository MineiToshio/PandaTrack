import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/**
 * One-off repair: marks inferred phone channels as non-public.
 *
 * `StoreContactChannel.isPublic` defaults to `true`, and until this change neither `createStore` nor
 * `createStoreFromIntake` set it. So every phone image intake read out of a chat screenshot was
 * stored flagged for publication. Nothing rendered it, but only because `getStoreBySlug` drops all
 * channels for a `PERSON` store: an accident, one edit or one seller-type difference away from
 * publishing a private individual's number in the shared catalog.
 *
 * Scope: channels belonging to `PERSON` stores. That is a sound discriminator rather than a guess.
 * Both write paths a human can reach drop contact channels entirely for `PERSON`
 * (`createStore`'s action layer and `normalizeEditableStoreInput` both apply
 * `exposesContactInfo = sellerType !== "PERSON"`), so a channel on a `PERSON` store can only have
 * come from image intake or from `recordConfirmedStoreMatch` — inferred in both cases, and already
 * non-public in the second. No channel a store actually published can be caught by this.
 *
 * Run with: npx tsx scripts/backfill-inferred-contact-channel-privacy.ts [--apply]
 * Without `--apply` it only reports what it would change.
 */

const APPLY = process.argv.includes("--apply");

async function main() {
  const affected = await prisma.storeContactChannel.findMany({
    where: { isPublic: true, store: { sellerType: "PERSON" } },
    select: { id: true, type: true, store: { select: { name: true, slug: true } } },
  });

  if (affected.length === 0) {
    console.log("Nothing to repair: no public contact channel belongs to a PERSON store.");
    return;
  }

  console.log(`${affected.length} inferred channel(s) currently flagged public:`);
  for (const channel of affected) {
    console.log(`  - ${channel.type} on "${channel.store.name}" (${channel.store.slug})`);
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write the change.");
    return;
  }

  const { count } = await prisma.storeContactChannel.updateMany({
    where: { isPublic: true, store: { sellerType: "PERSON" } },
    data: { isPublic: false },
  });
  console.log(`\nMarked ${count} channel(s) non-public.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

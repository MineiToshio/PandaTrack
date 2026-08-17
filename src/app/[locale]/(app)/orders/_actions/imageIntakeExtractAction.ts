"use server";

import * as Sentry from "@sentry/nextjs";
import { getTranslations } from "next-intl/server";
import { getIsAdmin, getSession } from "@/lib/auth/auth-server";
import { getPostHogClient } from "@/lib/analytics/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  buildAuthoredStoreProductTypeNameMap,
  resolveStoreProductTypeName,
} from "@/lib/catalog/resolveStoreProductTypeName";
import {
  listActiveStoreProductTypeKeysCached,
  listAuthoredStoreProductTypeNamesCached,
} from "@/lib/data/catalog/storeProductTypeQueries";
import { findStoreMatchesForIntake } from "@/lib/data/stores/storeMatchingQueries";
import { getCollectorPreferencesSnapshot } from "@/lib/data/user-settings/userSettingsQueries";
import { getImageIntakeQuotaSnapshot } from "@/lib/data/imageIntake/imageIntakeQuotaQueries";
import { createImageIntakeSpendGuard } from "@/lib/data/imageIntake/spendGuard";
import { applyBreakdown } from "@/lib/imageIntake/breakdown";
import { IMAGE_INTAKE_MAX_OUTPUT_TOKENS, MAX_PRODUCTS_PER_ORDER } from "@/lib/imageIntake/constants";
import { reportImageIntakeFailure } from "@/lib/imageIntake/diagnostics";
import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import {
  extract,
  isProviderRequestRejected,
  isProviderResponseTruncated,
  readProviderErrorShape,
  readProviderErrorUsage,
  type ExtractionLocale,
  type ExtractionProductCategory,
  type ImageIntakeUsageRecord,
  type SpendGuard,
} from "@/lib/imageIntake/extractionEngine";
import { GeminiExtractionProvider, resolveImageIntakeModelId } from "@/lib/imageIntake/geminiProvider";
import { withCapitalizedProductNames } from "@/lib/imageIntake/productNameCase";
import { withValidatedSuggestedCategories } from "@/lib/imageIntake/suggestedCategory";
import { validateUploadedImages } from "@/lib/imageIntake/validateUpload";
import {
  IMAGE_INTAKE_FILES_FIELD,
  IMAGE_INTAKE_ENTRY_SOURCE_FIELD,
  IMAGE_INTAKE_LOCALE_FIELD,
  type ImageIntakeExtractErrorCode,
  type ImageIntakeExtractResult,
} from "./imageIntakeContract";
import { ImageIntakeEntrySource } from "../../../../../../generated/prisma/client";

type SubmittedFile = { buffer: Buffer; declaredMimeType: string };

function resolveExtractionLocale(value: FormDataEntryValue | null): ExtractionLocale {
  return value === "en" ? "en" : "es";
}

async function readSubmittedFiles(formData: FormData): Promise<SubmittedFile[]> {
  const entries = formData.getAll(IMAGE_INTAKE_FILES_FIELD).filter((entry): entry is File => entry instanceof File);
  return Promise.all(
    entries.map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      declaredMimeType: file.type,
    })),
  );
}

/**
 * Wraps the ledger guard so the settled usage row is also readable here. The extraction engine
 * settles spend internally and its outcome carries only the draft, but the success analytics event
 * has to report the real charge rather than a re-estimate, and this is the one place both figures
 * exist. It forwards every call untouched, so the ledger behaviour is exactly the guard's own.
 */
function withUsageCapture(guard: SpendGuard): { guard: SpendGuard; readUsage: () => ImageIntakeUsageRecord | null } {
  let recorded: ImageIntakeUsageRecord | null = null;
  return {
    guard: {
      assertCanSpend: () => guard.assertCanSpend(),
      recordUsage: async (usage) => {
        recorded = usage;
        await guard.recordUsage(usage);
      },
      recordFailure: (failure) => guard.recordFailure(failure),
    },
    readUsage: () => recorded,
  };
}

/**
 * Reads the active catalog and shapes it into the category list the prompt offers the model.
 *
 * Read live, per request, and never from a hardcoded union: the seeded keys are only part of the
 * catalog, since an administrator can approve a new type at any time and that type exists only as a
 * table row. A frozen list would leave every approved type invisible to extraction, and, far worse,
 * could offer the model a key the catalog no longer backs.
 *
 * Labels follow the hybrid catalog-names model the rest of the app uses: an admin-authored name for
 * the locale when the row has one, otherwise the seeded `storeProductTypes` i18n name. The label is
 * what gives the model something to match a product name against, so it is worth resolving properly
 * rather than sending bare keys.
 */
async function readPromptProductCategories(
  locale: ExtractionLocale,
): Promise<{ categories: ExtractionProductCategory[]; activeKeys: string[] }> {
  const [activeRows, authoredRows, tProductTypes] = await Promise.all([
    listActiveStoreProductTypeKeysCached(),
    listAuthoredStoreProductTypeNamesCached(),
    getTranslations({ locale, namespace: "storeProductTypes" }),
  ]);

  const authoredNames = buildAuthoredStoreProductTypeNameMap(authoredRows);
  const categories = activeRows.map(({ key }) => ({
    key,
    // An admin-authored key has no i18n entry, so the namespace is asked before it is read: `t()`
    // on a missing key would report an error and render the key wrapped in error text.
    label: resolveStoreProductTypeName(authoredNames[key], tProductTypes.has(key) ? tProductTypes(key) : key, locale),
  }));

  return { categories, activeKeys: activeRows.map(({ key }) => key) };
}

/**
 * Applies the only currency assumption this product allows.
 *
 * The model is instructed to return `null` rather than infer a currency from a seller's country or
 * from an ambiguous "$", so a draft legitimately arrives without one, and a code the model filled in
 * by convention is not evidence either. Both cases resolve to the collector's own base currency,
 * marked as assumed so the review screen shows it as a guess that can be corrected. Only a currency
 * the model actually read in the source survives untouched, as read.
 *
 * Without this step the draft would reach the screen with no currency at all, and every amount would
 * be priced in whatever the formatter defaulted to, which is how a collector who works in soles ends
 * up reading dollars.
 */
function withResolvedCurrency(draft: ImageIntakeDraft, baseCurrencyCode: string): ImageIntakeDraft {
  const readCurrency = draft.currency.source === "read" ? draft.currency.value : null;
  return {
    ...draft,
    currency:
      readCurrency !== null ? { value: readCurrency, source: "read" } : { value: baseCurrencyCode, source: "assumed" },
  };
}

/**
 * Whether the draft carries anything a person could actually review.
 *
 * The model is told to report images that are not a purchase (see the "no order at all" section of
 * the system prompt), but a self-report is not something to depend on: a model that answers with an
 * all-null shell and no warning would otherwise put the user in front of an empty review document
 * with nothing explaining it, and the confirm button would then fail against the order schema's own
 * required fields with a generic message. So the verdict is reached here, from the draft itself.
 *
 * Four independent signals count as content, and any single one of them is enough:
 *
 * - at least one product across all groups, the whole point of the feature;
 * - a total, which is one of the two fields an order cannot be saved without;
 * - a store identity, name or phone, since either one can resolve the store step, the other
 *   required field and the most tedious one to fill by hand;
 * - a payment amount, which is purchase information even when nothing else was legible.
 *
 * The bar is deliberately this low. An incomplete draft is useful (the review screen exists exactly
 * so the collector completes it), while an empty one is not, and the expensive mistake would be
 * refusing a draft that did carry real extracted work: that discards the photo the collector spent
 * and blames their photo for something the reader found.
 *
 * `orderDate` and `currency` are deliberately not signals. Any chat screenshot shows a timestamp
 * and the currency is filled in from the collector's own base currency when the source stated none,
 * so both are present on a photo of a cat as readily as on a real order and carry no evidence.
 */
function hasReviewableContent(draft: ImageIntakeDraft): boolean {
  const productCount = draft.groups.reduce((sum, group) => sum + group.products.length, 0);
  return (
    productCount > 0 ||
    draft.totalCost.value !== null ||
    draft.store.name.value !== null ||
    draft.store.phone.value !== null ||
    draft.payments.some((payment) => payment.amount.value !== null)
  );
}

/**
 * Whether the model reported that the submission carried more than one purchase.
 *
 * This is the one verdict in this action that rests entirely on the model's self-report, and the
 * asymmetry with `hasReviewableContent` above is deliberate rather than an inconsistency. "There is
 * nothing to review" is decidable from the draft alone, so it is decided here and the warning is
 * never trusted for it. "These images are two different purchases" is not decidable from the draft
 * at all: a draft that fused two orders is shaped exactly like a draft of one order, with one store,
 * one total, and one product list, and the evidence that says otherwise lives only in the images the
 * server never reads. There is no server-side check to fall back on, so the warning IS the signal.
 *
 * The consequence is worth stating plainly: a model that silently fuses two orders produces a mixed
 * draft this action cannot catch. The prompt is where that case is prevented; this function is only
 * what happens once the model does notice.
 */
function reportsMultipleOrders(draft: ImageIntakeDraft): boolean {
  return draft.warnings.some((warning) => warning.code === "multiple-orders-detected");
}

/**
 * Runs one extraction and hands back a draft for the review screen to own.
 *
 * Nothing here persists an order. The draft lives in this response and in the client's memory
 * until the user confirms it, which is why this action deliberately shares no module with the save
 * path: a file that could both produce a draft and write an order would make the review step
 * skippable by accident.
 */
export async function extractOrderFromImagesAction(formData: FormData): Promise<ImageIntakeExtractResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, code: "unauthorized" };
  }
  const userId = session.user.id;
  // Resolved from the session's role, never from an environment allowlist: administrators are
  // exempt from the photo bag but not from the global cut-off.
  const isAdmin = getIsAdmin(session);

  const preferences = await getCollectorPreferencesSnapshot(userId);
  const baseCurrencyCode = preferences?.baseCurrencyCode ?? null;
  if (!baseCurrencyCode) {
    // The page renders the same gate, but a submission that reaches the server without a base
    // currency must not spend a request: an assumed currency needs something to be assumed from.
    return { ok: false, code: "missing-base-currency" };
  }

  const files = await readSubmittedFiles(formData);
  const validated = await validateUploadedImages(files);
  if (!validated.ok) {
    // The position and the measurement travel with the code. Without them the screen can only say
    // "one of the photos", which is not something a collector holding twenty screenshots can act on.
    return {
      ok: false,
      code: validated.error.code,
      ...(validated.error.index !== null ? { imageIndex: validated.error.index } : {}),
      ...(validated.error.measured
        ? { imageWidth: validated.error.measured.width, imageHeight: validated.error.measured.height }
        : {}),
    };
  }

  const posthog = getPostHogClient();
  const imageCount = validated.images.length;
  const modelId = resolveImageIntakeModelId();
  const extractionLocale = resolveExtractionLocale(formData.get(IMAGE_INTAKE_LOCALE_FIELD));
  const entrySource =
    formData.get(IMAGE_INTAKE_ENTRY_SOURCE_FIELD) === ImageIntakeEntrySource.SHARE
      ? ImageIntakeEntrySource.SHARE
      : ImageIntakeEntrySource.IN_APP;

  try {
    // Read before the reservation so the figure reported is the balance the collector was looking
    // at when they pressed the button, not the one left after this submission took its share.
    const quotaBefore = await getImageIntakeQuotaSnapshot({ userId, isAdmin, now: new Date() });

    // One catalog read serves both sides of the category feature: the list the model is allowed to
    // choose from, and the list its answer is checked against afterwards. Two separate reads could
    // disagree if a type were deactivated in between, and the disagreement would land on the side
    // that matters, offering a key the check would then reject.
    const { categories, activeKeys } = await readPromptProductCategories(extractionLocale);

    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.IMAGE_INTAKE.EXTRACTION_STARTED,
      properties: {
        photo_count: imageCount,
        entry_source: entrySource === ImageIntakeEntrySource.SHARE ? "share" : "in_app",
        photos_remaining_before: quotaBefore.remaining,
      },
    });

    const { guard, readUsage } = withUsageCapture(
      createImageIntakeSpendGuard({
        userId,
        entrySource,
        imageCount,
        model: modelId,
        now: new Date(),
        isAdmin,
      }),
    );

    const outcome = await extract(
      validated.images.map((image) => ({ data: image.buffer, mimeType: `image/${image.format}` })),
      {
        baseCurrency: baseCurrencyCode,
        now: new Date(),
        locale: extractionLocale,
        productCategories: categories,
      },
      { provider: new GeminiExtractionProvider(), spendGuard: guard },
      modelId,
    );

    if (outcome.status !== "ok") {
      if (outcome.status === "budget-blocked") {
        posthog.capture({
          distinctId: userId,
          event: POSTHOG_EVENTS.IMAGE_INTAKE.GLOBAL_BUDGET_BLOCKED,
          properties: { photo_count: imageCount },
        });
      }
      // The deterministic provider failures each get their own code, in analytics as much as on
      // screen. Counting them with the transport failures a retry can genuinely clear would hide
      // exactly the failures that need a person, and would answer both with copy inviting a retry
      // that spends the same money to fail the same way.
      // Read defensively, and not out of politeness to the type: everything below exists only to
      // DESCRIBE a failure, so nothing below may be able to cause one. A throw while assembling a
      // diagnostic would escape into the action's catch and turn an explained, typed refusal into a
      // bare "server-error", destroying both the outcome and the very evidence it was recording.
      const providerError = outcome.status === "provider-error" ? (outcome.error ?? null) : null;
      const providerUsage = readProviderErrorUsage(providerError);
      const providerShape = readProviderErrorShape(providerError);

      const failureCode: ImageIntakeExtractErrorCode =
        providerError === null
          ? outcome.status
          : isProviderRequestRejected(providerError)
            ? "provider-rejected"
            : isProviderResponseTruncated(providerError)
              ? "response-too-long"
              : "provider-error";

      // The one moment this failure can be explained. The images are discarded by design and the
      // model's body is never stored, so anything not recorded here is gone for good.
      if (providerError !== null) {
        reportImageIntakeFailure({
          stage: "provider",
          code: providerError.message ?? "PROVIDER_ERROR",
          reportedAs: failureCode,
          model: modelId,
          imageCount,
          imageBytes: validated.images.reduce((sum, image) => sum + image.byteSize, 0),
          promptTokens: providerUsage?.inputTokens ?? null,
          outputTokens: providerUsage?.outputTokens ?? null,
          thoughtsTokens: providerUsage?.thoughtsTokens ?? null,
          totalTokens: providerUsage?.totalTokens ?? null,
          maxOutputTokens: IMAGE_INTAKE_MAX_OUTPUT_TOKENS,
          partialChars: providerShape?.partialChars ?? null,
          groupsEmitted: providerShape?.groupsEmitted ?? null,
          productsEmitted: providerShape?.productsEmitted ?? null,
          paymentsEmitted: providerShape?.paymentsEmitted ?? null,
        });
      }

      posthog.capture({
        distinctId: userId,
        event: POSTHOG_EVENTS.IMAGE_INTAKE.EXTRACTION_FAILED,
        properties: {
          photo_count: imageCount,
          failure_code: failureCode,
          // Aggregate figures only, never content: enough to see a truncation trend in analytics
          // without opening Sentry.
          provider_code: providerError?.message ?? null,
          output_tokens: providerUsage?.outputTokens ?? null,
          products_emitted: providerShape?.productsEmitted ?? null,
        },
      });

      if (outcome.status === "quota-exceeded" || outcome.status === "daily-cap-exceeded") {
        posthog.capture({
          distinctId: userId,
          event: POSTHOG_EVENTS.IMAGE_INTAKE.QUOTA_BLOCKED,
          properties: { photo_count: imageCount, failure_code: outcome.status },
        });
        // The client normally stops an overflow before it ever reaches here (the attach surface
        // knows the balance). Reaching the server means the balance moved underneath the screen,
        // so the refusal carries the fresh numbers the copy needs.
        return {
          ok: false,
          code: outcome.status,
          remaining: outcome.remaining,
          renewalAtIso: quotaBefore.renewalAtIso,
        };
      }

      // A model answer that parsed but failed our schema is already captured with its full issue
      // list by the extraction engine; this adds only the local line, so a failure being debugged is
      // readable in the dev server output instead of only in Sentry.
      if (outcome.status === "invalid-model-response") {
        reportImageIntakeFailure({
          stage: "validation",
          code: "DRAFT_SCHEMA_REJECTED",
          reportedAs: failureCode,
          model: modelId,
          imageCount,
          imageBytes: validated.images.reduce((sum, image) => sum + image.byteSize, 0),
          issueCount: outcome.error?.issues?.length ?? null,
          captureToSentry: false,
        });
      }

      return { ok: false, code: failureCode };
    }

    // Two corrections before anything downstream reads the draft. The currency one, so every figure
    // on the review screen is priced in something the collector chose. The category one, so no
    // suggestion the catalog cannot back ever leaves this server: a single invented key would make
    // the write path refuse the whole order, and losing an order over a convenience field is not a
    // trade this feature is allowed to make. An unbacked suggestion is dropped in silence and the
    // collector picks the category by hand.
    // The name one raises each product's first letter: a chat transcription keeps whatever case the
    // seller typed, and a lowercase product reads as a typo beside every hand-typed row.
    const draftWithCategories = withCapitalizedProductNames(
      withValidatedSuggestedCategories(withResolvedCurrency(outcome.draft, baseCurrencyCode), activeKeys),
    );
    const breakdown = applyBreakdown(draftWithCategories);
    if (breakdown.outcome === "product-ceiling-exceeded") {
      posthog.capture({
        distinctId: userId,
        event: POSTHOG_EVENTS.IMAGE_INTAKE.EXTRACTION_FAILED,
        properties: {
          photo_count: imageCount,
          failure_code: "product-ceiling-exceeded",
          product_count: breakdown.productCount,
        },
      });
      return {
        ok: false,
        code: "product-ceiling-exceeded",
        productCount: breakdown.productCount,
        maxProducts: MAX_PRODUCTS_PER_ORDER,
      };
    }

    // Checked before the emptiness verdict because it is the more specific one: a submission that
    // carried two purchases and produced almost nothing readable is still best explained to the
    // collector as "these look like separate orders", which tells them what to change.
    if (reportsMultipleOrders(breakdown.draft)) {
      posthog.capture({
        distinctId: userId,
        event: POSTHOG_EVENTS.IMAGE_INTAKE.EXTRACTION_FAILED,
        properties: { photo_count: imageCount, failure_code: "multiple-orders" },
      });
      // Spent, on the same reasoning as `no-order-found` below: the request was sent, the provider
      // billed it, and the answer was a correct reading. What is refused is the draft, not the read.
      return { ok: false, code: "multiple-orders" };
    }

    if (!hasReviewableContent(breakdown.draft)) {
      posthog.capture({
        distinctId: userId,
        event: POSTHOG_EVENTS.IMAGE_INTAKE.EXTRACTION_FAILED,
        properties: { photo_count: imageCount, failure_code: "no-order-found" },
      });
      // The photos are spent, and that is the intended outcome, not an oversight. The extraction
      // engine has already settled this submission's ledger reservation as a success by the time it
      // hands the draft over, because nothing failed: the request was sent, Google billed it, and
      // the answer that came back was a correct reading of images that had no order in them.
      // Refunding here would mean a real charge with nothing counted against it, and a door where
      // uploading anything at all costs the collector nothing, which is a way to spend the
      // product's budget for free. The refund path stays where it belongs, on failures that are the
      // provider's or ours, which settle as failed and give the photos back.
      return { ok: false, code: "no-order-found" };
    }

    const usage = readUsage();
    posthog.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.IMAGE_INTAKE.EXTRACTION_SUCCEEDED,
      properties: {
        photo_count: imageCount,
        product_count: breakdown.draft.groups.reduce((sum, group) => sum + group.products.length, 0),
        group_count: breakdown.draft.groups.length,
        // Aggregate figures only. No extracted content, image bytes, or store/product names ever
        // reach analytics for this feature.
        cost_micro_usd: usage?.costMicroUsd ?? null,
        model: modelId,
      },
    });

    // Store resolution: the store step disappears on a certain match, asks honestly
    // on an ambiguous one, and offers inline creation on none. See StoreResolutionSection for the
    // three shapes this feeds.
    const storeMatch = await findStoreMatchesForIntake(userId, {
      name: breakdown.draft.store.name.value,
      phone: breakdown.draft.store.phone.value,
    });
    const draftWithStoreMatch: ImageIntakeDraft = {
      ...breakdown.draft,
      store: {
        ...breakdown.draft.store,
        matchedStoreId: storeMatch.kind === "certain" ? storeMatch.storeId : null,
        candidates: storeMatch.kind === "ambiguous" ? storeMatch.candidates : [],
      },
    };
    if (storeMatch.kind === "certain") {
      posthog.capture({
        distinctId: userId,
        event: POSTHOG_EVENTS.IMAGE_INTAKE.STORE_MATCHED,
        properties: { matched_by: storeMatch.matchedBy },
      });
    }

    return { ok: true, draft: draftWithStoreMatch, baseCurrencyCode };
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "imageIntake", action: "extract" } });
    return { ok: false, code: "server-error" };
  } finally {
    await posthog.shutdown();
  }
}

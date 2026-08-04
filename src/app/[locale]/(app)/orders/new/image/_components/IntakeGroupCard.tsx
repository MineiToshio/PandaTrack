"use client";

import { AlertTriangle, Check, CircleHelp, ExternalLink, Layers, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useId, useState } from "react";
import Button from "@/components/core/Button/Button";
import Card from "@/components/core/Card";
import Chip from "@/components/core/Chip";
import { useStoreProductTypeName } from "@/app/[locale]/(app)/_components/StoreProductTypeNamesProvider";
import type { ExtractedGroup, ExtractedProduct } from "@/lib/imageIntake/draftSchema";
import { formatReferenceHost } from "@/lib/imageIntake/referenceProductNaming";
import { formatAmount, formatCentsForInput } from "@/lib/currency";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";
import ItemTypePicker from "../../../_components/share/ItemTypePicker";
import ProductSplitMergeModal, {
  type SplitMergePart,
} from "../../../_components/share/ProductSplitMergeModal/ProductSplitMergeModal";

/**
 * Above this size a group arrives collapsed behind a summary row. Fifty rows do not get reviewed;
 * one summary line does.
 */
export const GROUP_EXPANDED_MAX_PRODUCTS = 5;

/**
 * Split and merge ship enabled. The flag stays as the single toggle point, kept from when the
 * controls were first added in their final position and geometry but disabled, ahead of the
 * split/merge logic itself landing.
 */
const SPLIT_MERGE_ENABLED = true;

/**
 * Which control the single category picker is currently serving: one product row by index, or the
 * whole group. One picker instance rather than one per row, because a fifty-volume group would
 * otherwise mount fifty pickers to serve one tap.
 */
type CategoryPickerTarget = number | "group" | null;

/** The category every product in the group shares, or `null` when they do not all agree. */
function resolveSharedCategoryKey(products: ExtractedProduct[]): string | null {
  const first = products[0]?.suggestedProductTypeKey ?? null;
  if (first === null) return null;
  return products.every((product) => product.suggestedProductTypeKey === first) ? first : null;
}

export type IntakeGroupCardProps = {
  group: ExtractedGroup;
  currencyCode: string;
  /** Active catalog keys the collector may choose from, read live by the page. */
  productTypeKeys: string[];
  /** True when a group-level warning applies, for example a lot price that could not split evenly. */
  hasWarning: boolean;
  /**
   * True while the screen is in correction mode. It turns each expanded row's name and price into
   * inputs; it never touches how a category is offered, which is a control at all times because a
   * category is always the model's guess rather than something the chat said.
   */
  isEditing?: boolean;
  /**
   * Called with the group's full new shape after a split, a merge, a category change, or an inline
   * correction. The draft entry point has no `orderId` to call a server action with — the group's
   * products live in the parent's in-memory draft, so this is a synchronous local state update, not
   * a mutation.
   */
  onApply: (updatedGroup: ExtractedGroup) => void;
};

type GroupTone = "clean" | "warning" | "doubtful";

function resolveTone(group: ExtractedGroup, hasWarning: boolean): GroupTone {
  if (group.doubtful) return "doubtful";
  if (hasWarning) return "warning";
  return "clean";
}

/** A row-level doubt must never end up hidden behind a summary, whatever the group's size. */
export function shouldArriveExpanded(group: ExtractedGroup): boolean {
  return group.doubtful || group.products.length <= GROUP_EXPANDED_MAX_PRODUCTS;
}

/**
 * Shared geometry for an editable row value: no border at rest, a border only on focus. A screen
 * that shows a permanent box around every corrected value stops reading as a document even after
 * the collector has left correction mode, which is the property `FR-11-51` is about.
 */
/** Same 44px-on-a-phone relaxation the review screen applies to its own `sm` controls. */
const MOBILE_TAP_TARGET = "min-h-[44px] md:min-h-8";

const INLINE_FIELD_BASE = cn(
  // `.intake-field` (globals.css §14) owns the border-at-rest / border-on-focus rule. It is real
  // CSS rather than arbitrary-property utilities because a plain `[border-color:…]` utility beats
  // the `focus:` variant of the same property, which silently left the focus state invisible.
  "intake-field",
  "min-h-[44px] w-full rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-1)] md:min-h-[32px]",
  "[font-size:var(--text-caption)] [color:var(--text-primary)]",
);

/**
 * One card per source phrase, always the same four parts in the same order: what we did, what the
 * chat said quoted verbatim, why, and the control that reverses it. Quoting the original phrase is
 * the evidence that lets a user judge the grouping without reopening the conversation.
 */
export default function IntakeGroupCard({
  group,
  currencyCode,
  productTypeKeys,
  hasWarning,
  isEditing = false,
  onApply,
}: IntakeGroupCardProps) {
  const t = useTranslations("imageIntake.review.group");
  const productTypeName = useStoreProductTypeName();
  const [isExpanded, setIsExpanded] = useState(() => shouldArriveExpanded(group));
  const [isSplitMergeOpen, setIsSplitMergeOpen] = useState(false);
  const [categoryPickerTarget, setCategoryPickerTarget] = useState<CategoryPickerTarget>(null);
  // Rows the collector has chosen a category for themselves. A category is otherwise always the
  // model's guess, so this is what stops the screen from calling the collector's own answer a
  // suggestion back at them.
  const [ownedCategoryIndexes, setOwnedCategoryIndexes] = useState<ReadonlySet<number>>(() => new Set());
  /**
   * What the collector has literally typed into a price field, by row index.
   *
   * The draft stores an integer of minor units, and a person types "1", then "11", then "11.".
   * Rendering the parsed value back into the field would fight the keystrokes, so the raw text is
   * what the input shows while it has a draft entry, and the parsed value is what the draft holds.
   */
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const rowsId = useId();
  const fieldsId = useId();

  // The raw strings belong to one editing session over one set of rows. Split and merge rebuild the
  // rows under the same indexes, and leaving correction mode ends the session, so both discard them
  // (render-time state sync, the same pattern the review screen uses for the exchange-rate pair).
  const priceDraftSessionKey = `${isEditing}:${group.products.length}`;
  const [syncedPriceDraftKey, setSyncedPriceDraftKey] = useState(priceDraftSessionKey);
  if (priceDraftSessionKey !== syncedPriceDraftKey) {
    setSyncedPriceDraftKey(priceDraftSessionKey);
    setPriceDrafts({});
  }

  const tone = resolveTone(group, hasWarning);
  const productCount = group.products.length;

  const handleToggle = () => {
    setIsExpanded((current) => !current);
  };

  // The clean chip is neutral, not green. It reports that nothing needs attention, so it must be
  // the quietest thing on the card: a saturated success colour on every well-read group competes
  // with the amber ones, which are the only chips the header's count is about.
  const toneChip = {
    clean: { variant: "neutral" as const, icon: <Check size={12} />, label: t("clean") },
    warning: { variant: "warning" as const, icon: <AlertTriangle size={12} />, label: t("warning") },
    doubtful: { variant: "warning" as const, icon: <CircleHelp size={12} />, label: t("doubtful") },
  }[tone];

  const headline = resolveHeadline();
  const quote = resolveQuote();
  const why = resolveWhy();
  const revertLabel = resolveRevertLabel();

  function resolveHeadline(): string {
    if (group.reason === "sealed") return t("sealed");
    if (group.reason === "not-nameable") return t("notNameable");
    if (group.reason === "open-range") return t("openRange", { count: productCount });
    return group.doubtful ? t("splitDoubt") : t("split", { count: productCount });
  }

  function resolveQuote(): string {
    if (group.reason === "sealed") return t("sourceQuoteSealed", { phrase: group.sourcePhrase });
    if (group.reason === "not-nameable") return t("sourceQuoteNotNameable", { phrase: group.sourcePhrase });
    return t("sourceQuote", { phrase: group.sourcePhrase });
  }

  function resolveWhy(): string {
    if (group.reason === "sealed") return t("sealedWhy");
    if (group.reason === "not-nameable") return t("notNameableWhy");
    if (group.reason === "open-range") return t("openRangeWhy");
    return group.doubtful ? t("splitDoubtWhy") : t("splitWhy");
  }

  function resolveRevertLabel(): string {
    // A group that was kept whole reverts by splitting; a group that was split reverts by merging.
    // Driven by the real product count (not just `reason`) so the label always matches what the
    // control is actually about to do — merge needs at least 2 source products to operate on.
    if (productCount > 1) return t("mergeAction");
    return group.reason === "sealed" ? t("splitIntoAction", { count: 2 }) : t("splitAction");
  }

  const firstSuggestedCategoryKey =
    group.products.find((product) => product.suggestedProductTypeKey !== null)?.suggestedProductTypeKey ?? null;
  const firstReferenceUrl = group.products.find((product) => product.referenceUrl !== null)?.referenceUrl ?? null;

  const splitMergeMode: "split" | "merge" = productCount > 1 ? "merge" : "split";
  const splitMergeSourceItems = group.products.map((product, index) => ({
    id: `${group.sourcePhrase}-${index}`,
    name: product.name,
    unitPrice: product.unitPrice,
  }));

  // Split and merge rebuild the product list, so both carry the group's category and its link
  // forward instead of dropping them: the pieces of a split lot are the same kind of thing as the
  // lot, and a link that identified the lot still identifies the first piece of it. Whose answer
  // each category is stops being traceable once the rows are rebuilt, so the ownership marks reset
  // and every rebuilt row is presented as a suggestion again.
  function handleConfirmSplit(parts: SplitMergePart[]) {
    setIsSplitMergeOpen(false);
    setOwnedCategoryIndexes(new Set());
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_SPLIT, { part_count: parts.length });
    onApply({
      ...group,
      products: parts.map((part, index) => ({
        name: part.name,
        unitPrice: part.unitPrice,
        suggestedProductTypeKey: firstSuggestedCategoryKey,
        referenceUrl: index === 0 ? firstReferenceUrl : null,
      })),
      reason: "split",
      doubtful: false,
      priceSplit: "explicit-unit",
    });
  }

  function handleConfirmMerge(mergedName: string, mergedUnitPrice: number | null) {
    setIsSplitMergeOpen(false);
    setOwnedCategoryIndexes(new Set());
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_MERGED, { merged_count: group.products.length });
    onApply({
      ...group,
      products: [
        {
          name: mergedName,
          unitPrice: mergedUnitPrice,
          suggestedProductTypeKey: firstSuggestedCategoryKey,
          referenceUrl: firstReferenceUrl,
        },
      ],
      reason: "sealed",
      doubtful: false,
      priceSplit: "explicit-unit",
    });
  }

  /**
   * Rewrites one field of one product and nothing else.
   *
   * Deliberately unlike split and merge, which reset `doubtful` and `priceSplit` because they
   * replace the model's whole answer about the group's shape. Correcting a typo is not that: the
   * chip that says the reading was doubtful is exactly what `FR-11-55` keeps on screen, and a
   * collector who fixes "110" to "115" has said nothing about whether the grouping was right.
   */
  function applyProductPatch(index: number, patch: Partial<ExtractedProduct>) {
    onApply({
      ...group,
      products: group.products.map((product, productIndex) =>
        productIndex === index ? { ...product, ...patch } : product,
      ),
    });
  }

  function handleNameChange(index: number, value: string) {
    applyProductPatch(index, { name: value });
  }

  function handlePriceChange(index: number, raw: string) {
    setPriceDrafts((current) => ({ ...current, [index]: raw }));
    const trimmed = raw.trim();
    applyProductPatch(index, { unitPrice: trimmed === "" ? null : parseDecimalToMinorUnits(trimmed, currencyCode) });
  }

  function resolvePriceInput(index: number, unitPrice: number | null): string {
    const typed = priceDrafts[index];
    if (typed !== undefined) return typed;
    return unitPrice !== null ? formatCentsForInput(unitPrice, currencyCode) : "";
  }

  function handleCategorySelect(categoryKey: string) {
    if (categoryPickerTarget === null) return;

    if (categoryPickerTarget === "group") {
      // A collapsed group is one line on purpose, so its control acts on the whole group. That is
      // also the right shape for what a large group actually is: fifty volumes of the same series
      // are fifty rows of one category, and setting it fifty times is not review, it is data entry.
      setOwnedCategoryIndexes(new Set(group.products.map((_product, index) => index)));
      setCategoryPickerTarget(null);
      posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.CATEGORY_SET, {
        scope: "group",
        product_count: productCount,
      });
      onApply({
        ...group,
        products: group.products.map((product) => ({ ...product, suggestedProductTypeKey: categoryKey })),
      });
      return;
    }

    const targetIndex = categoryPickerTarget;
    setOwnedCategoryIndexes((current) => new Set(current).add(targetIndex));
    setCategoryPickerTarget(null);
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.CATEGORY_SET, {
      scope: "product",
      replaced_suggestion: group.products[targetIndex]?.suggestedProductTypeKey !== null,
    });
    applyProductPatch(targetIndex, { suggestedProductTypeKey: categoryKey });
  }

  const groupTotal = group.products.reduce<number | null>((sum, product) => {
    if (sum === null || product.unitPrice === null) return null;
    return sum + product.unitPrice;
  }, 0);
  const firstUnitPrice = group.products[0]?.unitPrice ?? null;
  const rangeLabel =
    productCount > 1
      ? t("rangeSeparator", {
          first: group.products[0]?.name ?? "",
          last: group.products[productCount - 1]?.name ?? "",
        })
      : (group.products[0]?.name ?? group.sourcePhrase);

  const sharedCategoryKey = resolveSharedCategoryKey(group.products);
  const hasMixedCategories =
    sharedCategoryKey === null && group.products.some((product) => product.suggestedProductTypeKey !== null);
  const isGroupCategoryOwned = group.products.every((_product, index) => ownedCategoryIndexes.has(index));

  /**
   * The control that shows and changes a category. Rendered per row when the group is expanded, and
   * once for the whole group when it is collapsed, so a category is always visible and always
   * correctable without the collapsed summary turning back into fifty rows.
   *
   * It is the same `<ItemTypePicker>` the manual product form uses (`FR-11-93`): the popover with
   * its search on a pointer, the canonical bottom sheet on a phone. A category is never something a
   * chat said, so it is marked as a suggestion whenever it is the model's answer rather than the
   * collector's. The marker carries a word, not only a colour.
   */
  function renderCategoryControl(options: {
    target: Exclude<CategoryPickerTarget, null>;
    categoryKey: string | null;
    ariaLabel: string;
    isSuggestion: boolean;
    fallbackLabel?: string;
  }) {
    const isOpen = categoryPickerTarget === options.target;
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-[var(--space-2)]">
        <ItemTypePicker
          instanceId={`${fieldsId}-${typeof options.target === "number" ? options.target : "group"}`}
          value={options.categoryKey}
          productTypeKeys={productTypeKeys}
          tProductTypes={productTypeName}
          placeholder={options.fallbackLabel ?? t("categoryNone")}
          ariaLabelFor={() => options.ariaLabel}
          appearance="chip"
          presentation="adaptive"
          open={isOpen}
          onOpenChange={(open) => setCategoryPickerTarget(open ? options.target : null)}
          onChange={handleCategorySelect}
        />
        {options.isSuggestion && (
          <Chip variant="warning" size="sm" icon={<Sparkles size={12} />}>
            {t("categorySuggested")}
          </Chip>
        )}
      </span>
    );
  }

  return (
    <Card variant="outlined" padding="md" as="article" className="flex flex-col gap-[var(--space-3)]">
      <Chip variant={toneChip.variant} size="sm" icon={toneChip.icon} className="self-start">
        {toneChip.label}
      </Chip>

      <h3 className="[font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
        {headline}
      </h3>
      <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{quote}</p>
      <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{why}</p>

      {hasWarning && groupTotal !== null && (
        <p className="[font-size:var(--text-caption)] [color:var(--warning-chip-text)]">
          {t("priceSplitUneven", { total: formatAmount(groupTotal, currencyCode) })}
        </p>
      )}

      {!isExpanded && (
        <div className="flex flex-col gap-[var(--space-1)]">
          <strong className="[font-size:var(--text-body)] [color:var(--text-primary)]">{rangeLabel}</strong>
          <span className="numeric [font-size:var(--text-caption)] [color:var(--text-secondary)]">
            {firstUnitPrice !== null && groupTotal !== null
              ? t("summaryMeta", {
                  count: productCount,
                  unitPrice: formatAmount(firstUnitPrice, currencyCode),
                  total: formatAmount(groupTotal, currencyCode),
                })
              : t("summaryMetaNoPrice", { count: productCount })}
          </span>
          {/*
            One category control for the whole group while it is collapsed. A summary line exists so
            fifty rows do not have to be read, so it cannot grow fifty pickers; and a collapsed group
            is almost always one series, where one category for all of it is the right answer anyway.
            Anyone who needs per-row precision expands the group and gets it.

            Reference links have no equivalent here on purpose. A link identifies one specific
            product, and the case it comes from ("quiero este" plus a URL) yields a single-product
            group, which is never collapsed. Showing one of several links, or a count, would be
            noise standing in for information.
          */}
          {renderCategoryControl({
            target: "group",
            categoryKey: sharedCategoryKey,
            fallbackLabel: hasMixedCategories ? t("categoryMixed") : undefined,
            ariaLabel: t("categoryGroupAria", {
              count: productCount,
              category: sharedCategoryKey !== null ? productTypeName(sharedCategoryKey) : t("categoryNone"),
            }),
            isSuggestion: sharedCategoryKey !== null && !isGroupCategoryOwned,
          })}
          <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
            {t("categoryGroupHint", { count: productCount })}
          </span>
          {isEditing && (
            <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
              {t("editCollapsedHint", { count: productCount })}
            </span>
          )}
        </div>
      )}

      {isExpanded && (
        /*
          Entry is animated, collapse is not. The rows are mounted only while the group is open, so
          a collapsed group has nothing tabbable hidden under a zero-height container; the price of
          that is that there is no node left to animate on the way out. `clip-path` and `opacity`
          stay off the layout path, unlike the `height` this could have been written with.
        */
        <ul
          id={rowsId}
          aria-label={t("rowsLabel")}
          className="intake-reveal flex flex-col gap-[var(--space-2)]"
          key={isEditing ? "editing" : "reading"}
        >
          {group.products.map((product, index) => (
            // Keyed by position, never by name: the name is editable, and a key that changes on
            // every keystroke would remount the input and drop the caret after one character.
            <li key={index} className="flex flex-col gap-[var(--space-1)]">
              {isEditing ? (
                <div className="flex flex-col gap-[var(--space-1)] sm:flex-row sm:items-center sm:gap-[var(--space-3)]">
                  <input
                    type="text"
                    value={product.name}
                    onChange={(event) => handleNameChange(index, event.target.value)}
                    aria-label={t("nameFieldLabel", { position: index + 1 })}
                    className={cn(INLINE_FIELD_BASE, "min-w-0 flex-1")}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={resolvePriceInput(index, product.unitPrice)}
                    onChange={(event) => handlePriceChange(index, event.target.value)}
                    placeholder={t("noPrice")}
                    aria-label={t("priceFieldLabel", { position: index + 1 })}
                    className={cn(INLINE_FIELD_BASE, "numeric w-full sm:w-[8.5rem] sm:shrink-0 sm:text-right")}
                  />
                </div>
              ) : (
                <div className="flex items-baseline justify-between gap-[var(--space-3)] [font-size:var(--text-caption)]">
                  <span className="min-w-0 break-words [color:var(--text-primary)]">{product.name}</span>
                  <span className="numeric shrink-0 [color:var(--text-secondary)]">
                    {product.unitPrice !== null ? formatAmount(product.unitPrice, currencyCode) : t("noPrice")}
                  </span>
                </div>
              )}
              <div className="flex min-w-0 flex-wrap items-center gap-[var(--space-2)]">
                {renderCategoryControl({
                  target: index,
                  categoryKey: product.suggestedProductTypeKey,
                  ariaLabel: t("categoryProductAria", {
                    product: product.name,
                    category:
                      product.suggestedProductTypeKey !== null
                        ? productTypeName(product.suggestedProductTypeKey)
                        : t("categoryNone"),
                  }),
                  isSuggestion: product.suggestedProductTypeKey !== null && !ownedCategoryIndexes.has(index),
                })}
                {product.referenceUrl !== null && (
                  /*
                    A plain anchor, deliberately: this address came out of an image, so it is
                    untrusted content, and `next/link` would let the router prefetch it the moment
                    the row scrolls into view. Nothing may reach that host until the collector
                    decides to go there. `noopener noreferrer` keeps the opened page away from this
                    one and sends it no referrer.
                  */
                  <a
                    href={product.referenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("referenceLinkAria", { host: formatReferenceHost(product.referenceUrl) })}
                    data-ph-event={POSTHOG_EVENTS.IMAGE_INTAKE.REFERENCE_LINK_OPENED}
                    className={cn(
                      "flex min-h-[44px] min-w-0 items-center gap-[var(--space-1)] md:min-h-[32px]",
                      "rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-1)] [font-size:var(--text-caption)]",
                      "[color:var(--accent)] underline-offset-4 hover:underline",
                      "focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none",
                    )}
                  >
                    <ExternalLink size={12} aria-hidden />
                    <span className="truncate">{formatReferenceHost(product.referenceUrl)}</span>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        {productCount > GROUP_EXPANDED_MAX_PRODUCTS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            aria-expanded={isExpanded}
            aria-controls={rowsId}
            className={MOBILE_TAP_TARGET}
          >
            {isExpanded ? t("collapse", { count: productCount }) : t("expand", { count: productCount })}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!SPLIT_MERGE_ENABLED}
          leadingIcon={<Layers size={14} />}
          onClick={() => setIsSplitMergeOpen(true)}
          className={MOBILE_TAP_TARGET}
          data-ph-event={POSTHOG_EVENTS.ORDER.SPLIT_MERGE_MODAL_OPENED}
          data-ph-props={JSON.stringify({ mode: splitMergeMode, source: "intake_review", product_count: productCount })}
        >
          {revertLabel}
        </Button>
        {!SPLIT_MERGE_ENABLED && (
          <span id={`${rowsId}-revert-reason`} className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
            {t("comingSoon")}
          </span>
        )}
      </div>

      <ProductSplitMergeModal
        isOpen={isSplitMergeOpen}
        onClose={() => setIsSplitMergeOpen(false)}
        mode={splitMergeMode}
        currencyCode={currencyCode}
        sourceItems={splitMergeSourceItems}
        onConfirmSplit={handleConfirmSplit}
        onConfirmMerge={handleConfirmMerge}
      />
    </Card>
  );
}

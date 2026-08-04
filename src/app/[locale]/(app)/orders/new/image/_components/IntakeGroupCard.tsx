"use client";

import { AlertTriangle, Check, CircleHelp, ExternalLink, Layers, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useCallback, useId, useMemo, useState } from "react";
import Button from "@/components/core/Button/Button";
import Chip from "@/components/core/Chip";
import { useStoreProductTypeName } from "@/app/[locale]/(app)/_components/StoreProductTypeNamesProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ExtractedGroup } from "@/lib/imageIntake/draftSchema";
import {
  buildCarriedProductData,
  findUnreadablePriceRowIds,
  groupToItemRows,
  itemRowsToProducts,
} from "@/lib/imageIntake/draftItemRows";
import { formatReferenceHost } from "@/lib/imageIntake/referenceProductNaming";
import { formatAmount } from "@/lib/currency";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";
import OrderItemsGrid, { type ItemRow } from "../../../_components/share/OrderItemsGrid";
import OrderItemsMobileList from "../../../_components/share/OrderItemsMobileList";
import ProductSplitMergeModal, {
  type SplitMergePart,
} from "../../../_components/share/ProductSplitMergeModal/ProductSplitMergeModal";

/**
 * Above this size a group arrives collapsed behind a summary row. Fifty rows do not get reviewed;
 * one summary line does.
 */
export const GROUP_EXPANDED_MAX_PRODUCTS = 5;

export type IntakeGroupCardProps = {
  group: ExtractedGroup;
  currencyCode: string;
  /** Stable identity for this group's rows, so a row keeps its id across re-renders. */
  groupKey: string;
  /** Active catalog keys the collector may choose from, read live by the page. */
  productTypeKeys: string[];
  /** True when a group-level warning applies, for example a lot price that could not split evenly. */
  hasWarning: boolean;
  /** Opens the group whatever its size, so the screen can point at a row inside a collapsed one. */
  forceExpanded?: boolean;
  /** Reports whether any price cell in this group holds text the money parser cannot read. */
  onPriceValidityChange?: (hasUnreadablePrice: boolean) => void;
  /**
   * Called with the group's full new shape after any edit. The draft entry point has no `orderId`
   * to call a server action with — the group's products live in the parent's in-memory draft, so
   * this is a synchronous local state update, not a mutation.
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

/** Reads one row's price cell into minor units, or `null` when it is empty or unreadable. */
function rowPriceInMinorUnits(row: ItemRow, currencyCode: string): number | null {
  const trimmed = row.unitPrice.trim();
  return trimmed === "" ? null : parseDecimalToMinorUnits(trimmed, currencyCode);
}

/**
 * One block per source phrase: the evidence for what the model did, then the products themselves in
 * the same editable table the manual order form uses.
 *
 * The evidence stays, because quoting the original phrase is the only thing that lets a collector
 * judge a grouping without reopening the conversation (`FR-11-57`). It is a slim header now rather
 * than a card wrapped around stacked rows: the rows were the problem. Name over price, per product,
 * with no column to read down, is dense at two products and unreadable at fifty, and the only way
 * to edit one was a mode the collector had to find first. A real table aligns the prices into a
 * column, makes every cell visibly editable with no mode at all, and is a shape they already know
 * from creating an order by hand.
 */
export default function IntakeGroupCard({
  group,
  currencyCode,
  groupKey,
  productTypeKeys,
  hasWarning,
  forceExpanded = false,
  onPriceValidityChange,
  onApply,
}: IntakeGroupCardProps) {
  const t = useTranslations("imageIntake.review.group");
  const productTypeName = useStoreProductTypeName();
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(() => shouldArriveExpanded(group));
  const [isSplitMergeOpen, setIsSplitMergeOpen] = useState(false);
  /**
   * The rows are the edit surface; the draft is derived from them, never the other way round.
   *
   * A price cell holds text, and text is what has to survive a keystroke: rebuilding the rows from
   * the draft on every render would round-trip "11." through an integer and delete the dot as the
   * collector typed it. The draft is updated on every change so nothing is lost, and the rows are
   * rebuilt only by the two operations that genuinely replace the product list.
   */
  const [rows, setRows] = useState<ItemRow[]>(() => groupToItemRows(group, currencyCode, groupKey));
  /** Rows the collector has chosen a category for, so the screen stops calling it a suggestion. */
  const [ownedCategoryRowIds, setOwnedCategoryRowIds] = useState<ReadonlySet<string>>(() => new Set());
  const rowsId = useId();

  const carried = useMemo(() => buildCarriedProductData(group, groupKey), [group, groupKey]);
  const showRows = isExpanded || forceExpanded;
  const tone = resolveTone(group, hasWarning);
  const productCount = rows.length;

  const applyRows = useCallback(
    (nextRows: ItemRow[]) => {
      setRows(nextRows);
      onPriceValidityChange?.(findUnreadablePriceRowIds(nextRows, currencyCode).length > 0);
      onApply({ ...group, products: itemRowsToProducts(nextRows, currencyCode, carried) });
    },
    [carried, currencyCode, group, onApply, onPriceValidityChange],
  );

  const handleRowsChange = (nextRows: ItemRow[]) => {
    // A category the collector picked themselves stops being a suggestion. Detected by comparing
    // against what the row held a moment ago rather than reported by the picker, because the grid
    // owns that control now and this component only ever sees the result.
    const previousByRowId = new Map(rows.map((row) => [row.rowId, row.productTypeKey]));
    const newlyOwned = nextRows.filter(
      (row) => row.productTypeKey !== "" && previousByRowId.get(row.rowId) !== row.productTypeKey,
    );
    if (newlyOwned.length > 0) {
      setOwnedCategoryRowIds((current) => {
        const next = new Set(current);
        newlyOwned.forEach((row) => next.add(row.rowId));
        return next;
      });
      posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.CATEGORY_SET, {
        scope: "product",
        product_count: newlyOwned.length,
      });
    }
    applyRows(nextRows);
  };

  /** Rebuilds both the rows and the draft after an operation that replaces the product list. */
  const applyRebuiltGroup = (nextGroup: ExtractedGroup) => {
    setRows(groupToItemRows(nextGroup, currencyCode, groupKey));
    setOwnedCategoryRowIds(new Set());
    onPriceValidityChange?.(false);
    onApply(nextGroup);
  };

  const firstSuggestedCategoryKey =
    group.products.find((product) => product.suggestedProductTypeKey !== null)?.suggestedProductTypeKey ?? null;
  const firstReferenceUrl = group.products.find((product) => product.referenceUrl !== null)?.referenceUrl ?? null;

  const splitMergeMode: "split" | "merge" = productCount > 1 ? "merge" : "split";
  const splitMergeSourceItems = rows.map((row) => ({
    id: row.rowId,
    name: row.name,
    unitPrice: rowPriceInMinorUnits(row, currencyCode),
  }));

  // Split and merge rebuild the product list, so both carry the group's category and its link
  // forward instead of dropping them: the pieces of a split lot are the same kind of thing as the
  // lot, and a link that identified the lot still identifies the first piece of it.
  function handleConfirmSplit(parts: SplitMergePart[]) {
    setIsSplitMergeOpen(false);
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_SPLIT, { part_count: parts.length });
    applyRebuiltGroup({
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
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_MERGED, { merged_count: productCount });
    applyRebuiltGroup({
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

  const toneChip = {
    // Neutral, not green: this chip reports that nothing needs attention, so it has to be the
    // quietest thing here or it competes with the amber ones the header's count is about.
    clean: { variant: "neutral" as const, icon: <Check size={12} />, label: t("clean") },
    warning: { variant: "warning" as const, icon: <AlertTriangle size={12} />, label: t("warning") },
    doubtful: { variant: "warning" as const, icon: <CircleHelp size={12} />, label: t("doubtful") },
  }[tone];

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
    if (productCount > 1) return t("mergeAction");
    return group.reason === "sealed" ? t("splitIntoAction", { count: 2 }) : t("splitAction");
  }

  const groupTotal = rows.reduce<number | null>((sum, row) => {
    if (sum === null) return null;
    const price = rowPriceInMinorUnits(row, currencyCode);
    return price === null ? null : sum + price;
  }, 0);

  const rangeLabel =
    productCount > 1
      ? t("rangeSeparator", { first: rows[0]?.name ?? "", last: rows[productCount - 1]?.name ?? "" })
      : (rows[0]?.name ?? group.sourcePhrase);

  const hasUnownedSuggestion = rows.some((row) => row.productTypeKey !== "" && !ownedCategoryRowIds.has(row.rowId));
  const referenceUrls = group.products
    .map((product) => product.referenceUrl)
    .filter((url): url is string => url !== null);

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      {/*
        The evidence, in the four parts `FR-11-57` fixes: what we did, what the chat said quoted
        verbatim, why, and the control that reverses it. Slim, because the table below it is what
        the collector actually came to read.
      */}
      <div className="flex flex-wrap items-center gap-x-[var(--space-2)] gap-y-[var(--space-1)]">
        <Chip variant={toneChip.variant} size="sm" icon={toneChip.icon}>
          {toneChip.label}
        </Chip>
        <h4 className="[font-size:var(--text-caption)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
          {resolveHeadline()}
        </h4>
      </div>
      <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
        {resolveQuote()} {resolveWhy()}
      </p>

      {hasWarning && groupTotal !== null && (
        <p className="[font-size:var(--text-caption)] [color:var(--warning-chip-text)]">
          {t("priceSplitUneven", { total: formatAmount(groupTotal, currencyCode) })}
        </p>
      )}

      {!showRows && (
        <div className="flex flex-col gap-[var(--space-1)]">
          <strong className="[font-size:var(--text-body)] [color:var(--text-primary)]">{rangeLabel}</strong>
          <span className="numeric [font-size:var(--text-caption)] [color:var(--text-secondary)]">
            {groupTotal !== null
              ? t("summaryMeta", {
                  count: productCount,
                  unitPrice: formatAmount(Math.round(groupTotal / productCount), currencyCode),
                  total: formatAmount(groupTotal, currencyCode),
                })
              : t("summaryMetaNoPrice", { count: productCount })}
          </span>
        </div>
      )}

      {showRows && (
        <div id={rowsId} className="intake-reveal">
          {isMobile ? (
            <OrderItemsMobileList
              rows={rows}
              onChange={handleRowsChange}
              currencyCode={currencyCode}
              productTypeKeys={productTypeKeys}
              tProductTypes={productTypeName}
              nextRowId={() => `${groupKey}-added-${rows.length}`}
            />
          ) : (
            <OrderItemsGrid
              rows={rows}
              onChange={handleRowsChange}
              productTypeKeys={productTypeKeys}
              tProductTypes={productTypeName}
              createNewRow={() => ({
                rowId: `${groupKey}-added-${rows.length}`,
                name: "",
                quantity: "1",
                unitPrice: "",
                productTypeKey: "",
              })}
              currencyCode={currencyCode || undefined}
              showQuantity={false}
            />
          )}
        </div>
      )}

      {showRows && hasUnownedSuggestion && (
        // A category is inferred every time and never read, so it is marked as a suggestion with a
        // word (`FR-11-93`). One line for the group rather than a chip per row: the table earns its
        // readability from having four columns instead of five.
        <p className="flex items-center gap-[var(--space-1)] [font-size:var(--text-caption)] [color:var(--text-muted)]">
          <Sparkles size={12} aria-hidden className="shrink-0" />
          {t("categorySuggestedHint")}
        </p>
      )}

      {referenceUrls.length > 0 && (
        <p className="flex flex-wrap items-center gap-[var(--space-2)] [font-size:var(--text-caption)]">
          <span className="[color:var(--text-muted)]">{t("referenceLinkLead")}</span>
          {referenceUrls.map((url) => (
            /*
              A plain anchor, deliberately: this address came out of an image, so it is untrusted
              content, and `next/link` would let the router prefetch it the moment the row scrolls
              into view. Nothing may reach that host until the collector decides to go there.
            */
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("referenceLinkAria", { host: formatReferenceHost(url) })}
              data-ph-event={POSTHOG_EVENTS.IMAGE_INTAKE.REFERENCE_LINK_OPENED}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-[var(--space-1)] md:min-h-0",
                "[color:var(--accent)] underline-offset-4 hover:underline",
                "focus-visible:[box-shadow:0_0_0_2px_var(--focus-ring)] focus-visible:outline-none",
              )}
            >
              <ExternalLink size={12} aria-hidden />
              {formatReferenceHost(url)}
            </a>
          ))}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        {productCount > GROUP_EXPANDED_MAX_PRODUCTS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[44px] md:min-h-8"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={showRows}
            aria-controls={rowsId}
          >
            {showRows ? t("collapse", { count: productCount }) : t("expand", { count: productCount })}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[44px] md:min-h-8"
          leadingIcon={<Layers size={14} />}
          onClick={() => setIsSplitMergeOpen(true)}
          data-ph-event={POSTHOG_EVENTS.ORDER.SPLIT_MERGE_MODAL_OPENED}
          data-ph-props={JSON.stringify({ mode: splitMergeMode, source: "intake_review", product_count: productCount })}
        >
          {resolveRevertLabel()}
        </Button>
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
    </div>
  );
}

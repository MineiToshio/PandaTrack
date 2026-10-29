"use client";

import { AlertTriangle, ChevronDown, CircleHelp, ExternalLink, Layers, Scissors } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Button from "@/components/core/Button/Button";
import IconButton from "@/components/core/IconButton";
import { useStoreProductTypeName } from "@/app/[locale]/(app)/_components/StoreProductTypeNamesProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ExtractedGroup } from "@/lib/imageIntake/draftSchema";
import {
  buildCarriedProductData,
  findUnreadablePriceRowIds,
  groupToItemRows,
  itemRowsToProducts,
} from "@/lib/imageIntake/draftItemRows";
import { compareNaturally } from "@/lib/imageIntake/naturalSort";
import { formatReferenceHost } from "@/lib/imageIntake/referenceProductNaming";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { POSTHOG_EVENTS } from "@/lib/constants";
import { cn } from "@/lib/styles";
import OrderItemsGrid, { useOrderItemsTableColumnCount, type ItemRow } from "../../../_components/share/OrderItemsGrid";
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
  /** Compose this group as table bodies under the order-wide column header. */
  withinTable?: boolean;
  categoriesAreSuggestions?: boolean;
  ownedCategoryIndexes?: ReadonlySet<number>;
  onCategoryOwnershipChange?: (ownedIndexes: ReadonlySet<number>) => void;
  onSuggestionPresenceChange?: (hasSuggestions: boolean) => void;
  /** Reports whether any price cell in this group holds text the money parser cannot read. */
  onPriceValidityChange?: (hasUnreadablePrice: boolean) => void;
  /**
   * Called with the group's full new shape after any edit. The draft entry point has no `orderId`
   * to call a server action with — the group's products live in the parent's in-memory draft, so
   * this is a synchronous local state update, not a mutation.
   */
  onApply: (updatedGroup: ExtractedGroup) => void;
};

/** A row-level doubt must never end up hidden behind a summary, whatever the group's size. */
export function shouldArriveExpanded(group: ExtractedGroup): boolean {
  return group.doubtful || group.products.length <= GROUP_EXPANDED_MAX_PRODUCTS;
}

/** Reads one row's price cell into minor units, or `null` when it is empty or unreadable. */
function rowPriceInMinorUnits(row: ItemRow, currencyCode: string): number | null {
  const trimmed = row.unitPrice.trim();
  return trimmed === "" ? null : parseDecimalToMinorUnits(trimmed, currencyCode);
}

/** Keeps source-group editing local while composing compact rows in the order-wide list. */
export default function IntakeGroupCard({
  group,
  currencyCode,
  groupKey,
  productTypeKeys,
  hasWarning,
  forceExpanded = false,
  withinTable = false,
  categoriesAreSuggestions = true,
  ownedCategoryIndexes,
  onCategoryOwnershipChange,
  onSuggestionPresenceChange,
  onPriceValidityChange,
  onApply,
}: IntakeGroupCardProps) {
  const t = useTranslations("imageIntake.review.group");
  const locale = useLocale();
  const formatPrice = (minorUnits: number) => formatAmountSymbolOnly(minorUnits, currencyCode, locale);
  const productTypeName = useStoreProductTypeName();
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(() => shouldArriveExpanded(group));
  const [isSplitMergeOpen, setIsSplitMergeOpen] = useState(false);
  const [splitRowId, setSplitRowId] = useState<string | null>(null);
  /**
   * The rows are the edit surface; the draft is derived from them, never the other way round.
   *
   * A price cell holds text, and text is what has to survive a keystroke: rebuilding the rows from
   * the draft on every render would round-trip "11." through an integer and delete the dot as the
   * collector typed it. The draft is updated on every change so nothing is lost, and the rows are
   * rebuilt only by the two operations that genuinely replace the product list.
   */
  const [rows, setRows] = useState<ItemRow[]>(() => groupToItemRows(group, currencyCode, groupKey));
  const [ownedCategoryRowIds, setOwnedCategoryRowIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        groupToItemRows(group, currencyCode, groupKey)
          .filter((_, index) => !categoriesAreSuggestions || ownedCategoryIndexes?.has(index))
          .map((row) => row.rowId),
      ),
  );
  const columnCount = useOrderItemsTableColumnCount();
  const rowsId = useId();
  const evidenceId = useId();
  const hasUntouchedSuggestion = rows.some((row) => row.productTypeKey !== "" && !ownedCategoryRowIds.has(row.rowId));

  useEffect(() => {
    onSuggestionPresenceChange?.(hasUntouchedSuggestion);
    onCategoryOwnershipChange?.(
      new Set(rows.flatMap((row, index) => (ownedCategoryRowIds.has(row.rowId) ? [index] : []))),
    );
  }, [hasUntouchedSuggestion, onSuggestionPresenceChange, onCategoryOwnershipChange, ownedCategoryRowIds, rows]);

  const carried = useMemo(() => buildCarriedProductData(group, groupKey), [group, groupKey]);
  const showRows = isExpanded || forceExpanded;
  const showProvenance =
    rows.length > 1 || group.doubtful || hasWarning || group.reason === "sealed" || group.reason === "not-nameable";
  const productCount = rows.length;

  const applyRows = useCallback(
    (nextRows: ItemRow[]) => {
      setRows(nextRows);
      onPriceValidityChange?.(findUnreadablePriceRowIds(nextRows, currencyCode).length > 0);
      onApply({ ...group, products: itemRowsToProducts(nextRows, currencyCode, carried) });
    },
    [carried, currencyCode, group, onApply, onPriceValidityChange],
  );

  function handleCategoryPicked(rowId: string) {
    setOwnedCategoryRowIds((current) => new Set([...current, rowId]));
  }

  const handleRowsChange = (nextRows: ItemRow[]) => {
    // A category the collector picked themselves stops being a suggestion. Detected by comparing
    // against what the row held a moment ago rather than reported by the picker, because the grid
    // owns that control now and this component only ever sees the result.
    const previousByRowId = new Map(rows.map((row) => [row.rowId, row.productTypeKey]));
    const newlyOwned = nextRows.filter(
      (row) => row.productTypeKey !== "" && previousByRowId.get(row.rowId) !== row.productTypeKey,
    );
    if (newlyOwned.length > 0) {
      setOwnedCategoryRowIds((current) => new Set([...current, ...newlyOwned.map((row) => row.rowId)]));
      posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.CATEGORY_SET, {
        scope: "product",
        product_count: newlyOwned.length,
      });
    }
    applyRows(nextRows);
  };

  /** Rebuilds both the rows and the draft after an operation that replaces the product list. */
  const applyRebuiltGroup = (nextGroup: ExtractedGroup, ownedIndexes: number[] = []) => {
    const nextRows = groupToItemRows(nextGroup, currencyCode, groupKey);
    setRows(nextRows);
    setOwnedCategoryRowIds(new Set(ownedIndexes.map((index) => nextRows[index].rowId)));
    onPriceValidityChange?.(false);
    onApply(nextGroup);
  };

  const firstSuggestedCategoryKey =
    group.products.find((product) => product.suggestedProductTypeKey !== null)?.suggestedProductTypeKey ?? null;
  const firstReferenceUrl = group.products.find((product) => product.referenceUrl !== null)?.referenceUrl ?? null;

  const splitMergeMode: "split" | "merge" = splitRowId !== null ? "split" : "merge";
  const splitMergeSourceItems = rows
    .filter((row) => splitRowId === null || row.rowId === splitRowId)
    .map((row) => ({
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
    const ownedIndexes: number[] = [];
    let nextIndex = 0;
    for (const row of rows) {
      const count = row.rowId === splitRowId ? parts.length : 1;
      if (ownedCategoryRowIds.has(row.rowId)) {
        for (let offset = 0; offset < count; offset += 1) ownedIndexes.push(nextIndex + offset);
      }
      nextIndex += count;
    }
    const products = rows.flatMap((row) => {
      if (row.rowId !== splitRowId) return itemRowsToProducts([row], currencyCode, carried);
      const source = itemRowsToProducts([row], currencyCode, carried)[0];
      return parts.map((part, index) => ({
        name: part.name,
        unitPrice: part.unitPrice,
        suggestedProductTypeKey: source?.suggestedProductTypeKey ?? null,
        referenceUrl: index === 0 ? (source?.referenceUrl ?? null) : null,
      }));
    });
    // Ownership follows the products when a structural edit restores natural row order.
    const ownedProducts = new Set(ownedIndexes.map((index) => products[index]));
    products.sort((left, right) => compareNaturally(left.name, right.name));
    applyRebuiltGroup(
      {
        ...group,
        products,
        ...(productCount === 1
          ? { reason: "split" as const, doubtful: false, priceSplit: "explicit-unit" as const }
          : {}),
      },
      products.flatMap((product, index) => (ownedProducts.has(product) ? [index] : [])),
    );
  }

  function handleConfirmMerge(mergedName: string, mergedUnitPrice: number | null) {
    setIsSplitMergeOpen(false);
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_MERGED, { merged_count: productCount });
    applyRebuiltGroup(
      {
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
      },
      rows.some((row) => row.productTypeKey === firstSuggestedCategoryKey && ownedCategoryRowIds.has(row.rowId))
        ? [0]
        : [],
    );
  }

  function handleSplitRow(row: ItemRow) {
    setSplitRowId(row.rowId);
    setIsSplitMergeOpen(true);
  }

  function handleMergeGroup() {
    setSplitRowId(null);
    setIsSplitMergeOpen(true);
  }

  function renderSplitAction(row: ItemRow) {
    const label = (row.name.trim() ? t("splitProduct", { name: row.name.trim() }) : t("splitAction")).trim();
    return (
      <IconButton
        size="sm"
        icon={<Scissors size={14} aria-hidden />}
        aria-label={label}
        title={label}
        className="size-11 [color:var(--text-muted)] before:inset-0 hover:[color:var(--text-primary)] focus-visible:[color:var(--text-primary)] lg:size-8"
        onClick={() => handleSplitRow(row)}
        data-ph-event={POSTHOG_EVENTS.ORDER.SPLIT_MERGE_MODAL_OPENED}
        data-ph-props={JSON.stringify({ mode: "split", source: "intake_review", product_count: 1 })}
      />
    );
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

  const referenceUrls = group.products
    .map((product) => product.referenceUrl)
    .filter((url): url is string => url !== null);

  const groupingExplanation =
    group.reason === "sealed"
      ? t("sealedWhy")
      : group.reason === "not-nameable"
        ? t("notNameableWhy")
        : group.reason === "open-range"
          ? t("openRangeWhy")
          : group.doubtful
            ? t("splitDoubtWhy")
            : t("splitWhy");

  function handleEvidenceToggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_EVIDENCE_TOGGLED, { expanded: event.currentTarget.open });
  }

  const provenance = showProvenance ? (
    <div className="text-text-secondary flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs">
      <details className="min-w-0 flex-1 basis-full md:basis-0" onToggle={handleEvidenceToggle}>
        <summary
          id={evidenceId}
          className={cn(
            "text-text-secondary focus-visible:outline-ring flex min-h-11 cursor-pointer items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-2 lg:min-h-8",
            group.doubtful && "[color:var(--warning-chip-text)]",
          )}
        >
          {group.doubtful ? <CircleHelp size={16} aria-hidden /> : <Layers size={16} aria-hidden />}
          <span className="min-w-0 break-words">
            {productCount > 1
              ? t("bundleLabel", { phrase: group.sourcePhrase, count: productCount })
              : group.doubtful
                ? t("doubtful")
                : group.reason === "sealed" && productCount === 1
                  ? t("sealed")
                  : group.reason === "not-nameable"
                    ? t("notNameable")
                    : t("warning")}
          </span>
          {productCount > 1 && group.doubtful && <span>{t("doubtful")}</span>}
          <ChevronDown size={14} aria-hidden className="shrink-0" />
        </summary>
        <p className="pt-1 pb-2 break-words">
          {t("sourceQuote", { phrase: group.sourcePhrase })} {groupingExplanation}
        </p>
      </details>
      {productCount > 1 && (
        <Button
          type="button"
          variant="tonal"
          size="sm"
          className="min-h-11 lg:min-h-8"
          onClick={handleMergeGroup}
          data-ph-event={POSTHOG_EVENTS.ORDER.SPLIT_MERGE_MODAL_OPENED}
          data-ph-props={JSON.stringify({ mode: "merge", source: "intake_review", product_count: productCount })}
        >
          {t("mergeAction")}
        </Button>
      )}
    </div>
  ) : null;

  const warning =
    hasWarning && groupTotal !== null ? (
      <p className="flex items-start gap-2 px-3 py-2 text-xs [color:var(--warning-chip-text)]">
        <AlertTriangle size={16} aria-hidden className="shrink-0" />
        {t("priceSplitUneven", { total: formatPrice(groupTotal) })}
      </p>
    ) : null;

  function handleRowsToggle() {
    const expanded = !showRows || forceExpanded;
    setIsExpanded(expanded);
    posthog.capture(POSTHOG_EVENTS.IMAGE_INTAKE.GROUP_ROWS_TOGGLED, { expanded });
  }

  const disclosure =
    productCount > GROUP_EXPANDED_MAX_PRODUCTS ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11 lg:min-h-8"
        onClick={handleRowsToggle}
        aria-expanded={showRows}
        aria-controls={rowsId}
      >
        {showRows ? t("collapse", { count: productCount }) : t("expand", { count: productCount })}
      </Button>
    ) : null;

  const summary = !showRows ? (
    <div className="flex flex-col gap-1 px-3 py-2">
      <strong className="text-text-primary text-sm">{rangeLabel}</strong>
      <span className="numeric text-text-secondary text-xs">
        {groupTotal !== null
          ? t("summaryMeta", {
              count: productCount,
              unitPrice: formatPrice(Math.round(groupTotal / productCount)),
              total: formatPrice(groupTotal),
            })
          : t("summaryMetaNoPrice", { count: productCount })}
      </span>
    </div>
  ) : null;

  const references =
    referenceUrls.length > 0 ? (
      <p className="flex flex-wrap items-center gap-2 px-3 py-1 text-xs">
        <span className="text-text-muted">{t("referenceLinkLead")}</span>
        {referenceUrls.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("referenceLinkAria", { host: formatReferenceHost(url) })}
            data-ph-event={POSTHOG_EVENTS.IMAGE_INTAKE.REFERENCE_LINK_OPENED}
            className={cn(
              "inline-flex min-h-11 items-center gap-1 lg:min-h-8",
              "text-accent underline-offset-4 hover:underline",
              "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
            )}
          >
            <ExternalLink size={16} aria-hidden />
            {formatReferenceHost(url)}
          </a>
        ))}
      </p>
    ) : null;

  const grid = (
    <OrderItemsGrid
      rows={showRows ? rows : []}
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
      sortable={false}
      appendOnTab={false}
      onCategoryPicked={handleCategoryPicked}
      tableBodyId={withinTable ? rowsId : undefined}
      renderRowAction={renderSplitAction}
      compactControls
      typePickerInlineChevron
      tableBodyProps={
        withinTable && showProvenance
          ? {
              "aria-labelledby": evidenceId,
              className: "[&>tr>td:first-child]:border-border-strong [&>tr>td:first-child]:border-l-2",
            }
          : undefined
      }
      beforeRows={
        withinTable && (provenance || warning || summary) ? (
          <tr>
            <td colSpan={columnCount}>
              {provenance}
              {warning}
              {summary}
            </td>
          </tr>
        ) : undefined
      }
      afterRows={
        withinTable && (references || disclosure) ? (
          <tr>
            <td colSpan={columnCount}>
              {references}
              {disclosure}
            </td>
          </tr>
        ) : undefined
      }
    />
  );

  const modal = (
    <ProductSplitMergeModal
      isOpen={isSplitMergeOpen}
      onClose={() => setIsSplitMergeOpen(false)}
      mode={splitMergeMode}
      currencyCode={currencyCode}
      sourceItems={splitMergeSourceItems}
      onConfirmSplit={handleConfirmSplit}
      onConfirmMerge={handleConfirmMerge}
    />
  );

  if (withinTable) {
    return (
      <>
        {grid}
        {isSplitMergeOpen && (
          <tbody>
            <tr>
              <td colSpan={columnCount}>{modal}</td>
            </tr>
          </tbody>
        )}
      </>
    );
  }

  return (
    <div
      role={showProvenance ? "group" : undefined}
      aria-labelledby={showProvenance ? evidenceId : undefined}
      className={cn("min-w-0", showProvenance && "border-border-strong border-l-2")}
    >
      {provenance}
      {warning}
      {summary}
      <div id={rowsId}>
        {showRows &&
          (isMobile ? (
            <OrderItemsMobileList
              rows={rows}
              onChange={handleRowsChange}
              currencyCode={currencyCode}
              productTypeKeys={productTypeKeys}
              tProductTypes={productTypeName}
              nextRowId={() => `${groupKey}-added-${rows.length}`}
              showQuantity={false}
              compact
              showAddButton={false}
              keepEmptyRow={false}
              onCategoryPicked={handleCategoryPicked}
              renderRowAction={renderSplitAction}
              containRowActions
              formatPrice={formatPrice}
            />
          ) : (
            grid
          ))}
      </div>
      {references}
      {disclosure}
      {modal}
    </div>
  );
}

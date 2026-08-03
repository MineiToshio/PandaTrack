"use client";

import { useId, useMemo, useState } from "react";
import { AlertTriangle, Layers, Merge } from "lucide-react";
import { useTranslations } from "next-intl";
import Modal from "@/components/modules/Modal/Modal";
import Input from "@/components/core/Input";
import Select, { type SelectOption } from "@/components/core/Select";
import FieldErrorMsg from "@/components/core/FieldErrorMsg";
import { formatAmount, formatCentsForInput } from "@/lib/currency";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { deduceRangeParts } from "./productBreakdownHeuristics";
import { previewEqualSplit } from "./priceSplitPreview";

export type SplitMergeSourceItem = {
  id: string;
  name: string;
  unitPrice: number | null;
};

export type SplitMergeMode = "split" | "merge";

export type SplitMergePart = { name: string; unitPrice: number | null };

export type ProductSplitMergeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mode: SplitMergeMode;
  currencyCode: string;
  /** The item being split (exactly 1) or the items being merged (2 or more). */
  sourceItems: SplitMergeSourceItem[];
  onConfirmSplit?: (parts: SplitMergePart[]) => void;
  onConfirmMerge?: (mergedName: string, mergedUnitPrice: number | null) => void;
};

type SplitRow = { name: string; priceInput: string };

const MIN_PART_COUNT = 2;
const MAX_PART_COUNT_OPTION = 12;

function buildSplitRows(
  proposedNames: string[] | null,
  count: number,
  shares: number[] | null,
  currencyCode: string,
): SplitRow[] {
  return Array.from({ length: count }, (_, index) => ({
    name: proposedNames?.[index] ?? "",
    priceInput: shares ? formatCentsForInput(shares[index], currencyCode) : "",
  }));
}

/**
 * The one modal for both directions of the product breakdown operation (ADR 0021 Part 2, as
 * amended by ADR 0023): splitting one product into N, or merging N products into one. Its single
 * entry point is the image-intake review screen, where the collector corrects what the model
 * inferred, so it always operates on an in-memory draft: `onConfirmSplit` / `onConfirmMerge` hand
 * the new shape back to the caller's local state and nothing here is ever persisted. A draft holds
 * no deliveries yet, so there is no live-delivery block to check either.
 */
export default function ProductSplitMergeModal({
  isOpen,
  onClose,
  mode,
  currencyCode,
  sourceItems,
  onConfirmSplit,
  onConfirmMerge,
}: ProductSplitMergeModalProps) {
  const t = useTranslations("productBreakdown");
  const rowsId = useId();

  const sourceItem = sourceItems[0] ?? null;
  const detectedNames = useMemo(
    () => (mode === "split" && sourceItem ? deduceRangeParts(sourceItem.name) : null),
    [mode, sourceItem],
  );

  const [partCount, setPartCount] = useState(() => detectedNames?.length ?? MIN_PART_COUNT);
  const [rows, setRows] = useState<SplitRow[]>(() => buildSplitRows(detectedNames, partCount, null, currencyCode));
  const [nameError, setNameError] = useState(false);

  const allSourcesPriced = sourceItems.length > 0 && sourceItems.every((item) => item.unitPrice !== null);
  const computedMergedPrice = allSourcesPriced
    ? sourceItems.reduce((sum, item) => sum + (item.unitPrice ?? 0), 0)
    : null;

  const [mergedName, setMergedName] = useState(() => sourceItems[0]?.name ?? "");
  const [mergedPriceInput, setMergedPriceInput] = useState("");
  const [mergedNameError, setMergedNameError] = useState(false);

  const sourceItemId = sourceItem?.id ?? null;
  const sourceItemsKey = sourceItems.map((item) => item.id).join(",");

  // Every field is rebuilt whenever the modal opens for a (possibly new) source, and the split rows
  // are rebuilt again whenever the user picks a different part count (only reachable when no range
  // was detected). Both are "adjusting state during render" (React's supported alternative to an
  // effect that only mirrors a prop into state): the two keys below are compared against what the
  // previous render saw, and a mismatch triggers the reset synchronously in the same render pass —
  // no separate effect-driven re-render, so `react-hooks/set-state-in-effect` has nothing to flag.
  const openKey = isOpen ? `${mode}:${sourceItemId ?? ""}:${sourceItemsKey}:${currencyCode}` : null;
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  const [lastPartCountForRows, setLastPartCountForRows] = useState(partCount);

  if (isOpen && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    const initialPartCount = detectedNames?.length ?? MIN_PART_COUNT;
    setPartCount(initialPartCount);
    setLastPartCountForRows(initialPartCount);
    const shares =
      mode === "split" && sourceItem?.unitPrice != null
        ? previewEqualSplit(sourceItem.unitPrice, initialPartCount, currencyCode)
        : null;
    setRows(buildSplitRows(detectedNames, initialPartCount, shares, currencyCode));
    setNameError(false);
    setMergedName(sourceItems[0]?.name ?? "");
    setMergedPriceInput(computedMergedPrice !== null ? formatCentsForInput(computedMergedPrice, currencyCode) : "");
    setMergedNameError(false);
  } else if (!isOpen && lastOpenKey !== null) {
    // Forget the key on close so the *next* open — even for the same item — resets fresh instead
    // of resuming a stale in-progress edit from a cancelled attempt.
    setLastOpenKey(null);
  } else if (isOpen && mode === "split" && sourceItem && partCount !== lastPartCountForRows) {
    setLastPartCountForRows(partCount);
    const shares =
      sourceItem.unitPrice !== null ? previewEqualSplit(sourceItem.unitPrice, partCount, currencyCode) : null;
    setRows(buildSplitRows(detectedNames, partCount, shares, currencyCode));
    setNameError(false);
  }

  const partCountOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: MAX_PART_COUNT_OPTION - MIN_PART_COUNT + 1 }, (_, index) => {
        const value = String(MIN_PART_COUNT + index);
        return { value, label: value };
      }),
    [],
  );

  function updateRowName(index: number, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, name: value } : row)));
    if (value.trim().length > 0) setNameError(false);
  }

  function updateRowPrice(index: number, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, priceInput: value } : row)));
  }

  function handleSplitConfirm() {
    const trimmedRows = rows.map((row) => ({ name: row.name.trim(), priceInput: row.priceInput.trim() }));
    if (trimmedRows.some((row) => row.name.length === 0)) {
      setNameError(true);
      return;
    }
    const parts: SplitMergePart[] = trimmedRows.map((row) => ({
      name: row.name,
      unitPrice: row.priceInput === "" ? null : parseDecimalToMinorUnits(row.priceInput, currencyCode),
    }));
    onConfirmSplit?.(parts);
  }

  function handleMergeConfirm() {
    const trimmedName = mergedName.trim();
    if (trimmedName.length === 0) {
      setMergedNameError(true);
      return;
    }
    const trimmedPrice = mergedPriceInput.trim();
    const mergedUnitPrice = trimmedPrice === "" ? null : parseDecimalToMinorUnits(trimmedPrice, currencyCode);
    onConfirmMerge?.(trimmedName, mergedUnitPrice);
  }

  const isSplit = mode === "split";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSplit ? t("split.title") : t("merge.title")}
      icon={isSplit ? <Layers /> : <Merge />}
      tone="default"
      size="md"
      primaryAction={{
        label: isSplit ? t("split.confirm") : t("merge.confirm"),
        onClick: isSplit ? handleSplitConfirm : handleMergeConfirm,
      }}
      secondaryAction={{ label: t("cancel"), onClick: onClose }}
    >
      {isSplit && sourceItem && (
        <div className="flex flex-col gap-[var(--space-4)]">
          {!detectedNames && (
            <div className="flex flex-col gap-[var(--space-1)]">
              <label htmlFor={`${rowsId}-count`} className="text-text-secondary block text-[13px]">
                {t("split.partCountLabel")}
              </label>
              <Select
                id={`${rowsId}-count`}
                value={String(partCount)}
                onChange={(value) => setPartCount(Number(value))}
                options={partCountOptions}
              />
            </div>
          )}

          {sourceItem.unitPrice !== null && (
            <p className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-lg border p-3 text-[13px] leading-snug">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t("split.priceNote", { amount: formatAmount(sourceItem.unitPrice, currencyCode) })}</span>
            </p>
          )}

          <ul className="flex flex-col gap-[var(--space-3)]" aria-label={t("split.rowsLabel")}>
            {rows.map((row, index) => (
              <li key={index} className="flex items-start gap-[var(--space-2)]">
                <Input
                  aria-label={t("split.rowNameLabel", { index: index + 1 })}
                  value={row.name}
                  onChange={(event) => updateRowName(index, event.target.value)}
                  placeholder={t("split.rowNamePlaceholder", { index: index + 1 })}
                  className="flex-1"
                />
                <Input
                  aria-label={t("split.rowPriceLabel", { index: index + 1 })}
                  type="text"
                  inputMode="decimal"
                  value={row.priceInput}
                  onChange={(event) => updateRowPrice(index, event.target.value)}
                  suffix={currencyCode}
                  className="w-32 shrink-0"
                />
              </li>
            ))}
          </ul>
          {nameError && <FieldErrorMsg>{t("split.nameRequiredError")}</FieldErrorMsg>}
        </div>
      )}

      {!isSplit && (
        <div className="flex flex-col gap-[var(--space-4)]">
          <ul className="flex flex-col gap-[var(--space-1)]" aria-label={t("merge.sourceListLabel")}>
            {sourceItems.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-[var(--space-3)] text-[13px]">
                <span className="text-text-primary min-w-0 break-words">{item.name}</span>
                <span className="text-text-secondary shrink-0 tabular-nums">
                  {item.unitPrice !== null ? formatAmount(item.unitPrice, currencyCode) : t("noPrice")}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-text-secondary text-[13px] leading-snug">
            {computedMergedPrice !== null
              ? t("merge.consequenceWithPrice", { amount: formatAmount(computedMergedPrice, currencyCode) })
              : t("merge.consequenceNoPrice")}
          </p>

          <div className="flex flex-col gap-[var(--space-1)]">
            <label htmlFor={`${rowsId}-merged-name`} className="text-text-secondary block text-[13px]">
              {t("merge.nameLabel")}
            </label>
            <Input
              id={`${rowsId}-merged-name`}
              value={mergedName}
              onChange={(event) => {
                setMergedName(event.target.value);
                if (event.target.value.trim().length > 0) setMergedNameError(false);
              }}
            />
            {mergedNameError && <FieldErrorMsg>{t("merge.nameRequiredError")}</FieldErrorMsg>}
          </div>

          <div className="flex flex-col gap-[var(--space-1)]">
            <label htmlFor={`${rowsId}-merged-price`} className="text-text-secondary block text-[13px]">
              {t("merge.priceLabel")}
            </label>
            <Input
              id={`${rowsId}-merged-price`}
              type="text"
              inputMode="decimal"
              value={mergedPriceInput}
              onChange={(event) => setMergedPriceInput(event.target.value)}
              suffix={currencyCode}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

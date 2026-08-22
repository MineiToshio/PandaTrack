"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import Chip from "@/components/core/Chip";
import MoneyAmountInput from "@/components/core/MoneyAmountInput";
import Button from "@/components/core/Button/Button";
import { formatAmountSymbolOnly } from "@/lib/currency";
import { formatDomainDate } from "@/lib/domainDate";
import { sanitizeDecimalInput } from "@/lib/decimalInput";
import { parseDecimalToMinorUnits } from "@/lib/money/parseDecimalToMinorUnits";
import { isInvalidRemainingMinor, resolveLineAmountMinor } from "@/lib/orders/storeReconciliationSheetState";
import type { StoreReconciliationOrderRow } from "./StoreReconciliationSheet.types";

export type StoreReconciliationOrderListProps = {
  openOrders: StoreReconciliationOrderRow[];
  deliveredOrders: StoreReconciliationOrderRow[];
  /** Raw typed "remaining balance" strings, keyed by `orderId`. Absent key = untouched row. */
  rawInputs: Record<string, string>;
  currencyCode: string;
  locale: string;
  disabled: boolean;
  /** Names the store in the delivered-group's own explainer. */
  storeName: string;
  onRemainingChange: (orderId: string, raw: string) => void;
  onMarkSettled: (orderId: string) => void;
};

/**
 * The per-order list the collector marks (WO-11 Module Structure): one row per non-cancelled order
 * still carrying a balance, in the two groups `getStoreReconciliationPreview` already split, each
 * rendered separately and each hidden entirely when it has no rows (`ADR 0034` §3, UX Notes).
 *
 * Every row is named by its DATE first, never by its `ORD-YYYYMMDD-NN` code (`FR-05-67`): the code
 * is present only as small secondary metadata, because recognising the order by when it happened is
 * the whole skill this question relies on.
 */
export default function StoreReconciliationOrderList({
  openOrders,
  deliveredOrders,
  rawInputs,
  currencyCode,
  locale,
  disabled,
  storeName,
  onRemainingChange,
  onMarkSettled,
}: StoreReconciliationOrderListProps) {
  const t = useTranslations("stores.redesign.detail.reconciliation");

  return (
    <div className="flex flex-col gap-4">
      {openOrders.length > 0 && (
        <ReconciliationOrderGroup
          heading={t("openOrdersHeading")}
          rows={openOrders}
          rawInputs={rawInputs}
          currencyCode={currencyCode}
          locale={locale}
          disabled={disabled}
          onRemainingChange={onRemainingChange}
          onMarkSettled={onMarkSettled}
        />
      )}
      {deliveredOrders.length > 0 && (
        <ReconciliationOrderGroup
          heading={t("deliveredOrdersHeading")}
          explainer={t("deliveredOrdersExplainer", { store: storeName })}
          rows={deliveredOrders}
          rawInputs={rawInputs}
          currencyCode={currencyCode}
          locale={locale}
          disabled={disabled}
          onRemainingChange={onRemainingChange}
          onMarkSettled={onMarkSettled}
        />
      )}
    </div>
  );
}

type ReconciliationOrderGroupProps = {
  heading: string;
  explainer?: string;
  rows: StoreReconciliationOrderRow[];
  rawInputs: Record<string, string>;
  currencyCode: string;
  locale: string;
  disabled: boolean;
  onRemainingChange: (orderId: string, raw: string) => void;
  onMarkSettled: (orderId: string) => void;
};

function ReconciliationOrderGroup({
  heading,
  explainer,
  rows,
  rawInputs,
  currencyCode,
  locale,
  disabled,
  onRemainingChange,
  onMarkSettled,
}: ReconciliationOrderGroupProps) {
  const headingId = `reconciliation-group-${heading.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div role="group" aria-labelledby={headingId} aria-describedby={explainer ? `${headingId}-explainer` : undefined}>
      <p id={headingId} className="[font-size:var(--text-caption)] font-medium [color:var(--text-secondary)]">
        {heading}
      </p>
      {explainer && (
        <p id={`${headingId}-explainer`} className="mt-0.5 [font-size:var(--text-caption)] [color:var(--text-muted)]">
          {explainer}
        </p>
      )}
      <ul role="list" className="mt-2 flex flex-col gap-2">
        {rows.map((row) => (
          <ReconciliationOrderRow
            key={row.orderId}
            row={row}
            rawInput={rawInputs[row.orderId]}
            currencyCode={currencyCode}
            locale={locale}
            disabled={disabled}
            onRemainingChange={onRemainingChange}
            onMarkSettled={onMarkSettled}
          />
        ))}
      </ul>
    </div>
  );
}

type ReconciliationOrderRowProps = {
  row: StoreReconciliationOrderRow;
  rawInput: string | undefined;
  currencyCode: string;
  locale: string;
  disabled: boolean;
  onRemainingChange: (orderId: string, raw: string) => void;
  onMarkSettled: (orderId: string) => void;
};

function ReconciliationOrderRow({
  row,
  rawInput,
  currencyCode,
  locale,
  disabled,
  onRemainingChange,
  onMarkSettled,
}: ReconciliationOrderRowProps) {
  const t = useTranslations("stores.redesign.detail.reconciliation");
  const errorId = `${useId()}-remaining-error`;
  const dateLabel = formatDomainDate(row.orderDate, locale, { dateStyle: "medium" });
  // The row's own accessible name: built from the DATE (`FR-05-67`), never from `humanReadableId`
  // alone, which is rendered only as small secondary text below.
  const rowLabel = t("orderDated", { date: dateLabel });
  const balanceLabel = formatAmountSymbolOnly(row.openBalanceMinor, currencyCode, locale);

  const typed = rawInput ?? "";
  const remainingMinor = typed.trim() === "" ? null : (parseDecimalToMinorUnits(typed, currencyCode) ?? null);
  const lineAmountMinor = remainingMinor != null ? resolveLineAmountMinor(row.openBalanceMinor, remainingMinor) : null;
  const isInvalid =
    typed.trim() !== "" && remainingMinor != null && isInvalidRemainingMinor(row.openBalanceMinor, remainingMinor);
  const isSettled = remainingMinor === 0;

  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-md)] px-3 py-2.5 [background:var(--surface)] [border:1px_solid_var(--border)] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <p className="[font-size:var(--text-body)] font-medium [color:var(--text-primary)]">{rowLabel}</p>
        <p className="mt-0.5 [font-size:var(--text-caption)] [color:var(--text-muted)]">
          {row.humanReadableId} · {t("currentBalance", { amount: balanceLabel })}
        </p>
        {/* Only when an EARLIER "cuadrar cuenta" already wrote part of this order off (`MINOR-10a`):
            without this, `openBalanceMinor` already reads smaller than `totalCost` with no line on
            screen explaining the gap. */}
        {row.writtenOffMinor > 0 && (
          <p className="mt-0.5 [font-size:var(--text-caption)] [color:var(--text-muted)]">
            {t("alreadyWrittenOff", { amount: formatAmountSymbolOnly(row.writtenOffMinor, currencyCode, locale) })}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex shrink-0 items-center gap-2">
          {lineAmountMinor != null && (
            <Chip variant="accent" size="sm">
              {t("writeOffChip", { amount: formatAmountSymbolOnly(lineAmountMinor, currencyCode, locale) })}
            </Chip>
          )}
          <div className="w-28">
            <MoneyAmountInput
              value={typed}
              onChange={(raw) => onRemainingChange(row.orderId, sanitizeDecimalInput(raw, currencyCode))}
              ariaLabel={t("remainingInputAria", { date: dateLabel })}
              error={isInvalid}
              describedById={isInvalid ? errorId : undefined}
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            variant={isSettled ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onMarkSettled(row.orderId)}
            disabled={disabled}
          >
            {t("markSettled")}
          </Button>
        </div>
        {isInvalid && (
          <p id={errorId} role="alert" className="text-destructive [font-size:var(--text-caption)]">
            {t("remainingExceedsBalance")}
          </p>
        )}
      </div>
    </li>
  );
}

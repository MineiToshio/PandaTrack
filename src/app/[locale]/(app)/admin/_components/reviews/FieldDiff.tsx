import type { ComponentType, SVGProps } from "react";
import { getTranslations } from "next-intl/server";
import {
  AlignLeft,
  ArrowRight,
  AtSign,
  Check,
  Equal,
  Globe,
  Image as ImageIcon,
  MapPin,
  Minus,
  Pencil,
  Plus,
  Tag,
  ToggleLeft,
  Type,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/styles";
import type {
  AdminChangeRequestFieldRow,
  AdminChangeRequestListItem,
  AdminChangeRequestScalarValue,
} from "@/lib/data/admin/adminStoreChangeRequestQueries";

const FIELD_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  name: Type,
  description: AlignLeft,
  logoUrl: ImageIcon,
  presenceTypes: Wifi,
  productTypeKeys: Tag,
  importCountries: Globe,
  contactChannels: AtSign,
  addresses: MapPin,
  hasStock: ToggleLeft,
  receivesOrders: ToggleLeft,
  isPrivate: ToggleLeft,
  isActive: ToggleLeft,
};

const DELTA_GLYPH: Record<AdminChangeRequestListItem["delta"], ComponentType<SVGProps<SVGSVGElement>>> = {
  added: Plus,
  removed: Minus,
  kept: Equal,
};

type Labels = {
  fieldLabel: (fieldKey: string) => string;
  kindText: string;
  kindBool: string;
  kindList: string;
  delta: (delta: AdminChangeRequestListItem["delta"]) => string;
  now: string;
  proposed: string;
  appliedTag: string;
  appliedNote: string;
  scalarText: (value: AdminChangeRequestScalarValue) => string;
};

function ScalarValue({ text, tone }: { text: string; tone: "before" | "after" | "now" | "proposed" }) {
  return (
    <span
      className={cn(
        "text-sm",
        tone === "before" && "[color:var(--text-muted)] line-through",
        tone === "after" && "text-text-primary",
        tone === "now" && "[color:var(--warning)]",
        tone === "proposed" && "[color:var(--accent)]",
      )}
    >
      {text}
    </span>
  );
}

function ListItems({ items, labels }: { items: AdminChangeRequestListItem[]; labels: Labels }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => {
        const Glyph = DELTA_GLYPH[item.delta];
        return (
          <li
            key={item.token}
            className={cn(
              "border-border bg-surface flex items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-1.5 text-sm",
              item.delta === "added" && "[color:var(--success)]",
              item.delta === "removed" && "[color:var(--destructive)]",
              item.delta === "kept" && "[color:var(--text-muted)]",
            )}
          >
            <Glyph className="size-3.5 shrink-0" aria-hidden />
            <span className={cn("text-text-primary flex-1", item.delta === "removed" && "line-through")}>
              {item.label}
            </span>
            <span className="[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] uppercase">
              {labels.delta(item.delta)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The row's kind label: lists get their own copy, scalars branch on the boolean vs. text value shape. */
function fieldKindLabel(row: AdminChangeRequestFieldRow, labels: Labels): string {
  if (row.type === "list") return labels.kindList;
  return row.current.kind === "bool" ? labels.kindBool : labels.kindText;
}

function FieldRow({
  row,
  storeDrifted,
  labels,
}: {
  row: AdminChangeRequestFieldRow;
  storeDrifted: boolean;
  labels: Labels;
}) {
  const Icon = FIELD_ICONS[row.fieldKey] ?? Pencil;
  const isDriftField = storeDrifted && row.alreadyApplied;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[var(--radius-md)] border p-3",
        isDriftField
          ? "[border-color:color-mix(in_oklch,var(--warning)_40%,transparent)] [background:color-mix(in_oklch,var(--warning)_6%,var(--surface))]"
          : "border-border bg-surface",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 [font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [color:var(--text-muted)] uppercase">
          <Icon className="size-3 shrink-0" aria-hidden />
          {labels.fieldLabel(row.fieldKey)}
        </span>
        <span className="text-xs [color:var(--text-muted)]">{fieldKindLabel(row, labels)}</span>
        {row.alreadyApplied && (
          <span className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs [color:var(--success)] [background:color-mix(in_oklch,var(--success)_12%,transparent)]">
            <Check className="size-3" aria-hidden />
            {labels.appliedTag}
          </span>
        )}
      </div>

      {row.type === "scalar" ? (
        storeDrifted ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="border-border bg-surface flex flex-col gap-0.5 rounded-[var(--radius-md)] border px-2.5 py-1.5">
              <span className="[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [color:var(--text-muted)] uppercase">
                {labels.now}
              </span>
              <ScalarValue text={labels.scalarText(row.current)} tone="now" />
            </div>
            <div className="border-border bg-surface flex flex-col gap-0.5 rounded-[var(--radius-md)] border px-2.5 py-1.5">
              <span className="[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [color:var(--text-muted)] uppercase">
                {labels.proposed}
              </span>
              <ScalarValue text={labels.scalarText(row.proposed)} tone="proposed" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="sr-only">{labels.now}</span>
            <ScalarValue text={labels.scalarText(row.current)} tone="before" />
            <ArrowRight className="size-4 shrink-0 [color:var(--text-muted)]" aria-hidden />
            <span className="sr-only">{labels.proposed}</span>
            <ScalarValue text={labels.scalarText(row.proposed)} tone="after" />
          </div>
        )
      ) : (
        <ListItems items={row.items} labels={labels} />
      )}

      {isDriftField && <p className="text-xs [color:var(--text-muted)]">{labels.appliedNote}</p>}
    </div>
  );
}

/**
 * Renders the presentation-ready change-request field rows. When the store drifted since submission,
 * scalar fields render as two labeled values (`Ahora` / `Propuesta`) and fields whose proposal already
 * matches the store carry a single `Ya aplicado` tag; there is no third "En conflicto" value, because
 * the stored diff keeps only proposed values (the honest two-value cut, FR-02-17 / AC-02-12). List
 * fields always render their itemized add / remove / keep deltas against the current store.
 */
export default async function FieldDiff({
  fieldRows,
  storeDrifted,
  locale,
}: {
  fieldRows: AdminChangeRequestFieldRow[];
  storeDrifted: boolean;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "admin.review" });

  const labels: Labels = {
    fieldLabel: (fieldKey) => (t.has(`change.field.${fieldKey}`) ? t(`change.field.${fieldKey}`) : fieldKey),
    kindText: t("change.fieldKindText"),
    kindBool: t("change.fieldKindBool"),
    kindList: t("change.fieldKindList"),
    delta: (delta) => t(`change.delta.${delta}`),
    now: t("drift.now"),
    proposed: t("drift.proposed"),
    appliedTag: t("drift.appliedTag"),
    appliedNote: t("drift.appliedNote"),
    scalarText: (value) => {
      if (value.kind === "bool") {
        if (value.value == null) return t("empty");
        return value.value ? t("change.boolTrue") : t("change.boolFalse");
      }
      return value.value && value.value.length > 0 ? value.value : t("empty");
    },
  };

  return (
    <div className="flex flex-col gap-2.5">
      {fieldRows.map((row) => (
        <FieldRow key={row.fieldKey} row={row} storeDrifted={storeDrifted} labels={labels} />
      ))}
    </div>
  );
}

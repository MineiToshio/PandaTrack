"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Radio from "@/components/core/Radio";
import { StoreCombobox, type StoreComboboxOption } from "@/components/modules/StoreCombobox";
import type { ImageIntakeDraft } from "@/lib/imageIntake/draftSchema";
import {
  confirmStoreMatchAction,
  createStoreFromIntakeAction,
  type CreateStoreFromIntakeErrorCode,
} from "../../../_actions/imageIntakeStoreActions";

/** Same 44px-on-a-phone relaxation the rest of the review screen applies to its `sm` controls. */
const MOBILE_TAP_TARGET = "min-h-[44px] md:min-h-8";

export type StoreResolutionSectionProps = {
  store: ImageIntakeDraft["store"];
  options: StoreComboboxOption[];
  onChange: (storeId: string | null) => void;
  error?: boolean;
};

/** Sentinel radio value for "Ninguna, crear una nueva" — never a real store id (cuids never start with "_"). */
const NONE_OF_THESE_VALUE = "__none_of_these__";

type Shape = "certain" | "ambiguous" | "unknown";

type Resolution =
  | { kind: "unresolved" }
  /** Ambiguous list pivoted to "Ninguna, crear una nueva", or the original shape was already "unknown". */
  | { kind: "creating" }
  | { kind: "resolved"; storeId: string; name: string };

type DuplicateCandidate = { storeId: string; name: string };

function resolveInitialShape(store: ImageIntakeDraft["store"]): Shape {
  if (store.matchedStoreId) return "certain";
  if (store.candidates.length > 0) return "ambiguous";
  return "unknown";
}

const CREATE_ERROR_COPY_KEY: Record<CreateStoreFromIntakeErrorCode, string> = {
  "country-required": "createErrorCountryRequired",
  unauthorized: "createErrorServer",
  "invalid-input": "createErrorServer",
  "possible-duplicate": "createErrorServer",
  "server-error": "createErrorServer",
};

/**
 * The store block of the review screen: three shapes chosen by how certain the match is. Only the
 * `storeId` out / `store` node in interface with `IntakeReviewScreen` is public; everything else
 * (which shape is showing, an in-flight "Cambiar", the inline creation form) is local state private
 * to this component.
 *
 * - **Certain** (`store.matchedStoreId` set): the canonical store picker with the match already
 *   selected. It used to be a read-only attribute row with a "Cambiar" link that swapped it for
 *   this picker, which was the right shape while the screen read as a document and is dead weight
 *   now that it is a form: two controls, one click apart, that end in the same place.
 * - **Ambiguous** (`store.candidates` has entries): a vertical single-select list with nothing
 *   preselected, since a wrong guess would misattribute the purchase to the wrong seller, plus
 *   "Ninguna, crear una nueva".
 * - **Unknown** (neither): inline creation, prefilled from the extraction, without leaving the screen.
 *
 * A resolution the user makes here (picking a candidate, correcting via "Cambiar") is remembered
 * for next time via `confirmStoreMatchAction`; creating a store goes through
 * `createStoreFromIntakeAction`, which reuses the same duplicate protection the manual store form
 * shows before submit.
 */
export default function StoreResolutionSection({ store, options, onChange, error }: StoreResolutionSectionProps) {
  const t = useTranslations("stores.intakeResolution");
  const tStore = useTranslations("imageIntake.review.store");
  const tDuplicate = useTranslations("stores.duplicate");
  const tErrors = useTranslations("imageIntake.errors");

  const [shape] = useState<Shape>(() => resolveInitialShape(store));
  const [resolution, setResolution] = useState<Resolution>(() =>
    shape === "unknown" ? { kind: "creating" } : { kind: "unresolved" },
  );
  const [radioValue, setRadioValue] = useState<string | null>(null);

  const [createName, setCreateName] = useState(store.name.value ?? "");
  const [createNameError, setCreateNameError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createErrorCode, setCreateErrorCode] = useState<CreateStoreFromIntakeErrorCode | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[] | null>(null);
  const [localOption, setLocalOption] = useState<StoreComboboxOption | null>(null);

  const extractedPhone = store.phone.value;
  const comboboxOptions = localOption ? [...options, localOption] : options;

  async function submitCreate(confirmDuplicate: boolean) {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      setCreateNameError(t("createNameRequired"));
      return;
    }
    setCreateNameError(null);
    setCreateErrorCode(null);
    setIsCreating(true);
    try {
      const result = await createStoreFromIntakeAction({
        name: trimmedName,
        phone: extractedPhone,
        wasAmbiguous: shape === "ambiguous",
        confirmDuplicate,
      });
      if (!result.ok) {
        if (result.code === "possible-duplicate") {
          setDuplicateCandidates(result.candidates ?? []);
          return;
        }
        setCreateErrorCode(result.code);
        return;
      }
      setDuplicateCandidates(null);
      setLocalOption({ id: result.storeId, name: result.name });
      setResolution({ kind: "resolved", storeId: result.storeId, name: result.name });
      onChange(result.storeId);
    } finally {
      setIsCreating(false);
    }
  }

  function handleDuplicatePick(candidate: DuplicateCandidate) {
    setDuplicateCandidates(null);
    setResolution({ kind: "resolved", storeId: candidate.storeId, name: candidate.name });
    onChange(candidate.storeId);
    void confirmStoreMatchAction({
      storeId: candidate.storeId,
      phone: extractedPhone,
      candidateCount: duplicateCandidates?.length,
    });
  }

  function handleRadioChange(value: string) {
    setRadioValue(value);
    if (value === NONE_OF_THESE_VALUE) {
      setResolution({ kind: "creating" });
      return;
    }
    const candidate = store.candidates.find((item) => item.storeId === value);
    if (!candidate) return;
    setResolution({ kind: "resolved", storeId: candidate.storeId, name: candidate.name });
    onChange(candidate.storeId);
    void confirmStoreMatchAction({
      storeId: candidate.storeId,
      phone: extractedPhone,
      candidateCount: store.candidates.length,
    });
  }

  function handleChangeSelect(nextStoreId: string | null) {
    if (!nextStoreId) return;
    const picked = comboboxOptions.find((option) => option.id === nextStoreId);
    setResolution({ kind: "resolved", storeId: nextStoreId, name: picked?.name ?? nextStoreId });
    onChange(nextStoreId);
    if (nextStoreId !== store.matchedStoreId) {
      void confirmStoreMatchAction({ storeId: nextStoreId, phone: extractedPhone });
    }
  }

  function handleBackToCandidates() {
    setResolution({ kind: "unresolved" });
    setRadioValue(null);
    setCreateNameError(null);
    setCreateErrorCode(null);
    setDuplicateCandidates(null);
  }

  // A resolved pick (from any origin) or the original certain match renders the same attribute row.
  const resolvedDisplay =
    resolution.kind === "resolved"
      ? resolution
      : shape === "certain" && store.matchedStoreId
        ? {
            storeId: store.matchedStoreId,
            name: options.find((o) => o.id === store.matchedStoreId)?.name ?? store.name.value ?? store.matchedStoreId,
          }
        : null;

  if (resolvedDisplay) {
    return (
      <section className="flex flex-col gap-[var(--space-2)]">
        <Label htmlFor="intake-store-change" size="sm">
          {tStore("label")}
        </Label>
        <StoreCombobox
          id="intake-store-change"
          options={comboboxOptions}
          value={resolvedDisplay.storeId}
          onChange={handleChangeSelect}
          placeholder={tStore("placeholder")}
          emptyLabel={tStore("empty")}
          mobileTitle={tStore("mobileTitle")}
          mobileSearchPlaceholder={tStore("mobileSearch")}
          listAriaLabel={tStore("listLabel")}
          error={error}
        />
      </section>
    );
  }

  if (shape === "ambiguous" && resolution.kind === "unresolved") {
    const radioOptions = [
      ...store.candidates.map((candidate) => ({ value: candidate.storeId, label: candidate.name })),
      { value: NONE_OF_THESE_VALUE, label: t("noneOption") },
    ];

    return (
      <section className="flex flex-col gap-[var(--space-2)]">
        <fieldset className="flex flex-col gap-[var(--space-2)]">
          <legend className="[font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]">
            {t("ambiguousPrompt")}
          </legend>
          <Radio
            name="intake-store-candidate"
            value={radioValue}
            onChange={handleRadioChange}
            options={radioOptions}
            error={error ? tErrors("saveStoreRequired") : undefined}
          />
        </fieldset>
      </section>
    );
  }

  // "creating": the original shape was "unknown", or an ambiguous list pivoted to "Ninguna, crear una nueva".
  return (
    <section className="flex flex-col gap-[var(--space-2)] rounded-xl p-3 [background:var(--surface-elevated)] [border:1px_solid_var(--border)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <span className="[font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]">
          {tStore("createLabel")}
        </span>
        <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">{t("createIntro")}</p>
      </div>

      <div className="flex flex-col gap-[var(--space-1)]">
        <Label htmlFor="intake-store-create-name" size="sm" className="mb-0">
          {t("createNameLabel")}
        </Label>
        <Input
          id="intake-store-create-name"
          type="text"
          value={createName}
          onChange={(event) => {
            setCreateName(event.target.value);
            if (createNameError) setCreateNameError(null);
          }}
          error={createNameError ?? undefined}
        />
      </div>

      {store.name.value && (
        <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
          {tStore("readFromChat", { phrase: store.name.value })}
        </p>
      )}
      {extractedPhone && (
        <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
          {t("createPhoneNote", { phone: extractedPhone })}
        </p>
      )}
      <p className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{t("createPendingNote")}</p>

      {duplicateCandidates && duplicateCandidates.length > 0 && (
        <div className="flex flex-col gap-[var(--space-2)] rounded-lg p-2.5 [background:var(--surface)] [border:1px_solid_var(--border-strong)]">
          <p className="[font-size:var(--text-caption)] [font-weight:var(--font-weight-medium)] [color:var(--text-primary)]">
            {tDuplicate("suggestionsTitle")}
          </p>
          <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
            {tDuplicate("suggestionsDescription")}
          </p>
          <ul className="flex flex-col gap-[var(--space-1)]">
            {duplicateCandidates.map((candidate) => (
              <li key={candidate.storeId}>
                <button
                  type="button"
                  onClick={() => handleDuplicatePick(candidate)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-[13px] [color:var(--text-primary)] hover:[background:color-mix(in_oklch,var(--text-primary)_4%,transparent)]"
                >
                  {candidate.name}
                </button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={MOBILE_TAP_TARGET}
            onClick={() => void submitCreate(true)}
            loading={isCreating}
          >
            {tDuplicate("confirmCreate")}
          </Button>
        </div>
      )}

      {createErrorCode && (
        <p className="[font-size:var(--text-caption)] [color:var(--destructive)]">
          {t(CREATE_ERROR_COPY_KEY[createErrorCode])}
        </p>
      )}

      <div className="flex items-center gap-[var(--space-3)]">
        <Button
          type="button"
          variant="tonal"
          size="sm"
          className={MOBILE_TAP_TARGET}
          onClick={() => void submitCreate(false)}
          loading={isCreating}
        >
          {isCreating ? t("createSubmitting") : t("createSubmit")}
        </Button>
        {shape === "ambiguous" && (
          <button
            type="button"
            onClick={handleBackToCandidates}
            className="text-[12.5px] font-medium [color:var(--text-secondary)] hover:underline"
          >
            {t("backToCandidates")}
          </button>
        )}
      </div>
    </section>
  );
}

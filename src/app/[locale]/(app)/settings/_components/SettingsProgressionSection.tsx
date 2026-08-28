"use client";

import { Trash2, Trophy } from "lucide-react";
import posthog from "posthog-js";
import { useCallback, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import SectionCard from "@/components/core/SectionCard";
import Switch from "@/components/core/Switch";
import { useToast } from "@/components/core/Toast";
import { Modal } from "@/components/modules/Modal";
import { useProgressionFeedback } from "@/contexts/ProgressionFeedbackContext";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  purgeProgressionLedgerAction,
  toggleProgressionVisibilityAction,
} from "@/app/[locale]/(app)/settings/_actions/progressionActions";
import SettingsRow from "./SettingsRow";

/**
 * The two controls `BR-12-11` promises the collector over the progression layer.
 *
 * The switch is optimistic, the repository default: the navigation entry, the dashboard widget and
 * every overlay disappear in the same tick, and a server failure puts them back with a toast saying
 * why (`FR-12-38`, `AC-12-13`). The purge is the documented exception, awaited behind a confirmation
 * that states the permanence in plain words, because it cannot be undone (`FR-12-46`).
 */
export default function SettingsProgressionSection() {
  const t = useTranslations("settings.progression");
  const { addToast } = useToast();
  const router = useRouter();
  const { progressionVisible, setProgressionVisible } = useProgressionFeedback();
  const hideId = useId();

  const [, startToggleTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const handleToggleHide = useCallback(
    (hide: boolean) => {
      // Applied before the request, reverted by the same setter if the server refuses. The ledger
      // is untouched either way, so the worst case is a switch that snaps back, never lost points.
      setProgressionVisible(!hide);
      posthog.capture(
        hide ? POSTHOG_EVENTS.PROGRESSION.PROGRESSION_HIDDEN : POSTHOG_EVENTS.PROGRESSION.PROGRESSION_SHOWN,
      );

      startToggleTransition(async () => {
        const result = await toggleProgressionVisibilityAction(hide);
        if (!result.ok) {
          setProgressionVisible(hide);
          addToast(t("errors.toggleFailed"), { variant: "error" });
          return;
        }
        // The navigation entry and the widget are server-rendered from the same flag, so the tree
        // is refreshed once the write is confirmed and the optimistic state stops being the only
        // thing holding the change.
        router.refresh();
      });
    },
    [addToast, router, setProgressionVisible, t],
  );

  const handleConfirmPurge = useCallback(() => {
    setPurging(true);
    void purgeProgressionLedgerAction().then(
      (result) => {
        setPurging(false);
        setConfirmOpen(false);
        if (!result.ok) {
          addToast(t("errors.purgeFailed"), { variant: "error" });
          return;
        }
        posthog.capture(POSTHOG_EVENTS.PROGRESSION.PROGRESSION_LEDGER_PURGED, {
          deleted_entries: result.deletedEntries,
          deleted_unlocks: result.deletedUnlocks,
        });
        addToast(t("purge.success"), { variant: "success" });
        router.refresh();
      },
      () => {
        setPurging(false);
        setConfirmOpen(false);
        addToast(t("errors.purgeFailed"), { variant: "error" });
      },
    );
  }, [addToast, router, t]);

  return (
    <SectionCard
      topAccent="warm"
      headingLevel="h2"
      eyebrow={
        <Eyebrow variant="chip" tone="warm" icon={Trophy}>
          {t("eyebrow")}
        </Eyebrow>
      }
      title={t("title")}
    >
      <p className="-mt-2 mb-2 text-[13px] [color:var(--text-secondary)]">{t("subtitle")}</p>

      <SettingsRow
        label={t("hideRow.label")}
        value={<span className="[color:var(--text-secondary)]">{t("hideRow.helper")}</span>}
        actions={
          <Switch
            id={hideId}
            checked={!progressionVisible}
            onChange={handleToggleHide}
            ariaLabel={t("hideRow.label")}
          />
        }
      />

      <SettingsRow
        label={t("purgeRow.label")}
        value={<span className="[color:var(--text-secondary)]">{t("purgeRow.helper")}</span>}
        actions={
          <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
            {t("purgeRow.action")}
          </Button>
        }
      />

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        role="alertdialog"
        tone="destructive"
        icon={<Trash2 size={22} aria-hidden="true" />}
        title={t("purge.title")}
        subtitle={t("purge.subtitle")}
        primaryAction={{
          label: t("purge.confirm"),
          onClick: handleConfirmPurge,
          variant: "destructive",
          loading: purging,
        }}
        secondaryAction={{ label: t("purge.cancel"), onClick: () => setConfirmOpen(false), disabled: purging }}
        closeButtonLabel={t("purge.close")}
      >
        <p className="text-[14px] [color:var(--text-secondary)]">{t("purge.body")}</p>
      </Modal>
    </SectionCard>
  );
}

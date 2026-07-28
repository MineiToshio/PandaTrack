"use client";

import { Bell } from "lucide-react";
import posthog from "posthog-js";
import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Eyebrow from "@/components/core/Eyebrow";
import SectionCard from "@/components/core/SectionCard";
import Switch from "@/components/core/Switch";
import { useToast } from "@/components/core/Toast";
import type { Locale } from "@/types/locale";
import { POSTHOG_EVENTS } from "@/lib/constants";
import {
  getExistingSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeBrowserToPush,
  unsubscribeBrowserFromPush,
} from "@/lib/pwa/pushSubscription";
import {
  sendTestNotificationAction,
  setNotificationPreferenceAction,
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "@/app/[locale]/(app)/settings/_actions/notificationActions";
import SettingsRow from "./SettingsRow";

/** Notification types in display order. Values match the `NotificationType` Prisma enum. */
const REMINDER_TYPES = ["PAYMENT_DUE", "ARRIVAL_DUE", "ARRIVAL_OVERDUE", "STORE_REJECTED"] as const;
type ReminderType = (typeof REMINDER_TYPES)[number];

export type NotificationPreferencesState = Record<ReminderType, boolean>;

/** Browser support / permission phases that drive the master toggle rendering. */
type SupportState = "unknown" | "unsupported" | "supported";

export type SettingsNotificationsSectionProps = {
  locale: Locale;
  initialPreferences: NotificationPreferencesState;
};

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export default function SettingsNotificationsSection({
  locale,
  initialPreferences,
}: SettingsNotificationsSectionProps) {
  const t = useTranslations("settings.notifications");
  const { addToast } = useToast();
  const masterId = useId();

  const [support, setSupport] = useState<SupportState>("unknown");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [masterOn, setMasterOn] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [masterPending, setMasterPending] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferencesState>(initialPreferences);
  const [, startPreferenceTransition] = useTransition();
  const [testPending, startTestTransition] = useTransition();

  // Support and permission can only be read in the browser, so the master state is
  // reconciled after mount rather than assumed during SSR. `getExistingSubscription`
  // always resolves asynchronously (returning null when unsupported), so every state
  // write below happens in an async continuation rather than synchronously in the effect.
  useEffect(() => {
    let cancelled = false;
    const reconcile = async () => {
      const supported = isPushSupported();
      const currentPermission = getNotificationPermission();
      const subscription = await getExistingSubscription();
      if (cancelled) return;
      setSupport(supported ? "supported" : "unsupported");
      setPermission(supported ? currentPermission : "unsupported");
      setMasterOn(supported && currentPermission === "granted" && subscription !== null);
      setEndpoint(subscription?.endpoint ?? null);
    };
    void reconcile();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnable = useCallback(async () => {
    setMasterPending(true);
    try {
      const result = await subscribeBrowserToPush(VAPID_PUBLIC_KEY);
      if (result.status === "unsupported") {
        setSupport("unsupported");
        setPermission("unsupported");
        return;
      }
      if (result.status === "permission-denied") {
        setPermission("denied");
        return;
      }
      if (result.status === "failed") {
        addToast(t("errors.enableFailed"), { variant: "error" });
        return;
      }

      const persisted = await subscribeToPushAction(result.subscription);
      if (!persisted.ok) {
        // Keep browser and server in sync: roll back the browser subscription we just created.
        await unsubscribeBrowserFromPush();
        addToast(t("errors.enableFailed"), { variant: "error" });
        return;
      }

      setPermission("granted");
      setMasterOn(true);
      setEndpoint(result.subscription.endpoint);
      posthog.capture(POSTHOG_EVENTS.NOTIFICATIONS.NOTIFICATIONS_ENABLED);
    } finally {
      setMasterPending(false);
    }
  }, [addToast, t]);

  const handleDisable = useCallback(async () => {
    setMasterPending(true);
    try {
      const removedEndpoint = (await unsubscribeBrowserFromPush()) ?? endpoint;
      if (removedEndpoint) {
        await unsubscribeFromPushAction(removedEndpoint);
      }
      setMasterOn(false);
      setEndpoint(null);
      posthog.capture(POSTHOG_EVENTS.NOTIFICATIONS.NOTIFICATIONS_DISABLED);
    } finally {
      setMasterPending(false);
    }
  }, [endpoint]);

  const handleMasterChange = useCallback(
    (next: boolean) => {
      if (masterPending) return;
      if (next) {
        void handleEnable();
      } else {
        void handleDisable();
      }
    },
    [handleDisable, handleEnable, masterPending],
  );

  const handleToggleType = useCallback(
    (type: ReminderType) => {
      const previous = preferences[type];
      const next = !previous;
      // Optimistic: reflect the new value immediately and revert on server failure.
      setPreferences((current) => ({ ...current, [type]: next }));
      posthog.capture(POSTHOG_EVENTS.NOTIFICATIONS.NOTIFICATION_TYPE_TOGGLED, { type, enabled: next });
      startPreferenceTransition(async () => {
        const result = await setNotificationPreferenceAction({ type, enabled: next });
        if (!result.ok) {
          setPreferences((current) => ({ ...current, [type]: previous }));
          addToast(t("errors.toggleFailed"), { variant: "error" });
        }
      });
    },
    [addToast, preferences, t],
  );

  const handleSendTest = useCallback(() => {
    startTestTransition(async () => {
      const result = await sendTestNotificationAction(locale);
      if (result.ok && result.sent > 0) {
        addToast(t("test.success"), { variant: "success" });
      } else {
        addToast(t("test.error"), { variant: "error" });
      }
    });
  }, [addToast, locale, t]);

  const isUnsupported = support === "unsupported";
  const isDenied = permission === "denied";

  return (
    <SectionCard
      topAccent="accent"
      headingLevel="h2"
      eyebrow={
        <Eyebrow variant="chip" tone="accent" icon={Bell}>
          {t("eyebrow")}
        </Eyebrow>
      }
      title={t("title")}
    >
      <p className="-mt-2 mb-2 text-[13px] [color:var(--text-secondary)]">{t("subtitle")}</p>

      {isUnsupported ? (
        <p
          role="status"
          className="mb-2 rounded-[var(--radius-md)] p-3 text-[13px] [color:var(--text-secondary)] [background:var(--surface)] [border:1px_solid_var(--border)]"
        >
          {t("unsupported")}
        </p>
      ) : null}

      {isDenied ? (
        <p
          role="status"
          className="mb-2 rounded-[var(--radius-md)] p-3 text-[13px] [color:var(--text-secondary)] [background:color-mix(in_oklch,var(--warning)_8%,transparent)] [border:1px_solid_color-mix(in_oklch,var(--warning)_28%,transparent)]"
        >
          {t("denied")}
        </p>
      ) : null}

      <SettingsRow
        label={t("master.label")}
        value={<span className="[color:var(--text-secondary)]">{t("master.helper")}</span>}
        actions={
          <Switch
            id={masterId}
            checked={masterOn}
            loading={masterPending}
            disabled={isUnsupported || isDenied}
            onChange={handleMasterChange}
            ariaLabel={t("master.label")}
          />
        }
      />

      {REMINDER_TYPES.map((type) => (
        <SettingsRow
          key={type}
          label={t(`types.${type}.label`)}
          value={<span className="[color:var(--text-secondary)]">{t(`types.${type}.helper`)}</span>}
          actions={
            <Switch
              checked={preferences[type]}
              disabled={!masterOn}
              onChange={() => handleToggleType(type)}
              ariaLabel={t(`types.${type}.label`)}
            />
          }
        />
      ))}

      {masterOn ? (
        <SettingsRow
          label={t("test.label")}
          value={<span className="[color:var(--text-secondary)]">{t("test.helper")}</span>}
          actions={
            <Button type="button" variant="ghost" size="sm" onClick={handleSendTest} disabled={testPending}>
              {t("test.button")}
            </Button>
          }
        />
      ) : null}
    </SectionCard>
  );
}

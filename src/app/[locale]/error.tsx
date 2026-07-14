"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RotateCw, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import EmptyState from "@/components/modules/EmptyState";

type PublicShellErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PublicShellError({ error, reset }: PublicShellErrorProps) {
  const t = useTranslations("common.error");
  const locale = useLocale();

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { area: "public_shell" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <EmptyState
      appearance="page"
      role="alert"
      headingAs="h1"
      iconTone="destructive"
      icon={<TriangleAlert width={32} height={32} aria-hidden />}
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("description")}
      actions={
        <>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={reset}
            leadingIcon={<RotateCw size={16} aria-hidden />}
          >
            {t("retry")}
          </Button>
          <Button as="a" href={`/${locale}`} variant="ghost" size="md">
            {t("goHome")}
          </Button>
        </>
      }
    />
  );
}

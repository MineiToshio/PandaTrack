"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Heading from "@/components/core/Heading";
import Typography from "@/components/core/Typography";

type AppShellErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppShellError({ error, reset }: AppShellErrorProps) {
  const t = useTranslations("appLayout.error");

  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        area: "app_shell",
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="bg-background flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 py-12">
      <div className="bg-surface border-border w-full max-w-xl rounded-xl border p-6 text-center shadow-sm">
        <Heading as="h2" size="sm" className="text-text-title">
          {t("title")}
        </Heading>
        <Typography size="md" className="text-text-body mt-3">
          {t("description")}
        </Typography>
        <Button type="button" variant="primary" className="mt-6" onClick={reset}>
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}

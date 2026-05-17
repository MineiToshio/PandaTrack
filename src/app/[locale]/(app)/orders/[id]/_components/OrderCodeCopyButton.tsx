"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";

type OrderCodeCopyButtonProps = {
  code: string;
  locale: string;
};

export default function OrderCodeCopyButton({ code }: OrderCodeCopyButtonProps) {
  const t = useTranslations("orders");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; silently ignore
    }
  }, [code]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={t("detail.hero.copyCodeAria")}
      className="text-text-secondary hover:text-text-title -mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium transition-colors"
    >
      <span className="font-mono tracking-tight">{code}</span>
      {copied ? (
        <Check className="text-success size-3" aria-hidden />
      ) : (
        <Copy className="text-text-muted size-3" aria-hidden />
      )}
      {copied && (
        <span className="sr-only" role="status">
          {t("detail.hero.codeCopied")}
        </span>
      )}
    </button>
  );
}

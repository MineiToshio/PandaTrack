"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

type CodeCopyButtonProps = {
  /** The mono code to display and copy (e.g. "ORD-20260428-01", "DLV-20260508-01"). */
  code: string;
  /** Accessible label for the button (i18n is the caller's responsibility). */
  copyAriaLabel: string;
  /** Screen-reader announcement after a successful copy. */
  copiedAnnouncement: string;
};

const COPIED_FEEDBACK_MS = 2000;

/** Mono entity-code with click-to-copy + transient check feedback (detail heroes). */
export default function CodeCopyButton({ code, copyAriaLabel, copiedAnnouncement }: CodeCopyButtonProps) {
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
      timerRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // clipboard blocked; silently ignore
    }
  }, [code]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copyAriaLabel}
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
          {copiedAnnouncement}
        </span>
      )}
    </button>
  );
}

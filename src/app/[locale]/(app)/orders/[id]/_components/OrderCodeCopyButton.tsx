"use client";

import { useTranslations } from "next-intl";
import CodeCopyButton from "@/components/core/CodeCopyButton";

type OrderCodeCopyButtonProps = {
  code: string;
  locale: string;
};

/** Orders-namespace wrapper around the canonical `<CodeCopyButton>`. */
export default function OrderCodeCopyButton({ code }: OrderCodeCopyButtonProps) {
  const t = useTranslations("orders");

  return (
    <CodeCopyButton
      code={code}
      copyAriaLabel={t("detail.hero.copyCodeAria")}
      copiedAnnouncement={t("detail.hero.codeCopied")}
    />
  );
}

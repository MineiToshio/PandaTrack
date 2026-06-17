import { HelpCircle } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";
import Section from "./Section";
import FaqAccordion, { type FaqItem } from "@/components/modules/FaqAccordion/FaqAccordion";

function getFaqItemsFromMessages(messages: unknown): FaqItem[] {
  const landing = (messages as Record<string, unknown>)?.landing as Record<string, unknown> | undefined;
  const faqs = landing?.faqs as Record<string, unknown> | undefined;
  const items = faqs?.items;
  if (!Array.isArray(items)) return [];
  return (items as Array<{ question: string; answer: string }>).map((item, index) => ({
    id: `faq-${index}`,
    question: item.question ?? "",
    answer: item.answer ?? "",
  }));
}

export default function Faqs() {
  const t = useTranslations("landing.faqs");
  const messages = useMessages();
  const items = getFaqItemsFromMessages(messages);

  return (
    <Section
      id="faqs"
      headingId="faqs-heading"
      eyebrow={t("eyebrow")}
      eyebrowIcon={<HelpCircle aria-hidden="true" />}
      title={t("title")}
      tinted
    >
      <FaqAccordion items={items} />
    </Section>
  );
}

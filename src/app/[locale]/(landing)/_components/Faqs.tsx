import { useMessages, useTranslations } from "next-intl";
import Section from "@/app/[locale]/(landing)/_components/Section";
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
      sectionId="faqs"
      ariaLabelledby="faqs-heading"
      title={t("sectionTitle")}
      subtitle={t("sectionSubtitle")}
      headingId="faqs-heading"
      className="relative"
      background={
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background: "radial-gradient(ellipse 70% 50% at 50% 0%, var(--muted) 0%, transparent 55%)",
          }}
          aria-hidden
        />
      }
    >
      <div className="mx-auto max-w-3xl">
        <FaqAccordion items={items} />
      </div>
    </Section>
  );
}

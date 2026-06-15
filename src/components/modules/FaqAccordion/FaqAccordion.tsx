"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/styles";
import { POSTHOG_EVENTS } from "@/lib/constants";
import posthog from "posthog-js";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

type FaqAccordionProps = {
  items: FaqItem[];
  className?: string;
};

/**
 * Accessible disclosure accordion (`.mk-faq`). First item open by default.
 * `aria-expanded` / `aria-controls` on each trigger; collapse uses a max-height
 * transition. Emits FAQ_ITEM_TOGGLED on every toggle.
 */
export default function FaqAccordion({ items, className }: FaqAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  const toggle = useCallback((id: string, question: string) => {
    setOpenId((prev) => {
      const wasOpen = prev === id;
      posthog.capture(POSTHOG_EVENTS.LANDING.FAQ_ITEM_TOGGLED, {
        faq_id: id,
        faq_question: question,
        action: wasOpen ? "collapsed" : "expanded",
      });
      return wasOpen ? null : id;
    });
  }, []);

  return (
    <div className={cn("mk-faq", className)}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        const panelId = `faq-panel-${item.id}`;
        const triggerId = `faq-trigger-${item.id}`;

        return (
          <div key={item.id} className={cn("mk-faq-item", isOpen && "is-open")}>
            <button
              type="button"
              id={triggerId}
              className="mk-faq-q"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(item.id, item.question)}
            >
              <span>{item.question}</span>
              <span className="chev">
                <ChevronDown aria-hidden="true" />
              </span>
            </button>
            <div id={panelId} role="region" aria-labelledby={triggerId} className="mk-faq-a">
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

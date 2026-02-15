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

export default function FaqAccordion({ items, className }: FaqAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = useCallback(
    (id: string, question: string) => {
      const wasOpen = openId === id;
      setOpenId((prev) => (prev === id ? null : id));

      // Track FAQ item toggle
      posthog.capture(POSTHOG_EVENTS.LANDING.FAQ_ITEM_TOGGLED, {
        faq_id: id,
        faq_question: question,
        action: wasOpen ? "collapsed" : "expanded",
      });
    },
    [openId],
  );

  return (
    <div className={cn("space-y-2", className)} role="list">
      {items.map((item) => {
        const isOpen = openId === item.id;
        const panelId = `faq-panel-${item.id}`;
        const triggerId = `faq-trigger-${item.id}`;

        return (
          <div
            key={item.id}
            className={cn(
              "border-border bg-card overflow-hidden rounded-xl border transition-all duration-300 ease-out",
              "hover:border-primary/30 focus-within:ring-ring focus-within:ring-offset-background focus-within:ring-2 focus-within:ring-offset-2",
              isOpen && "border-primary/50 ring-primary/20 ring-1",
            )}
            role="listitem"
          >
            <button
              type="button"
              id={triggerId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(item.id, item.question)}
              className="text-foreground hover:bg-surface-2/50 flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors"
            >
              <span className="text-text-title font-semibold">{item.question}</span>
              <ChevronDown
                className={cn(
                  "text-muted-foreground h-5 w-5 shrink-0 transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              className={cn(
                "grid transition-all duration-300 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="border-border/50 text-text-body border-t px-5 py-4 text-sm leading-relaxed">
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

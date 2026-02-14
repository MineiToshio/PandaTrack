"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import Button from "@/components/core/Button/Button";
import Heading from "@/components/core/Heading";
import Input from "@/components/core/Input";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";
import { submitWaitlist } from "./submitWaitlist";
import { waitlistSchema } from "./waitlistSchema";

const BANNER_CTA_ANIMATION = "banner-cta-subtle 3s ease-in-out infinite";

export default function Waitlist() {
  const t = useTranslations("landing.waitlist");
  const tValidation = useTranslations("landing.waitlist.validation");
  const [state, formAction, isPending] = useActionState(
    async (_prev: Awaited<ReturnType<typeof submitWaitlist>> | null, formData: FormData) => submitWaitlist(formData),
    null,
  );
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const handleSubmit = (formData: FormData) => {
    setClientErrors({});
    const raw = {
      email: formData.get("email") ?? undefined,
      name: formData.get("name") ?? undefined,
      comment: formData.get("comment") ?? undefined,
    };
    const parsed = waitlistSchema.safeParse({
      email: typeof raw.email === "string" ? raw.email.trim() : "",
      name: typeof raw.name === "string" ? raw.name.trim() || undefined : undefined,
      comment: typeof raw.comment === "string" ? raw.comment.trim() || undefined : undefined,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as string;
        const key =
          issue.message === "emailRequired" || issue.message === "emailInvalid" ? issue.message : "emailInvalid";
        errors[path] = tValidation(key as "emailRequired" | "emailInvalid");
      }
      setClientErrors(errors);
      return;
    }
    formAction(formData);
  };

  const fieldErrors = state?.success === false && "fieldErrors" in state ? (state.fieldErrors ?? {}) : {};
  const emailError =
    clientErrors.email ??
    (fieldErrors.email?.[0] ? tValidation(fieldErrors.email[0] as "emailRequired" | "emailInvalid") : undefined);
  const showSuccess = state?.success === true;
  const showError = state?.success === false && "error" in state && state.error;

  return (
    <section
      id="waitlist"
      aria-labelledby="waitlist-heading"
      className="bg-surface text-foreground relative w-full overflow-hidden px-4 py-16 md:px-6 md:py-24 lg:px-8"
    >
      <div
        className="from-primary/20 via-primary/10 pointer-events-none absolute inset-0 bg-linear-to-b to-transparent opacity-90"
        aria-hidden
      />
      <div
        className="bg-primary/20 pointer-events-none absolute top-1/2 -left-1/4 size-[400px] rounded-full opacity-40 blur-[100px]"
        style={{ animation: "hero-glow-pulse 8s ease-in-out infinite" }}
        aria-hidden
      />
      <div
        className="bg-highlight/15 pointer-events-none absolute top-1/3 -right-1/4 size-[320px] rounded-full opacity-40 blur-[80px]"
        style={{ animation: "hero-glow-pulse 10s ease-in-out infinite 1s" }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl">
          <header className="text-center">
            <Heading
              as="h2"
              id="waitlist-heading"
              size="md"
              className="text-text-title text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
            >
              {t("title")}
            </Heading>
            <Typography size="md" className="text-text-body mt-4 leading-relaxed md:text-lg">
              {t("subtitle")}
            </Typography>
          </header>

          {showSuccess ? (
            <div
              className="border-border bg-card mt-10 rounded-2xl border p-8 text-center"
              role="status"
              aria-live="polite"
            >
              <Typography className="text-foreground font-medium">{t("success")}</Typography>
            </div>
          ) : (
            <form action={handleSubmit} className="mt-10 space-y-5">
              <div>
                <label htmlFor="waitlist-email" className="text-text-title mb-1.5 block text-sm font-medium">
                  {t("fields.email")} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="waitlist-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("fields.emailPlaceholder")}
                  required
                  error={!!emailError}
                  disabled={isPending}
                  className="w-full"
                />
                {emailError && (
                  <p className="text-destructive mt-1 text-sm" role="alert">
                    {emailError}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="waitlist-name" className="text-text-title mb-1.5 block text-sm font-medium">
                  {t("fields.name")}{" "}
                  <span className="text-muted-foreground text-xs font-normal">({t("fields.nameOptional")})</span>
                </label>
                <Input
                  id="waitlist-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder={t("fields.namePlaceholder")}
                  disabled={isPending}
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="waitlist-comment" className="text-text-title mb-1.5 block text-sm font-medium">
                  {t("fields.comment")}{" "}
                  <span className="text-muted-foreground text-xs font-normal">({t("fields.commentOptional")})</span>
                </label>
                <Textarea
                  id="waitlist-comment"
                  name="comment"
                  placeholder={t("fields.commentPlaceholder")}
                  rows={4}
                  disabled={isPending}
                  className="w-full resize-y"
                />
              </div>
              {showError && (
                <p className="text-destructive text-sm" role="alert">
                  {t("error")}
                </p>
              )}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isPending}
                  className={cn(
                    "w-full transition-transform duration-300 ease-out hover:scale-[1.02]",
                    "animate-[banner-cta-subtle_3s_ease-in-out_infinite]",
                  )}
                  style={{ animation: BANNER_CTA_ANIMATION }}
                >
                  {isPending ? "…" : t("cta")}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

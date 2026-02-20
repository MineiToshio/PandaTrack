"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/core/Button/Button";
import Input from "@/components/core/Input";
import Textarea from "@/components/core/Textarea";
import Typography from "@/components/core/Typography";
import { cn } from "@/lib/styles";

const BANNER_CTA_ANIMATION = "banner-cta-subtle 3s ease-in-out infinite";
const EMAIL_ERROR_ID = "waitlist-email-error";

type WaitlistFormProps = {
  locale: string;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
  emailError: string | undefined;
  showError: boolean;
};

export default function WaitlistForm({
  locale,
  onSubmit,
  isPending,
  emailError,
  showError,
}: WaitlistFormProps) {
  const t = useTranslations("landing.waitlist");
  const tValidation = useTranslations("landing.waitlist.validation");

  return (
    <form action={onSubmit} className="mt-10 space-y-5" aria-busy={isPending}>
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor="waitlist-email" className="text-text-title mb-1.5 block text-sm font-medium">
          {t("fields.email")}{" "}
          <span className="text-destructive" aria-hidden>
            *
          </span>
        </label>
        <Input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("fields.emailPlaceholder")}
          required
          error={!!emailError}
          aria-invalid={!!emailError}
          aria-describedby={emailError ? EMAIL_ERROR_ID : undefined}
          disabled={isPending}
          className="w-full"
        />
        {emailError && (
          <Typography id={EMAIL_ERROR_ID} size="sm" className="text-destructive mt-1" role="alert">
            {emailError}
          </Typography>
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
        <Typography size="sm" className="text-destructive" role="alert">
          {t("error")}
        </Typography>
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
  );
}

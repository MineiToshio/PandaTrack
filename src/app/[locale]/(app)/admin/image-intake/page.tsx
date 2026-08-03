import { ImageIcon, Search } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import Button from "@/components/core/Button/Button";
import Card from "@/components/core/Card";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import Chip from "@/components/core/Chip";
import EmptyState from "@/components/modules/EmptyState";
import { searchImageIntakeQuotaAccounts } from "@/lib/data/imageIntake/imageIntakeQuotaQueries";
import { DEFAULT_MONTHLY_PHOTO_QUOTA } from "@/lib/imageIntake/constants";
import { computeRemainingPhotos, resolveEffectiveMonthlyLimit } from "@/lib/imageIntake/quota";
import QuotaOverrideForm from "./_components/QuotaOverrideForm";

const SEARCH_PARAM = "q";

type AdminImageIntakePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [SEARCH_PARAM]?: string | string[] }>;
};

export async function generateMetadata({ params }: AdminImageIntakePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("meta.imageIntakeTitle"), robots: { index: false, follow: false } };
}

/**
 * Photo-quota console: find one account, see what it has spent this period, and set or clear its
 * monthly override.
 *
 * Search is a plain server round-trip through `?q=`, so the result set is never held in client
 * state and a link to a specific search stays shareable between administrators. The route sits
 * under `/admin`, whose layout runs `requireAdmin()`; the write itself gates again in the action.
 */
export default async function AdminImageIntakePage({ params, searchParams }: AdminImageIntakePageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const rawQuery = resolvedSearchParams[SEARCH_PARAM];
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "";

  const t = await getTranslations({ locale, namespace: "admin" });
  const accounts = query.length > 0 ? await searchImageIntakeQuotaAccounts({ query, now: new Date() }) : [];

  return (
    <>
      <SetHeaderTitle title={t("nav.imageIntake")} />

      <section className="flex flex-col gap-[var(--space-4)]">
        <p className="[font-size:var(--text-body)] [color:var(--text-secondary)]">
          {t("imageIntake.intro", { defaultQuota: DEFAULT_MONTHLY_PHOTO_QUOTA })}
        </p>

        <form method="get" className="flex flex-col gap-[var(--space-2)] sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor="image-intake-quota-search">{t("imageIntake.searchLabel")}</Label>
            <Input
              id="image-intake-quota-search"
              name={SEARCH_PARAM}
              defaultValue={query}
              placeholder={t("imageIntake.searchPlaceholder")}
              leadingIcon={<Search size={16} aria-hidden />}
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            {t("imageIntake.searchSubmit")}
          </Button>
        </form>

        {query.length === 0 ? (
          <EmptyState
            appearance="card"
            headingAs="h2"
            icon={<ImageIcon className="h-7 w-7" aria-hidden />}
            iconTone="neutral"
            title={t("imageIntake.idle.title")}
            subtitle={t("imageIntake.idle.subtitle")}
          />
        ) : accounts.length === 0 ? (
          <EmptyState
            appearance="card"
            headingAs="h2"
            icon={<Search className="h-7 w-7" aria-hidden />}
            iconTone="neutral"
            title={t("imageIntake.noResults.title")}
            subtitle={t("imageIntake.noResults.subtitle")}
          />
        ) : (
          <ul className="flex flex-col gap-[var(--space-3)]">
            {accounts.map((account) => {
              const effectiveLimit = resolveEffectiveMonthlyLimit({
                isAdmin: account.isAdmin,
                override: account.overrideLimit,
              });
              const remaining = computeRemainingPhotos(effectiveLimit, account.usedPhotos);

              return (
                <li key={account.userId}>
                  <Card variant="outlined" padding="md">
                    <div className="flex flex-col gap-[var(--space-3)]">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="[font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                          {account.username}
                        </span>
                        <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">
                          {account.email}
                        </span>
                        {account.isAdmin && (
                          <Chip variant="neutral" size="sm">
                            {t("imageIntake.adminTag")}
                          </Chip>
                        )}
                      </div>

                      <p className="[font-size:var(--text-caption)] [color:var(--text-secondary)]">
                        {effectiveLimit === null
                          ? t("imageIntake.usageUncapped", { used: account.usedPhotos })
                          : t("imageIntake.usage", {
                              used: account.usedPhotos,
                              limit: effectiveLimit,
                              remaining: remaining ?? 0,
                            })}
                      </p>

                      <QuotaOverrideForm targetUserId={account.userId} currentLimit={account.overrideLimit} />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

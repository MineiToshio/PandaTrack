import { Search, Sparkles, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import SetHeaderTitle from "@/app/[locale]/(app)/_components/AppLayout/SetHeaderTitle";
import Button from "@/components/core/Button/Button";
import Card from "@/components/core/Card";
import Chip from "@/components/core/Chip";
import Input from "@/components/core/Input";
import Label from "@/components/core/Label";
import EmptyState from "@/components/modules/EmptyState";
import { ROUTES } from "@/lib/constants";
import {
  getAdminProgressionOverview,
  getProgressionAccount,
  listUserPointLedgerPage,
  searchProgressionAccounts,
} from "@/lib/data/progression/adminProgressionQueries";
import AdminPager from "../_components/share/AdminPager";
import PointLedgerTable from "./_components/PointLedgerTable";
import ProgressionLedgerViewedCapture from "./_components/ProgressionLedgerViewedCapture";
import VoidPointsControl from "./_components/VoidPointsControl";

const SEARCH_PARAM = "q";
const USER_PARAM = "user";
const PAGE_PARAM = "page";

type AdminProgressionPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: AdminProgressionPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("meta.progressionTitle"), robots: { index: false, follow: false } };
}

/** First value of a possibly repeated search param, trimmed; empty string when absent. */
function readParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Parse the 1-based `?page=N` param; anything non-numeric falls back to page 1. */
function parsePageParam(rawPage: string): number {
  const parsed = Number.parseInt(rawPage, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * Progression console: find one collector, read why their point total is what it is, and void it.
 *
 * Search is a plain server round-trip through `?q=`, the selected collector rides in `?user=`, and
 * the ledger pages through `?page=`, so the URL is the whole state and a link to any of it stays
 * shareable between administrators. The route sits under `/admin`, whose layout runs
 * `requireAdmin()`; the void gates again inside its own Server Action.
 *
 * Nothing monetary is read or rendered here. The layer prices recordkeeping, not spending, and the
 * surface that reverses it has no reason to know what anything cost.
 */
export default async function AdminProgressionPage({ params, searchParams }: AdminProgressionPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const query = readParam(resolvedSearchParams[SEARCH_PARAM]);
  const selectedUserId = readParam(resolvedSearchParams[USER_PARAM]);
  const page = parsePageParam(readParam(resolvedSearchParams[PAGE_PARAM]));

  const t = await getTranslations({ locale, namespace: "admin" });
  const tProgress = await getTranslations({ locale, namespace: "progress" });

  const selectedAccount = selectedUserId.length > 0 ? await getProgressionAccount(selectedUserId) : null;
  const accounts = selectedAccount === null && query.length > 0 ? await searchProgressionAccounts({ query }) : [];

  const basePath = `/${locale}${ROUTES.adminProgression}`;
  const buildAccountHref = (userId: string) =>
    `${basePath}?${new URLSearchParams({ [SEARCH_PARAM]: query, [USER_PARAM]: userId }).toString()}`;

  return (
    <>
      <SetHeaderTitle title={t("nav.progression")} />

      <section className="flex flex-col gap-[var(--space-4)]">
        <p className="[font-size:var(--text-body)] [color:var(--text-secondary)]">{t("progression.intro")}</p>

        <form method="get" action={basePath} className="flex flex-col gap-[var(--space-2)] sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor="progression-account-search">{t("progression.searchLabel")}</Label>
            <Input
              id="progression-account-search"
              name={SEARCH_PARAM}
              defaultValue={query}
              placeholder={t("progression.searchPlaceholder")}
              leadingIcon={<Search size={16} aria-hidden />}
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            {t("progression.searchSubmit")}
          </Button>
        </form>

        {selectedAccount !== null ? (
          <SelectedCollector
            account={selectedAccount}
            page={page}
            query={query}
            basePath={basePath}
            locale={locale}
            t={t}
            tProgress={tProgress}
          />
        ) : query.length === 0 ? (
          <EmptyState
            appearance="card"
            headingAs="h2"
            icon={<Trophy className="h-7 w-7" aria-hidden />}
            iconTone="neutral"
            title={t("progression.idle.title")}
            subtitle={t("progression.idle.subtitle")}
          />
        ) : accounts.length === 0 ? (
          <EmptyState
            appearance="card"
            headingAs="h2"
            icon={<Search className="h-7 w-7" aria-hidden />}
            iconTone="neutral"
            title={t("progression.noResults.title")}
            subtitle={t("progression.noResults.subtitle")}
          />
        ) : (
          <ul className="flex flex-col gap-[var(--space-3)]">
            {accounts.map((account) => (
              <li key={account.userId}>
                <Card variant="outlined" padding="md">
                  <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="[font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                        {account.username}
                      </span>
                      <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{account.email}</span>
                      {account.isAdmin && (
                        <Chip variant="neutral" size="sm">
                          {t("progression.adminTag")}
                        </Chip>
                      )}
                    </div>
                    <Button as="a" href={buildAccountHref(account.userId)} variant="secondary" size="sm">
                      {t("progression.openLedger")}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

type SelectedCollectorProps = {
  account: NonNullable<Awaited<ReturnType<typeof getProgressionAccount>>>;
  page: number;
  query: string;
  basePath: string;
  locale: string;
  t: Translator;
  tProgress: Translator;
};

/**
 * The selected collector's summary, ledger and void action.
 *
 * Extracted from the page body so the branch that renders a chosen account reads as one unit; it is
 * a Server Component like its parent and holds no state of its own.
 */
async function SelectedCollector({ account, page, query, basePath, locale, t, tProgress }: SelectedCollectorProps) {
  const [overview, ledger] = await Promise.all([
    getAdminProgressionOverview(account.userId),
    listUserPointLedgerPage({ targetUserId: account.userId, page }),
  ]);

  const buildPageHref = (targetPage: number) => {
    const searchParams = new URLSearchParams({ [USER_PARAM]: account.userId, [PAGE_PARAM]: String(targetPage) });
    if (query.length > 0) searchParams.set(SEARCH_PARAM, query);
    return `${basePath}?${searchParams.toString()}`;
  };

  const backHref = query.length > 0 ? `${basePath}?${new URLSearchParams({ [SEARCH_PARAM]: query })}` : basePath;

  const rankLabel = overview.rankKey ? tProgress(`ranks.${overview.rankKey}.name`) : null;
  const highestRankLabel = overview.highestRankKey ? tProgress(`ranks.${overview.highestRankKey}.name`) : null;

  return (
    <>
      <ProgressionLedgerViewedCapture />

      <Card variant="outlined" padding="md">
        <div className="flex flex-col gap-[var(--space-4)]">
          <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="[font-size:var(--text-h4)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
                  {account.username}
                </h2>
                {account.isAdmin && (
                  <Chip variant="neutral" size="sm">
                    {t("progression.adminTag")}
                  </Chip>
                )}
              </div>
              <span className="[font-size:var(--text-caption)] [color:var(--text-muted)]">{account.email}</span>
            </div>

            <div className="flex flex-wrap items-center gap-[var(--space-2)]">
              <Button as="a" href={backHref} variant="ghost" size="sm">
                {t("progression.backToSearch")}
              </Button>
              <VoidPointsControl
                targetUserId={account.userId}
                targetUsername={account.username}
                liveEntryCount={overview.liveEntryCount}
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-3 lg:grid-cols-5">
            <SummaryFigure
              label={t("progression.summary.maturedPoints")}
              value={overview.maturedPoints === null ? "—" : String(overview.maturedPoints)}
            />
            <SummaryFigure
              label={t("progression.summary.rank")}
              value={
                rankLabel === null
                  ? "—"
                  : t("progression.summary.rankValue", { rank: rankLabel, index: overview.rankIndex ?? 0 })
              }
            />
            <SummaryFigure label={t("progression.summary.highestRank")} value={highestRankLabel ?? "—"} />
            <SummaryFigure
              label={t("progression.summary.medals")}
              value={t("progression.summary.medalsValue", {
                unlocked: overview.unlockedMedalCount,
                total: overview.shippedMedalCount,
              })}
            />
            <SummaryFigure
              label={t("progression.summary.entries")}
              value={t("progression.summary.entriesValue", {
                live: overview.liveEntryCount,
                voided: overview.voidedEntryCount,
              })}
            />
          </dl>
        </div>
      </Card>

      {ledger.totalCount === 0 ? (
        <EmptyState
          appearance="card"
          headingAs="h3"
          icon={<Sparkles className="h-7 w-7" aria-hidden />}
          iconTone="neutral"
          title={t("progression.ledger.empty.title")}
          subtitle={t("progression.ledger.empty.subtitle", { username: account.username })}
        />
      ) : (
        <section className="flex flex-col gap-4">
          <PointLedgerTable entries={ledger.items} locale={locale} />
          {ledger.totalPages > 1 && (
            <AdminPager
              currentPage={ledger.currentPage}
              totalPages={ledger.totalPages}
              regionLabel={t("progression.ledger.pagination.regionLabel")}
              olderLabel={t("progression.ledger.pagination.older")}
              newerLabel={t("progression.ledger.pagination.newer")}
              buildHref={buildPageHref}
            />
          )}
        </section>
      )}
    </>
  );
}

/** One labelled figure in the summary grid. Points and counts only, never a monetary amount. */
function SummaryFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="[font-family:var(--font-mono)] [font-size:var(--text-eyebrow)] [letter-spacing:0.06em] [color:var(--text-muted)] uppercase">
        {label}
      </dt>
      <dd className="[font-size:var(--text-body)] [font-weight:var(--font-weight-semibold)] [color:var(--text-primary)]">
        {value}
      </dd>
    </div>
  );
}

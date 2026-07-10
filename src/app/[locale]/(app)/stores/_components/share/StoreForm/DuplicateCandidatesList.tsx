"use client";

import { Building2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import Typography from "@/components/core/Typography";
import { ROUTES } from "@/lib/constants";
import type { DuplicateCandidate } from "@/lib/data/stores/storeQueries";

type DuplicateCandidatesListProps = {
  candidates: DuplicateCandidate[];
};

export default function DuplicateCandidatesList({ candidates }: DuplicateCandidatesListProps) {
  const locale = useLocale();
  const tCountries = useTranslations("countries");

  return (
    <ul className="space-y-2">
      {candidates.map((candidate) => (
        <li key={candidate.id}>
          <Link
            href={`/${locale}${ROUTES.stores}/${candidate.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-background/70 hover:border-primary/60 hover:bg-background group flex items-center gap-2 rounded-lg border p-2 transition-colors"
          >
            {candidate.logoUrl ? (
              <Image
                src={candidate.logoUrl}
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-md object-cover"
                unoptimized
              />
            ) : (
              <span className="bg-muted text-text-muted group-hover:text-primary inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors">
                <Building2 size={14} aria-hidden />
              </span>
            )}
            <span className="min-w-0">
              <Typography size="xs" className="text-text-body block truncate">
                {candidate.name}
              </Typography>
              <Typography size="2xs" className="text-text-muted block">
                {tCountries(candidate.countryCode)}
              </Typography>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

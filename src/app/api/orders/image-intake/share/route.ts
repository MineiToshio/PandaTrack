import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import {
  SHARE_INTAKE_PATH,
  SHARE_SOURCE_PARAM,
  SHARE_SOURCE_SHARE,
  SHARE_STASH_FAILED,
  SHARE_STASH_PARAM,
} from "@/lib/pwa/shareStash";
import { isLocale } from "@/types/locale";

// The share arrives as a navigation POST from the OS: never cached, never prerendered.
export const dynamic = "force-dynamic";

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
// See Other: the browser follows it as a GET, so the intake screen loads as a normal page.
const SHARE_REDIRECT_STATUS = 303;

/**
 * Network fallback for the share target.
 *
 * The share-target POST is meant to be answered by the service worker, which keeps the file on the
 * device and hands it to the client pipeline. This handler only runs when no worker is controlling
 * the request, and its single job is to turn what would otherwise be a raw `404` into the intake
 * screen with a readable error, so the user can attach the photos by hand instead of losing them
 * to a blank page.
 *
 * The body is deliberately never read: without a worker there is no way to return the bytes to the
 * client anyway, and buffering a multi-megabyte upload only to discard it is pure waste.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : routing.defaultLocale;

  const target = new URL(`/${locale}${SHARE_INTAKE_PATH}`, request.nextUrl.origin);
  target.searchParams.set(SHARE_SOURCE_PARAM, SHARE_SOURCE_SHARE);
  target.searchParams.set(SHARE_STASH_PARAM, SHARE_STASH_FAILED);

  return NextResponse.redirect(target, SHARE_REDIRECT_STATUS);
}

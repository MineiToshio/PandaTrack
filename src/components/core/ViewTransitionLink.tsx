"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, type ComponentPropsWithoutRef, type MouseEvent } from "react";
import posthog from "posthog-js";
import { FEATURE_FLAGS, POSTHOG_EVENTS } from "@/lib/constants";

type ViewTransitionLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  /** Entity tag attached to the navigation analytics event (e.g. "order", "delivery", "store"). */
  viewTransitionEntity?: string;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => unknown;
};

/** Poll cadence + hard ceiling for the navigation-commit wait (see `waitForNavigationCommit`). */
const NAVIGATION_COMMIT_POLL_MS = 16;
const NAVIGATION_COMMIT_TIMEOUT_MS = 600;

/**
 * Resolves once the soft navigation has committed — detected by the clicked link leaving the DOM,
 * which means the list unmounted and the detail hero (same `view-transition-name`) is now mounted,
 * so the API can snapshot the destination and morph into it.
 *
 * Critically this waits off the timer queue, NOT `requestAnimationFrame`: while the update-callback
 * promise is pending the View Transitions API suppresses rendering, so rAF callbacks never fire and
 * the transition would stall until the browser's internal ceiling ("Transition was aborted because
 * of timeout in DOM update"). The capped poll keeps us well under that ceiling and degrades to a
 * plain cross-fade if the navigation is slower than the timeout.
 */
function waitForNavigationCommit(sourceLink: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const poll = () => {
      if (!sourceLink.isConnected || performance.now() - startedAt >= NAVIGATION_COMMIT_TIMEOUT_MS) {
        resolve();
        return;
      }
      setTimeout(poll, NAVIGATION_COMMIT_POLL_MS);
    };
    setTimeout(poll, NAVIGATION_COMMIT_POLL_MS);
  });
}

/**
 * Whether a shared-element View Transition should wrap this navigation (ADR 0014 D2).
 * Triple gate: never under automation (keeps e2e navigation deterministic), on in
 * dev/preview so the motion is reviewable with `npm run dev`, and behind the PostHog
 * runtime flag in production so it can be ramped or killed without a redeploy.
 */
function viewTransitionsEnabled(): boolean {
  if (typeof navigator !== "undefined" && navigator.webdriver) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return posthog.isFeatureEnabled(FEATURE_FLAGS.LIST_DETAIL_VIEW_TRANSITIONS) === true;
}

/**
 * Drop-in replacement for `next/link` that morphs the shared element (the list card/row
 * → the detail hero, matched by `view-transition-name`) when navigating list → detail.
 *
 * Degrades gracefully: modified/middle clicks, non-string hrefs, browsers without the
 * View Transitions API, automation, and the disabled flag all fall back to the native
 * `<Link>` navigation, so the app behaves identically when the morph is unavailable — it
 * is an enhancement, never a hard dependency. The reduced-motion treatment (gentle
 * cross-fade, no morph — "reduced ≠ none") lives in `globals.css` § prefers-reduced-motion.
 */
const ViewTransitionLink = forwardRef<HTMLAnchorElement, ViewTransitionLinkProps>(function ViewTransitionLink(
  { href, onClick, viewTransitionEntity, ...rest },
  ref,
) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    // Preserve native semantics for modified / non-primary clicks (open in new tab, etc.).
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof href !== "string") return;

    const doc = document as DocumentWithViewTransition;
    if (typeof doc.startViewTransition !== "function") return;
    if (!viewTransitionsEnabled()) return;

    event.preventDefault();
    posthog.capture(POSTHOG_EVENTS.NAVIGATION.VIEW_TRANSITION_NAVIGATED, { entity: viewTransitionEntity });
    // Captured synchronously: React detaches `currentTarget` once the handler returns.
    const sourceLink = event.currentTarget;
    doc.startViewTransition(() => {
      router.push(href);
      // Hold the new-state snapshot until the destination has committed, so the named element
      // morphs into its final position instead of into itself.
      return waitForNavigationCommit(sourceLink);
    });
  };

  return <Link ref={ref} href={href} onClick={handleClick} {...rest} />;
});

export default ViewTransitionLink;

# PostHog Implementation Notes

## Purpose
Technical reference for analytics instrumentation in PandaTrack.

## Current architecture
- Client init: `src/instrumentation-client.ts`
- Server client: `src/lib/posthog-server.ts`
- Event names: `src/lib/constants.ts` (`POSTHOG_EVENTS`)
- Declarative attributes helper: `src/lib/posthogDataAttributes.ts`

## Client-side tracking pattern
1. Add event constant under `POSTHOG_EVENTS`.
2. Attach analytics to clickable elements via:
   - `posthogEvent` and optional `posthogProps` (Button/AnchorLink)
   - or direct `data-ph-event`/`data-ph-props`
3. Global click delegate in `instrumentation-client.ts` captures events.

## Server-side tracking pattern
Use `getPostHogClient()` in server actions for conversion-critical events.
Typical sequence:
- `capture` event with useful properties
- optional `identify` for known users (waitlist email)

## Environment variables
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

## Guardrails
- Do not hardcode event strings outside `POSTHOG_EVENTS`.
- Keep props minimal and useful.
- Do not let analytics failures block user success flows.

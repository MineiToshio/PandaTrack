---
id: IOS-SHORTCUT-11
type: REFERENCE
parent: FRD-11
title: "Compartir a Panda on iOS: the Shortcut recipe"
last_updated: 2026-07-28
---

# Compartir a Panda on iOS

Android gets the real thing: PandaTrack appears in the system share sheet, receives the image, and
lands the user on the processing screen with the extraction already running. iOS cannot do that.

This document is the honest iOS equivalent: what the Shortcut does, what it cannot do, and the
exact steps to build it.

## What iOS actually supports

Safari on iOS supports installing a web app to the Home Screen, but it does **not** implement the
Web Share Target API. There is no way for a website or an installed web app to appear in the iOS
share sheet as a destination that receives image bytes.

The two consequences, stated plainly because the user will notice them either way:

1. **The Shortcut cannot carry the photos.** It can open PandaTrack on the right screen, but the
   images stay in Photos. The user attaches them on the intake screen, exactly as they would from
   inside the app.
2. **The saving is smaller than on Android.** On Android the share removes the whole navigation
   detour. On iOS it removes the "open the app, find the button, choose the method" part only.

The intake screen says this in its own words when it is opened from the Shortcut. It is never
presented as a failure, and the user is never left on a blank screen wondering where the photos
went.

## The Shortcut recipe

Build it once, in the **Shortcuts** app.

1. Open **Shortcuts** and tap **+** to create a new shortcut.
2. Tap the shortcut's name, then **Info** (the ⓘ icon), and enable **Show in Share Sheet**.
3. Under **Share Sheet Types**, keep **Images** enabled and turn everything else off. This is what
   makes the shortcut appear when the user shares a screenshot, and nothing else.
4. Add the action **Open URLs** (search for "Open URLs").
5. Set the URL to:

   ```text
   https://pandatrack.app/es/orders/new/image?source=ios-shortcut
   ```

   Use `/en/` instead of `/es/` for the English app.

6. Name the shortcut **Compartir a Panda** (or "Share to Panda" in English). The name is what the
   user sees in the share sheet.
7. Tap **Done**.

To use it: in Photos, WhatsApp, or anywhere else, share the screenshot, scroll to the shortcut,
tap it. PandaTrack opens on the intake screen and asks for the photos, which are already in the
camera roll, one tap away.

### Why "Open URLs" and not an upload action

Shortcuts can POST a file to a URL with **Get Contents of URL**. That path was considered and
rejected for this recipe:

- The response of that request is not rendered anywhere the user can see, so the extraction result
  would arrive nowhere. The user would still have to open the app.
- Uploading the original, uncompressed photo from the Shortcut skips the client compression step
  that exists precisely because an uncompressed screenshot can breach the request ceiling.
- It would need an authentication token inside the Shortcut, which is a credential sitting in a
  user-editable automation on the device.

Opening the screen and letting the app's own pipeline run is slower by one tap and correct on every
one of those points.

## What the app does with `source=ios-shortcut`

The intake screen reads the `source` query parameter on mount:

| `source`       | Behaviour                                                                                |
| -------------- | ---------------------------------------------------------------------------------------- |
| `share`        | Reads the stashed files the service worker parked, attaches them, starts the extraction. |
| `ios-shortcut` | Shows the "attach the photos you shared" notice. No stash is ever expected.              |

Both arrivals are recorded with the same analytics event, distinguished by the entry source, so the
real-world split between the two platforms is measurable rather than assumed.

## Android side, for contrast

Nothing has to be installed by hand. The user installs the PWA (an onboarding step offers it), and
from then on PandaTrack is in the share sheet for images. The manifest declares the share target at
`/api/orders/image-intake/share`, and the service worker answers that POST locally: it stashes the
files in Cache Storage and redirects into the app, which compresses and uploads them through the
same path as an in-app pick. The same path also exists as a real route handler, which only runs
when no service worker is controlling the request and does nothing but send the user to the intake
screen with a readable error, so a share can never end on a raw `404`.

The stash survives a detour through sign-in (it lives in Cache Storage, not in memory) and expires
15 minutes after it is written, so a shared screenshot is never left sitting on a shared device.

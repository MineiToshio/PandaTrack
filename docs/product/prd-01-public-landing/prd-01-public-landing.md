---
id: PRD-01
type: PRD
slug: public-landing
title: PandaTrack Public Landing & Web Foundation
status: ACTIVE
parent: null
children:
  - FRD-01
  - FRD-02
  - FRD-03
  - FRD-04
last_updated: 2026-06-18
source_features:
  - FEAT-0001
  - FEAT-0002
  - FEAT-0003
  - FEAT-0004
  - FEAT-0005
  - FEAT-0006
  - FEAT-0007
---

# PRD-01 PandaTrack Public Landing & Web Foundation

## Purpose

Own PandaTrack's public-facing surface: the landing that explains the product, the early-interest/waitlist capture, and the localization, SEO, legal, analytics, and observability foundations of the public web.

This is a durable product surface, not a one-time phase. It began as a pre-release validation surface that tested demand before the collector app existed, and it remains the public entry point that runs alongside the collector app (PRD-02).

## Product Summary

Before the private collector workspace existed, PandaTrack needed to answer a simpler question:

- is the problem compelling enough for collectors to care
- can PandaTrack explain the value clearly in public
- can early-interest users be captured in a structured way
- can the product establish trustworthy web, legal, SEO, analytics, and monitoring foundations

This PRD captures that public surface as a real, durable product area, not as an afterthought or a phase that ends.

## Problem

Without a credible public entry point, PandaTrack would have no clean way to:

- test positioning
- collect early interest
- measure conversion behavior
- localize the experience for its audience
- publish legal and SEO-ready public pages
- observe failures in production

## Product Goal

Deliver a public PandaTrack surface that:

- explains the collector problem clearly
- converts visitors into waitlist interest
- captures enough analytics to validate traction
- remains localized for Spanish and English users
- presents compliant privacy and terms pages
- ships with baseline SEO and error monitoring

## Target Users

### Primary user

A collector who buys across multiple stores or informal channels and immediately recognizes the pain of scattered tracking, uncertain payments, and long waits.

### Secondary user

A curious early adopter who may not sign up immediately, but needs enough clarity and trust to understand the product's value.

## Product Principles

- Explain the collector problem in plain language
- Reduce friction in the first conversion step
- Keep public-web foundations reusable for later product phases
- Treat localization, legal, analytics, SEO, and monitoring as product capabilities, not side chores

## Scope

### In scope

- Public landing narrative and waitlist capture
- Waitlist submission handling with Kit and optional Google Sheets append
- Public-web localization for `es` and `en`
- SEO metadata, sitemap, robots, OG image support, and canonical URLs
- Privacy policy and terms of service public pages
- PostHog analytics foundation for meaningful public interactions
- Sentry runtime monitoring baseline

### Out of scope

- Authenticated collector workflows
- Private dashboard, stores, orders, payments, shipments, or budgets
- Full CMS or dynamic marketing content management
- Complex product analytics beyond the pre-release conversion surface

## Core User Flows

### Discover PandaTrack publicly

1. Visitor lands on the localized home page.
2. Visitor reads the hero, problem framing, feature framing, and FAQ content.
3. Visitor decides whether PandaTrack feels relevant.

### Join the waitlist

1. Visitor clicks a CTA.
2. Visitor submits email and optional context.
3. System validates, submits, and transitions the UI into a success/share state.

### Understand public trust and compliance

1. Visitor switches locale if needed.
2. Visitor checks privacy and terms pages.
3. Shared links render with proper metadata and OG previews.

## Release-Level Success Criteria

- The public landing explains the collector value proposition clearly.
- Waitlist submissions work reliably without exposing secrets or fragile UX.
- Public pages are localized, indexable, and shareable.
- Public interactions and failures are observable through analytics and monitoring.

## Linked FRDs

- `docs/product/prd-01-public-landing/frd-01-pre-release-landing/frd-01-pre-release-landing.md`
- `docs/product/prd-01-public-landing/frd-02-growth-and-observability-foundation/frd-02-growth-and-observability-foundation.md`
- `docs/product/prd-01-public-landing/frd-03-public-web-platform-foundation/frd-03-public-web-platform-foundation.md`
- `docs/product/prd-01-public-landing/frd-04-public-legal-transparency/frd-04-public-legal-transparency.md`

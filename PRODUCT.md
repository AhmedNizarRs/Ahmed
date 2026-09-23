# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Astro, static output. The site is a storefront that sends buyers to existing product links, so it needs no server or database. Astro builds plain HTML with minimal JavaScript (fast on any connection), keeps the product list as data (`src/data/products.ts`) rather than hand-copied markup, and deploys to any static host. Deploy target: not decided.

## Users

Architects, interior designers, and architecture students (largely in the UAE and the wider Arabic-speaking region) who work in Revit, AutoCAD, 3ds Max, and SketchUp. They arrive, usually from Instagram, wanting ready-made resources that save modelling and drafting time, and they need to trust the seller before paying.

## Product Purpose

The website of Rimal Interiors, an interior design studio in Sharjah, UAE, that sells digital architectural tools and posts software tutorials. The site presents each product clearly in Arabic and English and sends visitors to that product's purchase link. Success means a visitor understands what each product contains, trusts the studio, and completes a purchase.

## Positioning

The tools come from a working interior design studio that uses them, not an anonymous file reseller, and the studio teaches the same software openly on Instagram. Bilingual Arabic/English, made for the region.

## Operating Context

- Purchases happen through external product links collected on Linktree (https://linktr.ee/rimalinteriors). The site routes to them; it runs no checkout of its own.
- Most traffic arrives from the Instagram account @rimalinterior, on phones.
- Customers ask questions through Instagram and WhatsApp before buying.

## Capabilities and Constraints

- Primary action: buy a product through its link.
- The site must work fully in Arabic (right-to-left) and English, switchable at any time, with accurate translations.
- Known products (from Instagram): Revit Families Library (26 GB), AutoCAD Blocks, 3ds Max Scripts Toolbox.
- Open decisions:
  - Exact per-product purchase links (Linktree could not be read from the build environment; each product falls back to the Linktree page until its link is filled in).
  - Prices, software versions, file formats, and delivery method per product.
  - WhatsApp number to show on the site.
  - Deploy target and domain.

## Brand Commitments

- Name: Rimal Interiors (رمال للتصميم الداخلي). Instagram handle @rimalinterior.
- Logo: sand-dune mark, serif RIMAL wordmark, geometric knot ornament, INTERIORS in spaced capitals. Colours: sand gold, deep brown, cream. Source file supplied by the owner; cut-outs live in `src/assets/brand/`.

## Evidence on Hand

- Logo (supplied).
- Instagram: 3,577 followers and 22 posts at time of writing; the AutoCAD post shows 137,681 views; the Revit library post shows 58,877 views.
- No testimonials, reviews, customer names, or sales figures. Do not fabricate any of them.

## Product Principles

1. Every page moves a visitor toward a specific product's buy link.
2. Show what is inside each product; claim only what the studio can back up.
3. Arabic and English are equals: neither is a translation afterthought.
4. Minimal steps between interest and checkout, with an easy way to ask first.

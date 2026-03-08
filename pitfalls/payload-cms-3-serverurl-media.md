---
version: 1.0.0
vendor: VendorPayloadCms3
source_template: vendor/payload-cms-3.md
applies: payload@3
tags: [payload, serverURL, media, image-service, CORS]
---

# Payload serverURL breaks media URLs

Pitfall: Adding `serverURL` to Payload config breaks all frontend media URLs — Payload prepends the origin to `media.url` fields, turning relative paths into absolute URLs that the image service doesn't recognize.

## Symptom

403 errors on all frontend images after adding `serverURL` to Payload config.

## Root Cause

Payload prepends `serverURL` (e.g. `https://api.example.com`) to `media.url` fields, turning relative paths like `/api/media/file/image.jpg` into absolute URLs like `https://api.example.com/api/media/file/image.jpg`.

If the frontend image service only recognizes relative Payload paths, absolute URLs fall through to domain validation and get blocked.

## Fix

Update the image URL processing to strip the backend origin (`API_URL` minus `/api` suffix) from absolute URLs before checking for Payload media endpoints. The image service must handle both relative and absolute Payload media URLs.

## Prevention

When configuring `serverURL` in Payload, audit all code that processes `media.url` fields — any path-based checks will break when URLs become absolute.

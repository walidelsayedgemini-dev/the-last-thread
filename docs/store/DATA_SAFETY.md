# Google Play Data safety answers

Complete the Play Console form according to the production endpoint configuration. The intended default build has no crash endpoint configured.

## Default build (no `VITE_CRASH_ENDPOINT`)

- Does the app collect data? **No.**
- Does the app share data with third parties? **No.**
- Is data encrypted in transit? **Not applicable; no data is sent.**
- Can users request deletion? **Not applicable; local saves can be deleted in Settings/profile management.**
- Data stored locally: save profiles, settings, and a small local crash ring buffer. This stays on the device and is not collected.

## If an endpoint is configured and the player opts in

- Data collected: app error message, timestamp, page path, and a bounded stack trace; no save contents, names, contacts, location, photos, or advertising identifiers.
- Purpose: app functionality and diagnostics.
- Collection: optional, triggered by the player's `مشاركة تقارير الأعطال` setting (OFF by default).
- Sharing: sent only to the publisher's configured crash endpoint; not sold and not used for advertising.
- Retention/deletion: define the endpoint's retention period and deletion process in the Play Console before release.
- Security: HTTPS endpoint required in production; the client sends JSON with `keepalive` and never blocks gameplay.

Keep this document synchronized with the endpoint's actual privacy/retention policy before publishing.

# TERPN Production Handoff

## Deployment posture
The static beta should ship with backend flags off by default. Users can complete onboarding, journaling, import/export, diagnostics, and signup-interest flows without any server.

## Required backend endpoints before enabling remote data
- `GET /api/health`
- `GET /api/session`
- `DELETE /api/session`
- `POST /api/auth/magic-link`
- `GET|PUT|DELETE /api/profile`
- `GET|PUT|DELETE /api/journal`
- `GET|PUT|DELETE /api/signups`
- `GET|PUT|DELETE /api/account`

## Backend rollout order
1. Deploy static app with flags disabled.
2. Implement `/api/health` and verify the health panel.
3. Implement `/api/session` and verify the auth panel.
4. Enable remote profile reads/writes for a small test group.
5. Enable remote journal writes with local fallback and sync queue.
6. Only then consider signup/account persistence.

## Data privacy notes
Journal notes, before/after reflections, email addresses, and queued payloads should be treated as private data. Keep export/delete/repair tools available before production account launch.

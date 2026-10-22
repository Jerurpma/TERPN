# TERPN backend handoff

This folder documents the backend contract for the static TERPN app. The app still runs local-first by default. Backend and auth/session behavior only activate when feature flags are enabled.

## Files

- `schema.sql` — PostgreSQL-oriented storage model for users, profiles, journal entries, signup interests, consent records, and content review notes.
- `openapi.yaml` — REST contract expected by the frontend adapters.

## Rollout order

1. Implement `GET /api/health` and verify it from the Backend feature flags panel.
2. Implement `GET /api/session` and `DELETE /api/session` for auth state.
3. Implement `GET|PUT|DELETE /api/profile` while backend writes are still off in the app.
4. Turn on backend reads only and compare remote profile data against local exports.
5. Implement journal/signups/account endpoints, then enable writes one resource at a time.
6. Keep local fallback enabled until export/import, account deletion, and data retention rules are tested.

## Response envelope

The frontend accepts either direct JSON or wrapped JSON:

```json
{ "data": { "name": "Demo User" } }
```

For arrays:

```json
{ "data": [] }
```

`404` is treated as an empty/default value for read paths so the prototype can start with a new account.

## Trust and safety guardrails

- Keep wellness copy educational and avoid medical, treatment, dosage, or outcome claims.
- Require explicit consent before persisting private journal data to a remote backend.
- Support export and deletion before public accounts are enabled.
- Limit admin/reviewer access to aggregated or permissioned content only.

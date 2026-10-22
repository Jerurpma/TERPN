# TERPN Beta QA Checklist

Run this checklist after `npm run check` passes and before sharing the beta link.

## Core local flow
- Open the deployed site with backend flags off by default.
- Complete onboarding and confirm the starter path updates.
- Create a journal entry.
- Edit the journal entry.
- Duplicate the journal entry.
- Export one entry.
- Delete one entry with confirmation.
- Export the full local data file.
- Import the full local data file and confirm merge behavior.

## Trust and safety copy
- Confirm visible language says TERPN is not medical advice.
- Confirm there are No dosing instructions.
- Confirm there is No commerce or purchase workflow.
- Confirm local browser storage is explained before backend flags are enabled.

## Backend-flag flow
- Save feature flags with backend disabled.
- Confirm the app remains local-first.
- Add a test backend URL only in a safe environment.
- Run `/api/health` check.
- Enable auth/session only after `/api/session` exists.
- Confirm failed backend writes queue locally when queueing is enabled.

## Accessibility and device QA
- Tab through primary navigation and pricing tabs.
- Use arrow keys, Home, and End on pricing tabs.
- Test mobile width around 390 px.
- Confirm focus outlines are visible.
- Confirm live regions update journal/signup/status sections.

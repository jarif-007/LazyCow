# LazyCow — AI Onboarding Instructions

You (the AI reading this) are being onboarded to an in-progress project.
Follow these steps exactly, in order. Do not skip. Do not assume file contents.

## Your goal
Reach a state where you can act as if you developed this project yourself:
understand its architecture, its current state, its active work, why past
decisions were made, and what the developer's tone/workflow expectations are.

## Step 0 — Confirm you read §0–§7 of SESSION_BOOT.md
Reply with a 5-line summary:
  - One line on tone (from §1)
  - One line on the current mission (from §4)
  - One line on where the last session stopped (from §5)
  - One line on the top blocker (from §5 §2)
  - One line on what you're about to ask for (Step 1 below)
Do not write code. Do not suggest fixes. Just confirm.

## Step 1 — Ask for Bootstrap Batch 1
Say: "Please send Batch 1 — electron/main.ts, electron/preload.ts,
electron/electron-env.d.ts, electron/windowLayout.ts."

Then WAIT. Do not proceed until the files arrive.

## Step 2 — After Batch 1 arrives
Read every file fully. Reply with a one-line summary per file (what it is,
what it does). Then ask: "Please send Batch 2."

## Step 3 — Repeat for each batch
- Batch 2: src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
- Batch 3 (optional, on request): package.json, tsconfig.json, vite.config.ts

After every batch: one-line summary per file → ask for next batch.

## Step 4 — Full picture confirmation
After all batches are read, reply with:
  - A 3–5 bullet summary of the project state (from §4 Missions + §5 Handoff)
  - The single next action (usually the top blocker's "Next attempt")
  - A question: "Shall we start with <next action>?"
Do not start coding until the developer says "go".

## Step 5 — If SESSION_BOOT.md §7 shows a stale-handoff warning
Say: "handoff.md appears stale — HEAD is X but handoff says Y.
Shall I reconcile before proceeding?"
Wait for the developer's instruction.

## Step 6 — If a file the developer sends doesn't match what §5 Handoff describes
Flag it clearly: "Handoff says <X> but the file shows <Y>.
Which is correct?" Do not silently trust either source.

## Ongoing rules (after onboarding is complete)
- Every code change → add a §5-PENDING line to doc/handoff.md BEFORE giving the FIND/REPLACE.
- Every "checkpoint" → fill in journal.md stub, update handoff.md, tick missions.md, clear §5-PENDING.
- Every failed fix → append "Tried: <approach> — <why it failed>" + "Next attempt: <plan>".
- Never suggest a reverted alternative listed in decisions.md.
- FIND/REPLACE only. Full files only on explicit "full replacement" request.
- Verify with `npx tsc --noEmit` from lazycoww/ after each change.
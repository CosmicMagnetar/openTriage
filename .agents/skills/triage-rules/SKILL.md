---
name: triage-rules
description: Change how OpenTriage classifies issues without AI (labels + keywords), or how it parses an AI triage reply. Use when an issue gets the wrong class, label or confidence.
---

# Triage rules

## Where
`backend-ts/src/lib/coordination/triage.ts`. Pure functions, no I/O.

- `heuristicTriage({ title, body, labels })` → `{ classification, suggestedLabel, confidence, reasons, source: "heuristic" }`.
- `parseAiTriage(text, fallbackTitle)` → strict parser so a malformed model reply is never saved as a verdict.

## Order of rules (first match wins)
1. **Existing labels** (`LABEL_MAP`): any matching label returns that class at confidence 0.95, keeping the label as-is.
2. **Nearly empty body** (< 30 chars) and the title doesn't end in `?` → `NEEDS_INFO`, 0.6.
3. **Keywords** (`KEYWORDS`), in order: critical → bug → feature → docs → question. Questions are judged on the **title only**.
   - Bug or critical with "steps to reproduce / expected / actual" in the body: +0.15 and reason "has reproduction steps".
   - Bug with a body under 200 chars and no repro: reason "but has no reproduction details".
   - Confidence is capped at 0.85.
4. Nothing matched → `NEEDS_INFO` with label `needs-triage`, confidence 0.3.

## When you change a rule
- Add a case to `evals/evals.json` that fails before your change and passes after.
- Run `cd backend-ts && npx jest skills coordination`.
- Keyword order matters: moving a rule up changes every issue that matches both.

## Traps
- `\b` boundaries: `vulnerab\b` does **not** match "vulnerability"; the word "security" is what catches most security issues.
- A body full of "?" must not make an issue a question; that's why questions use the title only.

---
name: ai-byok
description: Change the bring-your-own-key AI features (key storage, providers, the deep repo analysis prompt and parsing). Use when adding a provider, changing the model, or changing what the analysis returns.
---

# AI with the user's own key

## Where
- `backend-ts/src/lib/ai/byok.ts`: AES-256-GCM key encryption (secret: `AI_KEY_SECRET`, else derived from `JWT_SECRET`), `user_ai_keys` table, `validKey` per provider, `DEFAULT_MODEL`.
- `lib/ai/callModel.ts`: one request per provider.
  - **Anthropic** uses the official `@anthropic-ai/sdk` with `claude-opus-5-5`, explicit `output_config.effort: "medium"`, and server-side refusal fallback (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`). It handles `stop_reason` `refusal` and `max_tokens`, and maps typed SDK errors to readable messages.
  - **OpenRouter / OpenAI** use their chat-completions endpoints.
- `lib/ai/repoAnalysis.ts` (pure, tested in `__tests__/lib/ai.test.ts`): `buildPrompt` gives the P7 repo map as facts; `parseAnalysis` keeps only well-formed parts and folders that exist in the real map.
- Routes:
  - `GET/PUT/DELETE /api/me/ai-key` (never returns the key, only `last4`).
  - `POST /api/ai/repo-analysis` (412 `needsKey` when there's no key).
- UI: `aiAnalysis.jsx`. `AiKeySettings` is in Settings `#ai`; `AiRepoAnalysis` is in Repo lens under the map.

## Rules
- **Nothing depends on AI.** Every AI feature has a no-key path that says where to add a key.
- **The key never leaves the server unencrypted** and is used only for that user's requests. Don't log it, and don't put it in cache keys.
- **Cache per repo@commit:** public repos are shared (each version analysed once, by whoever asks first), private repos per user.
- **Read the Claude API skill before changing Anthropic calls.** Model IDs, thinking/effort rules and fallbacks change between models: Opus 5.5 rejects disabled thinking and has default effort `medium`.

## Traps
- The SDK is imported lazily inside `callModel`, so Jest and routes that never call Claude don't load it.
- The old `components/settings/AISettingsPanel.jsx` stored keys in browser localStorage. It's no longer shown in Settings; don't revive it.

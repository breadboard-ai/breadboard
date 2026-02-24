# Déjà Code — Paved Desire Paths

| Pattern                                 | Rule                                     | Utility                            |
| --------------------------------------- | ---------------------------------------- | ---------------------------------- |
| Group items by key into `Map<K, V[]>`   | `deja-code-prefer-group-by`              | `utils/group-by.ts`                |
| Summarize LLM content to preview string | `deja-code-prefer-summarize-llm-content` | `utils/summarize-llm-content.ts`   |
| Inline error unwrap + message extract   | `deja-code-prefer-format-error`          | `utils/formatting/format-error.ts` |
| Inline `URL.canParse` polyfill          | `deja-code-prefer-can-parse`             | Use `URL.canParse()` directly      |

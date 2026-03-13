/**
 * @fileoverview Extracts friendly error messages from raw SSE error chunks.
 *
 * The streaming API (generateWebpageStream, executeAgentNodeStream, etc.)
 * returns errors as normal data chunks with `chunk_type: "error"`. The `text`
 * field contains a raw error dump that includes internal stack traces and
 * debug info. This utility extracts just the user-facing message.
 */

export { parseStreamError };

/**
 * Extracts a user-facing error message from a raw SSE error chunk.
 *
 * The raw text typically looks like:
 * ```
 * 503 UNAVAILABLE. {'error': {'code': 503, 'message': 'Friendly message', ...}}
 * ```
 *
 * Returns the `message` field when possible, otherwise the raw text.
 */
function parseStreamError(rawText: string): string {
  if (!rawText) return "An unknown error occurred.";

  // Try to find and parse the embedded error object.
  const jsonStart = rawText.indexOf("{");
  if (jsonStart === -1) return rawText;

  const jsonPart = rawText.slice(jsonStart);

  // CLEANUP(backend-error-format): The backend currently serializes errors
  // using Python repr(), which produces single-quoted JSON. Convert to valid
  // JSON so we can parse it. Remove this workaround once the backend ships
  // proper JSON serialization or sends the friendly message directly.
  const asJson = singleQuotedJsonToDouble(jsonPart);

  try {
    const parsed = JSON.parse(asJson);
    const message = parsed?.error?.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  } catch {
    // Parsing failed — fall through to raw text.
  }

  return rawText;
}

/**
 * CLEANUP(backend-error-format): Converts Python-repr single-quoted JSON
 * to valid double-quoted JSON. This is a best-effort heuristic — it handles
 * the common case of `{'key': 'value'}` but does not cover every edge case
 * (e.g., apostrophes in values). Remove once the backend sends proper JSON.
 */
function singleQuotedJsonToDouble(text: string): string {
  // Replace single quotes with double quotes, being careful not to break
  // escaped single quotes within values.
  return text.replace(/'/g, '"');
}

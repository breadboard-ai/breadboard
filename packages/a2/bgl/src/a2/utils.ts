/**
 * @fileoverview Common utils for manipulating LLM Content and other relevant types.
 */
export {
  isLLMContent,
  isLLMContentArray,
  toLLMContent,
  toInlineData,
  toLLMContentInline,
  toInlineReference,
  toLLMContentStored,
  toText,
  joinContent,
  contentToJSON,
  defaultLLMContent,
  endsWithRole,
  addUserTurn,
  isEmpty,
  isStoredData,
  llm,
  ok,
  err,
  generateId,
  mergeTextParts,
  toTextConcat,
  extractTextData,
  extractInlineData,
  extractMediaData,
  encodeBase64,
  decodeBase64,
  json,
};

export type ErrorReason =
  | "child"
  | "celebrity"
  | "unsafe"
  | "dangerous"
  | "hate"
  | "other"
  | "face"
  | "pii"
  | "prohibited"
  | "sexual"
  | "toxic"
  | "violence"
  | "vulgar";

export type ErrorMetadata = {
  /**
   * Origin of the error:
   * - client -- occured on the client (the step itself)
   * - server -- comes from the server
   * - system -- happened within the system (client, but outside of the step)
   * - unknown -- origin of the error is unknown.
   */
  origin?: "client" | "server" | "system" | "unknown";
  /**
   * Kind of the error
   * - capacity -- triggered by capacity issues (eg. quota exceeded)
   * - safety -- triggered by a safety checker
   * - recitation -- triggered by recitation checker.
   * - config -- triggered by invalid configuration (can be fixed by user)
   * - bug -- triggered by a bug in code somewhere.
   * - unknown -- (default) unknown kind of error
   */
  kind?: "capacity" | "safety" | "recitation" | "config" | "bug" | "unknown";
  /**
   * If relevant, the name of the model, that produced the error
   */
  model?: string;
  /**
   * When kind is "safety", the reasons for triggering. There may be more than
   * one.
   * - "child" -- detects child content where it isn't allowed due to the API
   * request settings or allowlisting.
   * - "celebrity" -- detects a photorealistic representation of a celebrity in
   *       the request.
   * - "unsafe" -- detects video content that's a safety violation.
   * - "dangerous" -- detects content that's potentially dangerous in nature.
   * - "hate" -- detects hate-related topics or content.
   * - "other" -- detects other miscellaneous safety issues with the request
   * - "face" -- detects a person or face when it isn't allowed due to the
   *      request safety settings.
   * - "pii" -- detects Personally Identifiable Information (PII) in the text,
   *      such as the mentioning a credit card number, home addresses, or other
   *      such information.
   * - "prohibited" -- detects the request of prohibited content in the request.
   * - "sexual" -- detects content that's sexual in nature.
   * - "toxic" -- detects toxic topics or content in the text.
   * - "volence" -- detects violence-related content from the image or text.
   * - "vulgar" -- detects vulgar topics or content from the text.
   */
  reasons?: ErrorReason[];
};

export type ErrorWithMetadata = { $error: string; metadata?: ErrorMetadata };

export type NonPromise<T> = T extends Promise<unknown> ? never : T;

function ok<T>(o: Outcome<NonPromise<T>>): o is NonPromise<T> {
  return !(o && typeof o === "object" && "$error" in o);
}

function err($error: string, metadata?: ErrorMetadata) {
  return { $error, ...(metadata && { metadata }) };
}

function mergeTextParts(
  parts: LLMContent["parts"],
  separator = ""
): LLMContent["parts"] {
  const merged: LLMContent["parts"] = [];
  let text: string = "";
  for (const part of parts) {
    if ("text" in part) {
      text += `${part.text}${separator}`;
    } else {
      if (text) {
        merged.push({ text });
      }
      text = "";
      merged.push(part);
    }
  }
  if (text) {
    merged.push({ text });
  }
  return merged;
}

class LLMTemplate {
  constructor(
    public readonly strings: TemplateStringsArray,
    public readonly values: unknown[]
  ) {}

  asParts(): LLMContent["parts"] {
    return mergeTextParts(
      this.strings.flatMap((s, i) => {
        let text = s;
        const value = this.values.at(i);
        if (value == undefined) {
          return { text };
        } else if (typeof value === "string") {
          text += value;
          return { text };
        } else if (value instanceof LLMTemplate) {
          return value.asParts();
        } else if (isLLMContent(value)) {
          return [{ text }, ...value.parts];
        } else {
          text += JSON.stringify(value);
          return { text };
        }
      })
    );
  }

  asContent(): LLMContent {
    const parts = this.asParts();
    return { parts, role: "user" };
  }
}

function llm(strings: TemplateStringsArray, ...values: unknown[]): LLMTemplate {
  return new LLMTemplate(strings, values);
}

/**
 * Copied from @google-labs/breadboard
 */
function isLLMContent(nodeValue: unknown): nodeValue is LLMContent {
  if (typeof nodeValue !== "object" || !nodeValue) return false;
  if (nodeValue === null || nodeValue === undefined) return false;

  if ("role" in nodeValue && nodeValue.role === "$metadata") {
    return true;
  }

  return "parts" in nodeValue && Array.isArray(nodeValue.parts);
}

function isLLMContentArray(nodeValue: unknown): nodeValue is LLMContent[] {
  if (!Array.isArray(nodeValue)) return false;
  if (nodeValue.length === 0) return true;
  return isLLMContent(nodeValue.at(-1));
}

function toLLMContent(
  text: string,
  role: LLMContent["role"] = "user"
): LLMContent {
  return { parts: [{ text }], role };
}

function endsWithRole(c: LLMContent[], role: "user" | "model"): boolean {
  const last = c.at(-1);
  if (!last) return false;
  return last.role === role;
}

function isEmpty(c: LLMContent): boolean {
  if (!c.parts.length) return true;
  for (const part of c.parts) {
    if ("text" in part) {
      if (part.text.trim().length > 0) return false;
    } else {
      return false;
    }
  }
  return true;
}

function isStoredData(c: LLMContent) {
  const part = c.parts.at(-1);
  if (!part) {
    return false;
  }
  return "storedData" in part && part.storedData != null;
}

function toText(c: LLMContent | LLMContent[]): string {
  if (isLLMContent(c)) {
    return contentToText(c);
  }
  const last = c.at(-1);
  if (!last) return "";
  return contentToText(last).trim();

  function contentToText(content: LLMContent) {
    return content.parts
      .map((part) => ("text" in part ? part.text : ""))
      .join("\n\n");
  }
}

function contentToJSON<T>(content?: LLMContent): T {
  const part = content?.parts?.at(0);
  if (!part || !("text" in part)) {
    throw new Error("Invalid response from Gemini");
  }
  return JSON.parse(part.text) as T;
}

function defaultLLMContent(): string {
  return JSON.stringify({
    parts: [{ text: "" }],
    role: "user",
  } satisfies LLMContent);
}

function joinContent(
  content: string | LLMContent,
  context?: LLMContent[],
  dropHistory: boolean = false
): LLMContent[] {
  if (dropHistory && context) {
    const last = context.at(-1);
    let retainedContext;
    if (last) {
      retainedContext = [last];
    }
    return addUserTurn(content, retainedContext);
  }
  return addUserTurn(content, context);
}

function extractInlineData(context: LLMContent[]): LLMContent[] {
  const results = [];
  for (const el of context) {
    for (const part of el.parts) {
      if (part) {
        if ("inlineData" in part && part.inlineData) {
          results.push(
            toLLMContentInline(part.inlineData.mimeType, part.inlineData.data)
          );
        }
      }
    }
  }
  return results;
}

function extractMediaData(context: LLMContent[]): LLMContent[] {
  const results = [];
  for (const el of context) {
    for (const part of el.parts) {
      if (part) {
        if ("inlineData" in part && part.inlineData) {
          results.push(
            toLLMContentInline(part.inlineData.mimeType, part.inlineData.data)
          );
        }
        if ("storedData" in part && part.storedData) {
          results.push(
            toLLMContentStored(part.storedData.mimeType, part.storedData.handle)
          );
        }
      }
    }
  }
  return results;
}

function extractTextData(context: LLMContent[]): LLMContent[] {
  const results = [];
  for (const el of context) {
    for (const part of el.parts) {
      if (part) {
        if ("text" in part && part.text) {
          results.push(toLLMContent(part.text));
        }
      }
    }
  }
  return results;
}

function toTextConcat(content: LLMContent[]): string {
  return content.map(toText).join("\n\n");
}

function addUserTurn(content: string | LLMContent, context?: LLMContent[]) {
  context ??= [];
  const isString = typeof content === "string";
  if (!endsWithRole(context, "user")) {
    return [...context, isString ? toLLMContent(content) : content];
  }
  const last = context.at(-1)!;
  if (isString) {
    last.parts.push({ text: content });
  } else {
    last.parts.push(...content.parts);
  }
  return context;
}

function toLLMContentInline(
  mimetype: string,
  value: string,
  role: LLMContent["role"] = "user"
): LLMContent {
  return {
    parts: [
      {
        inlineData: {
          mimeType: mimetype,
          data: value,
        },
      },
    ],
    role,
  };
}

function toLLMContentStored(
  mimetype: string,
  handle: string,
  role: LLMContent["role"] = "user"
) {
  return {
    parts: [
      {
        storedData: {
          mimeType: mimetype,
          handle: handle,
        },
      },
    ],
    role,
  };
}

function toInlineData(c: LLMContent | LLMContent[]) {
  if (isLLMContent(c)) {
    return contentToInlineData(c);
  }
  const last = c.at(-1);
  if (!last) return null;
  return contentToInlineData(last);

  function contentToInlineData(content: LLMContent) {
    const part = content.parts.at(-1);
    if (!part) return "";
    return "inlineData" in part && part.inlineData ? part.inlineData : null;
  }
}

function toInlineReference(c: LLMContent) {
  const last = c.parts.at(-1);
  if (last == undefined || !("storedData" in last)) {
    return toInlineData(c);
  }
  return toInlineData(
    toLLMContentInline(
      "storedData/" + last.storedData.mimeType,
      last.storedData.handle
    )
  );
}

export function mergeContent(content: LLMContent[], role: string): LLMContent {
  const parts: DataPart[] = [];
  for (const el of content) {
    for (const part of el.parts) {
      parts.push(part);
    }
  }
  return {
    parts: parts,
    role: role,
  } satisfies LLMContent;
}

function generateId() {
  return Math.random().toString(36).substring(2, 5);
}

function encodeBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function decodeBase64(s: string): string {
  const latin1 = atob(s);
  try {
    return decodeURIComponent(
      latin1
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
  } catch (error) {
    console.error("Error decoding Base64 UTF-8 string:", error);
    return latin1;
  }
}

function json<T = JsonSerializable>(
  data: LLMContent[] | undefined
): T | undefined {
  return (data?.at(0)?.parts?.at(0) as JSONPart)?.json as T;
}

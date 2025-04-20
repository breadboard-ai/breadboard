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
};

export type NonPromise<T> = T extends Promise<unknown> ? never : T;

function ok<T>(o: Outcome<NonPromise<T>>): o is NonPromise<T> {
  return !(o && typeof o === "object" && "$error" in o);
}

function err($error: string) {
  return { $error };
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
    let last = context.at(-1);
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
  for (let el of context) {
    for (let part of el.parts) {
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
  for (let el of context) {
    for (let part of el.parts) {
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
  for (let el of context) {
    for (let part of el.parts) {
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

// TODO(askerryryan): Move this to the middleware.
function toInlineReference(c: LLMContent) {
  const last = c.parts.at(-1);
  if (last == undefined || !("storedData" in last)) {
    return toInlineData(c);
  }
  const blobId = last.storedData.handle.split("/").slice(-1)[0];
  const gcs_handle = "bb-blob-store/" + blobId;
  return toInlineData(toLLMContentInline("text/gcs-path", btoa(gcs_handle)));
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

import { marked } from "./marked";
import { unescape } from "./unescape";
import type {
  Token,
  FormattingToken,
  SpaceToken,
  RichToken,
  ListToken,
} from "./types";
import { toText, mergeTextParts } from "./a2/utils";
import transformBlob from "@blob";

export { contextToRequests, markdownToContext, DOC_MIME_TYPE };

const DOC_MIME_TYPE = "application/vnd.google-apps.document";

export type DocsInsertInlineImageRequest = {
  insertInlineImage: {
    uri: string;
    location: {
      segmentId?: string;
      index: number;
      tabId?: string;
    };
  };
};

// async function transformBlob(args: {
//   contents: LLMContent[];
//   transform: string;
// }): Promise<{ contents: LLMContent[] }> {
//   return args;
// }

/**
 * Removes surrounding backticks from each line if each
 * line is surrounded by backticks.
 * This is a bug in Google Drive markdown conversion.
 * Here's hoping it won't do too much damage.
 */
function sanitizeBackticks(s: string): string {
  return s
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return line;
      if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
        return trimmed.slice(1, -1);
      }
      return line;
    })
    .join("\n");
}

const BASE64_DATA_URL_REGEX = /^data:(.+?);base64,(.+)$/;

function parseBase64DataUrl(url: string): InlineDataCapabilityPart | null {
  const matchResult = url.match(BASE64_DATA_URL_REGEX);
  if (!matchResult || matchResult.length !== 3) {
    return null;
  }
  const [, mimeType, data] = matchResult;
  return { inlineData: { mimeType, data } };
}

function markdownToContext(markdown: string): LLMContent[] {
  const tokens = marked.lexer(sanitizeBackticks(markdown)) as Token[];
  const parts: DataPart[] = mergeTextParts(
    tokens.flatMap((token) => {
      if (token.type === "paragraph") {
        return token.tokens.map((token) => {
          if (token.type === "image") {
            const inlineData = parseBase64DataUrl(token.href);
            if (inlineData) return inlineData;
          }
          return { text: token.raw };
        });
      }
      return { text: token.raw };
    })
  );
  return [{ parts }];
}

async function contextToRequests(
  context: LLMContent[] | undefined,
  startIndex: number
): Promise<unknown[]> {
  const parts = context?.at(-1)?.parts;
  if (!parts) return [];

  const result: unknown[] = [];
  let index = startIndex;
  for (const part of parts) {
    if ("text" in part) {
      const tokens = marked.lexer(toText(context));
      const { lastIndex, requests } = tokensToRequests(tokens, index);
      result.push(...requests);
      index = lastIndex;
    } else if ("inlineData" in part) {
      const contents = await transformBlob({
        contents: [{ parts: [part] }],
        transform: "persistent-temporary",
      });
      const storedPart = contents?.contents
        ?.at(0)
        ?.parts?.at(0) as StoredDataCapabilityPart;
      if (storedPart) {
        result.push({
          insertInlineImage: {
            uri: storedPart.storedData.handle,
            location: {
              index,
            },
          },
        } satisfies DocsInsertInlineImageRequest);
      }
    }
  }
  return result;
}

type TokensToRequestsResult = { lastIndex: number; requests: unknown[] };

/**
 * Converts markdown tokens to Google Doc Request array for the
 * `batchUpdate` call.
 */
function tokensToRequests(
  tokens: Token[],
  startIndex: number
): TokensToRequestsResult {
  let current = startIndex;
  const requests = tokens.flatMap((token) => {
    switch (token.type) {
      case "paragraph":
        return insertFormattedText(token, "NORMAL_TEXT");
      case "space":
        return insertSpace(token);
      case "code":
        return insertFormattedText(token, "NORMAL_TEXT");
      case "heading":
        return insertFormattedText(token, `HEADING_${token.depth}`);
      case "blockquote":
        return insertFormattedText(token, "NORMAL_TEXT");
      case "list":
        return insertList(token.items, token.ordered, 0);
    }
    return [];
  });
  return { lastIndex: current, requests };

  function insertFormattedText(token: Token, namedStyleType: string) {
    const { requests, text: withoutBreak } = new TextStyles(
      current,
      token as FormattingToken
    ).parse();
    const text = `${withoutBreak}\n`;
    if (namedStyleType) {
      requests.unshift({
        updateParagraphStyle: {
          range: range(text.length),
          paragraphStyle: { namedStyleType },
          fields: "namedStyleType",
        },
      });
    }
    requests.unshift({ insertText: { text, location: location() } });
    current += text.length;
    return requests;
  }

  function insertSpace(token: SpaceToken) {
    const text = token.raw.startsWith("\n") ? token.raw.slice(1) : token.raw;
    const result = [
      {
        insertText: { text, location: location() },
      },
    ];
    return advance(result, text.length);
  }

  function range(length: number) {
    return { startIndex: current, endIndex: current + length };
  }

  function location() {
    return { index: current };
  }

  function insertList(items: Token[], ordered: boolean, depth: number) {
    const start = current;
    // This is necessary to counteract a gnarly side-effect of creating a
    // bullet list: the indent markers are being removed during that change,
    // and change all of the ranges. So we have to make sure that the next
    // request accounts for that.
    let depthToRemove = 0;
    const list = descendIntoList(items, ordered, depth).flat();
    list.push({
      createParagraphBullets: {
        range: { startIndex: start, endIndex: current },
        bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
      },
    });
    current -= depthToRemove;
    return list;

    function descendIntoList(items: Token[], ordered: boolean, depth: number) {
      const list: unknown[] = items.flatMap((item) => {
        // For item, item.type === "list_item".
        const indent = "\t".repeat(depth);
        depthToRemove += depth;
        const result = [];
        const maybeRichToken: RichToken | undefined =
          "tokens" in item ? item : undefined;
        const subList = maybeRichToken?.tokens.find(
          (token) => token?.type === "list"
        );
        if (subList) {
          // assume that the first token is actually the text token.
          result.push(insertItemText(indent, maybeRichToken?.tokens.at(0)));
          result.push(...descendIntoList(subList.items, ordered, depth + 1));
        } else {
          result.push(insertItemText(indent, maybeRichToken?.tokens.at(0)));
        }
        return result;
      });
      return list;
    }

    function insertItemText(
      indent: string,
      token: ListToken | FormattingToken | undefined
    ) {
      const offset = current + indent.length;
      const { requests, text: withoutIndent } = new TextStyles(
        offset,
        token
      ).parse();
      const text = `${indent}${withoutIndent}\n`;
      requests.unshift({
        updateParagraphStyle: {
          range: range(text.length),
          paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
          fields: "namedStyleType",
        },
      });
      requests.unshift({ insertText: { text, location: location() } });
      current += text.length;
      return requests;
    }
  }

  function advance(result: unknown, length: number) {
    current += length;
    return result;
  }
}

class TextStyles {
  #offset;
  #tokens: FormattingToken[] = [];
  #styles: unknown[] = [];

  constructor(offset: number, token: FormattingToken | ListToken | undefined) {
    this.#offset = offset;
    if (token && "tokens" in token) {
      this.#tokens = token.tokens;
    }
  }

  range(startIndex: number, length: number) {
    return { startIndex, endIndex: startIndex + length };
  }

  style(
    startIndex: number,
    length: number,
    textStyle: Record<string, unknown>
  ) {
    this.#styles.push({
      updateTextStyle: {
        range: this.range(startIndex, length),
        textStyle,
        fields: Object.keys(textStyle).join(","),
      },
    });
  }

  parse() {
    let current = this.#offset;
    let text = "";
    for (let token of this.#tokens) {
      let tokenText = unescape("text" in token ? token.text : "");
      const length = tokenText.length;
      text += tokenText;
      switch (token.type) {
        case "strong":
          this.style(current, length, { bold: true });
          break;
        case "em":
          this.style(current, length, { italic: true });
          break;
        case "codespan":
          this.style(current, length, {
            weightedFontFamily: {
              fontFamily: "Fira Code",
            },
          });
          break;
        case "del":
          this.style(current, length, { strikethrough: true });
          break;
        case "link":
          this.style(current, length, { link: { url: token.href } });
          break;
        case "escape":
          console.log("ESCAPE", token);
          break;
      }
      current += length;
    }
    return {
      requests: this.#styles,
      text,
    };
  }
}

/**
 * @fileoverview Handles lists according to https://github.com/breadboard-ai/breadboard/wiki/Step-Listification
 */
import {
  ok,
  err,
  generateId,
  mergeTextParts,
  toLLMContent,
  llm,
} from "./utils";
import { type GeminiSchema } from "./gemini";

export {
  fanOutContext,
  flattenContext,
  hasLists,
  addContent,
  toList,
  listPrompt,
  listSchema,
  ListExpander,
};

type ContentTransformer = (
  instruction: LLMContent,
  context: LLMContent[],
  isList: boolean
) => Promise<Outcome<LLMContent>>;

type UnzippedResult = {
  contents: LLMContent[];
  id: string;
};

function isListPart(o: DataPart | undefined): o is ListPart {
  return !!o && "list" in o;
}

function emptyContent(): LLMContent {
  return { parts: [{ text: "" }] };
}

function addContent(context: LLMContent[], content: LLMContent): LLMContent[] {
  const last = context.at(-1);
  const maybeList = last?.parts?.at(0);
  const remainder = context.slice(0, -1);
  if (isListPart(maybeList)) {
    const list = maybeList.list.map((item) => ({
      ...item,
      content: [...item.content, content],
    }));
    return [...remainder, { ...last, parts: [{ ...maybeList, list }] }];
  }
  return [...context, content];
}

function unzipContent(content: LLMContent): UnzippedResult {
  // 1) Scan content for lists.
  const info: Set<number> = new Set();
  const ids: Set<string> = new Set();
  let maxLength = 0;
  content.parts.forEach((part, index) => {
    if (!isListPart(part)) return;
    const length = part.list.length;
    if (length > maxLength) maxLength = length;
    info.add(index);
    ids.add(part.id);
  });
  if (ids.size > 1) {
    console.warn(
      "Multiple list sources aren't yet supported in instruction, using the first one"
    );
  }
  const id = [...ids].at(0) || "";
  if (info.size === 0) {
    return { contents: [content], id };
  }
  // 2) Create a list and replace lists with list entries.
  return {
    id,
    contents: new Array(maxLength).fill(0).map((_, entryIndex) => {
      const parts = mergeTextParts(
        content.parts.flatMap((part, partIndex) => {
          if (!info.has(partIndex)) return part;

          // We know this exists, so we're ok with not checking
          // for existence.
          const item = (part as ListPart).list.at(entryIndex);
          if (!item) {
            return [];
          }
          const last = item.content.at(-1);
          return last ? last.parts : [];
        })
      );
      return { ...content, parts };
    }),
  };
}

function hasLists(context: LLMContent[]): boolean {
  return isListPart(context.at(-1)?.parts?.at(0));
}

/**
 * All expander list items have the same shape:
 * - the prolog is the "pre-list" part of the context
 * - the context is the current context that was expanded
 * - the instruction is the current instruction is associated
 *   with the current context.
 */
type ExpanderListItem = {
  prolog: LLMContent[];
  instruction: LLMContent;
  context: LLMContent[];
};

// TODO: When back to implementing nested lists, this approach
// is wrong. Instead of expanding items and then converging them,
// we need to iterate over existing structure. Because then, when
// it's time to converge, we don't need to try to reconstruct
// the original structure.
// Also, it is unclear what we should do with nested lists
// in instruction. It feels like a similar story, and now
// we need to support multiple lists and hierarchies in
// instruction.
class ListExpander {
  // Local prolog -- the parts of context that were preceding the list.
  #prolog: LLMContent[] = [];
  #list: ExpanderListItem[] = [];
  #originalListItems: LLMContent[][] = [];
  #id: string = "";
  #instructions?: UnzippedResult;
  #expanded = false;

  constructor(
    private readonly instruction: LLMContent,
    private readonly context: LLMContent[],
    private readonly prolog: LLMContent[] = []
  ) {}

  expand(): void {
    if (this.#expanded) return;
    const instructions = unzipContent(this.instruction);
    let list: ExpanderListItem[] = [];
    let id: string;
    const maybeList = this.context.at(-1)?.parts?.at(0);
    const localProlog = this.context.slice(0, -1);
    const originalListItems: LLMContent[][] = [];
    if (isListPart(maybeList)) {
      id = maybeList.id;
      // console.log("LIST PART FOUND", id);
      for (const [index, item] of maybeList.list.entries()) {
        const innerContext = item.content;
        const innerInstruction =
          instructions.contents.at(index) ||
          instructions.contents.at(0) ||
          emptyContent();
        const innerExpander = new ListExpander(innerInstruction, innerContext, [
          ...this.prolog,
          ...localProlog,
        ]);
        innerExpander.expand();

        // console.log("INDEX", index);
        // console.log("ITEM", JSON.stringify(item.content));
        // console.log("INNER EXPANDER", innerExpander.list());
        originalListItems.push(innerContext);
        list.push(...innerExpander.list());
      }
      // console.log("END LIST PART FOUND", id);
    } else {
      id = instructions.id;
      list = instructions.contents.map((instruction) => {
        return {
          prolog: [...this.prolog, ...this.context],
          instruction,
          context: [],
        };
      });
    }
    this.#prolog = localProlog;
    this.#list = list;
    this.#id = id;
    this.#originalListItems = originalListItems;
    this.#expanded = true;
  }

  list() {
    return this.#list;
  }

  async map(transformer: ContentTransformer): Promise<Outcome<LLMContent[]>> {
    this.expand();
    const isList = this.#list.length > 1;
    const results = await Promise.all(
      this.#list.map(async (item, index) => {
        return transformer(
          item.instruction,
          [...item.prolog, ...item.context],
          isList
        );
      })
    );
    const errors: { $error: string }[] = [];
    const successes: LLMContent[] = [];
    results.forEach((result) => {
      if (!ok(result)) {
        errors.push(result);
      } else {
        successes.push(result);
      }
    });
    if (errors.length > 0) {
      return err(errors.map((error) => error.$error).join("\n"));
    }
    return this.#toContext(successes);
  }

  #toContext(results: LLMContent[]): LLMContent[] {
    if (results.length > 1) {
      const newListItem = {
        parts: [
          {
            id: this.#id,
            list: (results as LLMContent[]).map((item, i) => ({
              content: [...(this.#originalListItems[i] || []), item],
            })),
          },
        ],
      };
      return [...this.#prolog, newListItem];
    }
    const newContextItem = results.at(-1)! as LLMContent;
    return [...this.context, newContextItem];
  }
}

async function fanOutContext(
  instruction: LLMContent,
  context: LLMContent[] | undefined,
  transformer: ContentTransformer,
  path?: number[]
): Promise<Outcome<LLMContent[]>> {
  context ??= [];
  const expander = new ListExpander(instruction, context);
  return expander.map(transformer);
}

function flattenContext(
  context: LLMContent[] | undefined,
  all = false,
  separator = ""
): LLMContent[] {
  context ??= []; // Look at the first part of the last context and see if it's a list.
  const last = context.at(-1);
  if (!last) return context;
  if (all) {
    return context
      .map((content) => flattenContent(content, all, separator))
      .flat();
  }
  const remainder = context.slice(0, -1);
  return [...remainder, ...flattenContent(last, all, separator)];
}

function zipContexts(
  contexts: LLMContent[][],
  separator: string = ""
): LLMContent[] {
  let maxLength = 0;
  contexts.forEach((context) => {
    if (maxLength < context.length) maxLength = context.length;
  });
  const result: LLMContent[] = [];
  for (let i = 0; i < maxLength; i++) {
    let role: string | undefined;
    let zippedParts = [];
    for (const context of contexts) {
      const item = context.at(i);
      if (!item) continue;
      if (!role) role = item.role;
      zippedParts.push(item.parts);
      // Add separator if previous element was text.
      const lastItem = item.parts.slice(-1)[0];
      if (separator.length > 0 && lastItem && "text" in lastItem) {
        zippedParts.push({ text: separator });
      }
    }
    const parts = mergeTextParts(zippedParts.flat());
    role ??= "user";
    result.push({
      parts,
      role,
    });
  }
  return result;
}

function flattenContent(
  content: LLMContent,
  all = false,
  separatator = ""
): LLMContent[] {
  let hadList = false;
  const flattened = content.parts
    .map((part) => {
      if (isListPart(part)) {
        hadList = true;
        return zipContexts(
          part.list.map((item) => item.content),
          separatator
        );
      }
      return {
        parts: [part],
        role: content.role,
      } as LLMContent;
    })
    .flat();
  if (!hadList) return [content];
  return flattened;
}

type ListResponse = {
  list: string[];
};

function toList(content: LLMContent): Outcome<LLMContent> {
  const jsonPart = content.parts.at(0);
  if (!jsonPart || !("json" in jsonPart)) {
    // TODO: Error recovery
    return err(`Gemini generated invalid list`);
  }
  const response = jsonPart.json as ListResponse;
  return {
    parts: [
      {
        id: generateId(),
        list: response.list.map((item) => {
          return { content: [toLLMContent(item, "model")] };
        }),
      },
    ],
  };
}

function listSchema(): GeminiSchema {
  return {
    type: "object",
    properties: {
      list: {
        type: "array",
        description: "The list of results",
        items: {
          type: "string",
          description: "Result list item as markdown text",
        },
      },
    },
    required: ["list"],
  };
}

function listPrompt(content: LLMContent): LLMContent {
  return llm`
  ${content}

  Output as a list of items, each item must be markdown text.
`.asContent();
}

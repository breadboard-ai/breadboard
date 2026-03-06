/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AST-based code parsing for extracting structured information from
 * model-generated component code. Uses acorn + acorn-jsx to properly
 * parse JSX syntax and extract functions, constants, and comments.
 *
 * Handles the model's "progressive building" pattern: the model often
 * generates code in sections where each section repeats all prior
 * functions, imports, and constants. The parser deduplicates at the AST
 * level — imports by source, functions by name (keeping the last
 * definition), and shared code by content.
 */

import * as acorn from "acorn";
import jsx from "acorn-jsx";

export {
  parseGeneration,
  extractCodeBlock,
  extractProps,
  type ParsedGeneration,
  type PropDef,
};

/**
 * The result of parsing a model generation into its constituent parts.
 */
interface ParsedGeneration {
  /** Individual component functions, in order of appearance. */
  components: ParsedComponent[];
  /** Top-level shared code (constants, styles, etc.) not inside any function. */
  shared: string;
}

interface ParsedComponent {
  /** The function name, e.g. "Badge" or "PricingTable". */
  name: string;
  /** Just this function's source code (including any preceding JSDoc). */
  code: string;
  /** True if this is the last (main/parent) function in the generation. */
  isMain: boolean;
}

interface AcornComment {
  type: "Line" | "Block";
  value: string;
  start: number;
  end: number;
}

// Create a JSX-aware parser.
const jsxParser = acorn.Parser.extend(jsx());

/**
 * Parse a code block into its constituent components and shared code.
 *
 * Uses acorn to walk the top-level AST nodes and categorize each as:
 * - ImportDeclaration → deduplicated by source module
 * - FunctionDeclaration → a component (deduplicated by name, last wins)
 * - ExportDefaultDeclaration wrapping a FunctionDeclaration → a component
 * - VariableDeclaration/ExpressionStatement/etc. → shared code
 *
 * Any block comment immediately preceding a function is included in
 * that function's code slice, resolved via acorn's comment tracking.
 */
function parseGeneration(code: string): ParsedGeneration {
  const comments: AcornComment[] = [];
  // Imports collected separately (script mode can't parse import declarations).
  const collectedImports: string[] = [];

  let ast: acorn.Program;
  try {
    // Try module mode first — handles clean code with imports.
    ast = jsxParser.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      onComment: comments,
    });
  } catch {
    // Module mode fails on duplicate declarations (the model's progressive
    // pattern). Fall back to script mode: strip imports first (script mode
    // doesn't support them), then parse the rest.
    comments.length = 0;
    const stripped = stripModuleSyntax(code, collectedImports);
    try {
      ast = jsxParser.parse(stripped, {
        ecmaVersion: "latest",
        sourceType: "script",
        onComment: comments,
      });
    } catch {
      // Totally unparseable — treat as a single component.
      return {
        components: [{ name: "Component", code, isMain: true }],
        shared: "",
      };
    }
  }

  // The source string that AST positions refer to. When we fell back to
  // script mode, this is the import-stripped version of the original code.
  const source =
    collectedImports.length > 0 ? stripModuleSyntax(code, []) : code;

  // Deduplicate by AST node identity:
  // - Functions → Map by name (last wins, since progressive builds repeat)
  // - Imports → Map by source module (from AST in module mode)
  // - Shared code → Set by text content
  const componentMap = new Map<string, ParsedComponent>();
  const importMap = new Map<string, string>();
  const sharedSlices: string[] = [];
  const seenShared = new Set<string>();

  for (const node of ast.body) {
    const fnInfo = extractFunctionInfo(node);

    if (fnInfo) {
      // Include any preceding JSDoc comment, resolved via AST positions.
      const fnCode = extractWithLeadingComment(source, node, comments);
      componentMap.set(fnInfo.name, {
        name: fnInfo.name,
        code: fnCode,
        isMain: false,
      });
    } else if (node.type === "ImportDeclaration") {
      // Deduplicate imports by source module (first wins).
      const imp = node as acorn.ImportDeclaration;
      const src = (imp.source as acorn.Literal).value as string;
      if (!importMap.has(src)) {
        importMap.set(src, source.slice(node.start, node.end));
      }
    } else if (isExportStatement(node)) {
      // Skip bare export statements (e.g. `export default PricingTable;`)
      // — these are just wiring, not meaningful code.
    } else {
      // Everything else is shared code (constants, style objects, etc.).
      // Deduplicate by content to handle the model's repetition.
      const slice = source.slice(node.start, node.end);
      if (!seenShared.has(slice)) {
        seenShared.add(slice);
        sharedSlices.push(slice);
      }
    }
  }

  const components = [...componentMap.values()];

  // The last component is the main (parent) component.
  if (components.length > 0) {
    components[components.length - 1].isMain = true;
  }

  // Imports are stripped from shared output. The iframe always injects a
  // comprehensive React import before sending to esbuild, so parser-level
  // imports are redundant. The model sometimes omits imports entirely
  // (using hooks as bare globals), so the iframe can't rely on them.
  const allShared = sharedSlices.join("\n\n");

  return {
    components,
    shared: allShared,
  };
}

/** Extract a fenced code block from markdown text. */
function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:jsx|tsx|javascript|js)?\s*\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

// ─── Prop Extraction ────────────────────────────────────────────────────────

/**
 * A parsed prop definition extracted from JSDoc `@prop` annotations.
 */
interface PropDef {
  /** Prop name, e.g. "title". */
  name: string;
  /** Type string, e.g. "string", "number", "boolean". */
  type: string;
  /** Human-readable description. */
  description: string;
  /** Raw default value string from the annotation. */
  defaultValue: string | null;
  /** True if the prop name was wrapped in brackets, e.g. `[badge]`. */
  optional: boolean;
}

/**
 * Extract `@prop` annotations from a code string's JSDoc comments.
 *
 * Matches lines like:
 *   `@prop {string} title - The card heading (default: "Sample Card")`
 *   `@prop {boolean} [showBadge] - Optional badge (default: false)`
 *   `@prop {number} count - Item count`
 */
function extractProps(code: string): PropDef[] {
  const props: PropDef[] = [];
  // Match @prop {type} name - description, with optional (default: value)
  // Accounts for JSDoc line prefix (* ) and trailing */
  const re =
    /@prop\s+\{(\w+)\}\s+(\[?\w+\]?)\s*-\s*(.*?)(?:\(default:\s*(.+?)\))?\s*(?:\*\/|\*)?$/gm;

  for (const match of code.matchAll(re)) {
    const [, type, rawName, rawDesc, rawDefault] = match;
    const optional = rawName.startsWith("[") && rawName.endsWith("]");
    const name = optional ? rawName.slice(1, -1) : rawName;

    props.push({
      name,
      type: type.toLowerCase(),
      description: rawDesc.trim(),
      defaultValue: rawDefault?.trim() ?? null,
      optional,
    });
  }

  return props;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface FunctionInfo {
  name: string;
}

/**
 * Check if a node is a function declaration (or an export wrapping one)
 * and return its name.
 */
function extractFunctionInfo(node: acorn.AnyNode): FunctionInfo | null {
  // `function Foo() { ... }`
  if (node.type === "FunctionDeclaration") {
    const fn = node as acorn.FunctionDeclaration;
    if (fn.id?.name) return { name: fn.id.name };
  }

  // `export default function Foo() { ... }`
  // `export function Foo() { ... }`
  if (node.type === "ExportDefaultDeclaration") {
    const exp = node as acorn.ExportDefaultDeclaration;
    if (
      exp.declaration.type === "FunctionDeclaration" &&
      (exp.declaration as acorn.FunctionDeclaration).id?.name
    ) {
      return {
        name: (exp.declaration as acorn.FunctionDeclaration).id!.name,
      };
    }
  }

  if (node.type === "ExportNamedDeclaration") {
    const exp = node as acorn.ExportNamedDeclaration;
    if (
      exp.declaration?.type === "FunctionDeclaration" &&
      (exp.declaration as acorn.FunctionDeclaration).id?.name
    ) {
      return {
        name: (exp.declaration as acorn.FunctionDeclaration).id!.name,
      };
    }
  }

  return null;
}

/**
 * Check if a node is a bare export statement (not wrapping a declaration).
 * e.g. `export default PricingTable;` or `export { Foo };`
 */
function isExportStatement(node: acorn.AnyNode): boolean {
  if (node.type === "ExportDefaultDeclaration") {
    const exp = node as acorn.ExportDefaultDeclaration;
    return exp.declaration.type !== "FunctionDeclaration";
  }
  if (node.type === "ExportNamedDeclaration") {
    const exp = node as acorn.ExportNamedDeclaration;
    return !exp.declaration;
  }
  return false;
}

/**
 * Extract a node's source code, including any block comment that
 * immediately precedes it.
 *
 * Uses the comments array captured by acorn's `onComment` callback
 * to find the nearest preceding block comment whose end (plus any
 * whitespace) lines up with the node's start position.
 */
function extractWithLeadingComment(
  code: string,
  node: acorn.AnyNode,
  comments: AcornComment[]
): string {
  let start = node.start;

  // Find the nearest preceding block comment.
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];
    // Must be a block comment (/* ... */) that ends before this node.
    if (comment.type !== "Block" || comment.end > node.start) continue;

    // Check that only whitespace separates the comment from the node.
    const gap = code.slice(comment.end, node.start);
    if (gap.trim() === "") {
      start = comment.start;
    }
    // Stop after checking the nearest preceding block comment.
    break;
  }

  return code.slice(start, node.end).trim();
}

/**
 * Strip module syntax (import/export) from source code for script mode parsing.
 *
 * - `import` lines are removed and unique imports are collected in `out`.
 * - `export default function Foo()` → `function Foo()`
 * - `export function Foo()` → `function Foo()`
 * - `export default Foo;` and `export { Foo }` → removed entirely
 */
function stripModuleSyntax(code: string, out: string[]): string {
  const seenImports = new Set<string>();
  return code
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      // Strip import declarations, collecting unique ones.
      if (trimmed.startsWith("import ")) {
        if (!seenImports.has(trimmed)) {
          seenImports.add(trimmed);
          out.push(trimmed);
        }
        return "";
      }

      // Strip `export default` or `export` prefix from declarations.
      if (trimmed.startsWith("export default function ")) {
        return line.replace("export default function ", "function ");
      }
      if (trimmed.startsWith("export function ")) {
        return line.replace("export function ", "function ");
      }

      // Remove bare export statements entirely.
      if (
        trimmed.startsWith("export default ") ||
        trimmed.startsWith("export {")
      ) {
        return "";
      }

      return line;
    })
    .join("\n");
}

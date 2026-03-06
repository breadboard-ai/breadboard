/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseGeneration,
  extractCodeBlock,
  extractProps,
} from "../src/core/parser.ts";

// ─── extractCodeBlock ───────────────────────────────────────────────────────

describe("extractCodeBlock", () => {
  it("extracts a fenced JSX code block", () => {
    const md = "```jsx\nfunction Foo() { return <div />; }\n```";
    assert.equal(extractCodeBlock(md), "function Foo() { return <div />; }");
  });

  it("returns null when no code block is found", () => {
    assert.equal(extractCodeBlock("no code here"), null);
  });
});

// ─── parseGeneration ────────────────────────────────────────────────────────

describe("parseGeneration", () => {
  it("parses a single component", () => {
    const code = `function Card() { return <div>Card</div>; }`;
    const result = parseGeneration(code);

    assert.equal(result.components.length, 1);
    assert.equal(result.components[0].name, "Card");
    assert.equal(result.components[0].isMain, true);
    assert.equal(result.shared, "");
  });

  it("separates shared code from components", () => {
    const code = [
      `const COLORS = { red: "#f00" };`,
      `function Badge() { return <span style={{color: COLORS.red}}>Hi</span>; }`,
    ].join("\n\n");

    const result = parseGeneration(code);

    assert.equal(result.components.length, 1);
    assert.equal(result.components[0].name, "Badge");
    assert.ok(result.shared.includes("COLORS"));
  });

  it("marks the last component as isMain", () => {
    const code = [
      `function Sub() { return <span />; }`,
      `function Main() { return <div><Sub /></div>; }`,
    ].join("\n\n");

    const result = parseGeneration(code);

    assert.equal(result.components.length, 2);
    assert.equal(result.components[0].name, "Sub");
    assert.equal(result.components[0].isMain, false);
    assert.equal(result.components[1].name, "Main");
    assert.equal(result.components[1].isMain, true);
  });

  it("deduplicates repeated functions by name (last wins)", () => {
    const code = [
      `function Badge() { return <span>v1</span>; }`,
      `function Badge() { return <span>v2</span>; }`,
      `function Card() { return <div><Badge /></div>; }`,
    ].join("\n\n");

    const result = parseGeneration(code);

    assert.equal(result.components.length, 2);

    const badge = result.components.find((c) => c.name === "Badge")!;
    assert.ok(badge.code.includes("v2"), "should keep the last definition");
    assert.ok(!badge.code.includes("v1"), "should not have the first");
  });

  it("strips imports from shared (iframe provides React)", () => {
    const code = [
      `import React from 'react';`,
      `function A() { return <div>A</div>; }`,
      `import React from 'react';`,
      `function B() { return <div>B</div>; }`,
    ].join("\n\n");

    const result = parseGeneration(code);

    assert.equal(result.components.length, 2);
    // Imports must NOT appear in shared — the iframe provides React.
    assert.ok(
      !result.shared.includes("import"),
      "shared should not contain imports"
    );
  });

  it("deduplicates shared code by content", () => {
    // In script mode (triggered by duplicate functions), shared code
    // slices with identical text content appear only once.
    const code = [
      `var THEME = "dark";`,
      `function A() { return React.createElement("div", null, THEME); }`,
      `var THEME = "dark";`,
      `function A() { return React.createElement("div", null, THEME); }`,
      `function B() { return React.createElement("span", null, THEME); }`,
    ].join("\n\n");

    const result = parseGeneration(code);

    const themeCount = (result.shared.match(/var THEME/g) || []).length;
    assert.equal(themeCount, 1, "shared var should appear exactly once");
    assert.equal(result.components.length, 2);
  });

  it("handles the progressive building pattern end-to-end", () => {
    // Simulates the model's progressive output: each section repeats
    // all prior functions and shared code with a new function added.
    const code = [
      // Preamble
      `import React, { useState } from 'react';`,
      // Section 1: just Sub
      `function Sub() { return <span>sub</span>; }`,
      // Section 2: repeats import + Sub, adds Main
      `import React, { useState } from 'react';`,
      `function Sub() { return <span>sub</span>; }`,
      `function Main() { return <div><Sub /></div>; }`,
    ].join("\n\n");

    const result = parseGeneration(code);

    // Should have exactly 2 unique components.
    assert.equal(result.components.length, 2);
    assert.equal(result.components[0].name, "Sub");
    assert.equal(result.components[1].name, "Main");
    assert.equal(result.components[1].isMain, true);

    // Imports must not appear in shared.
    assert.ok(
      !result.shared.includes("import"),
      "shared should not contain imports"
    );
  });

  it("includes preceding JSDoc in component code", () => {
    const code = [
      `/** A badge component. */`,
      `function Badge() { return <span>badge</span>; }`,
    ].join("\n");

    const result = parseGeneration(code);

    assert.ok(
      result.components[0].code.includes("/** A badge component. */"),
      "should include JSDoc"
    );
    assert.ok(
      result.components[0].code.includes("function Badge()"),
      "should include function"
    );
  });

  it("handles export default function", () => {
    const code = `export default function Card() { return <div>Card</div>; }`;
    const result = parseGeneration(code);

    assert.equal(result.components.length, 1);
    assert.equal(result.components[0].name, "Card");
    assert.equal(result.components[0].isMain, true);
  });

  it("skips bare export statements", () => {
    const code = [
      `function Card() { return <div />; }`,
      `export default Card;`,
    ].join("\n\n");

    const result = parseGeneration(code);

    assert.equal(result.components.length, 1);
    assert.equal(result.shared, "");
  });

  it("handles real-world progressive output (flight card pattern)", () => {
    // Compact reproduction of the actual model output for a flight card:
    // each section starts with import + @fileoverview, repeating all prior
    // functions, then adds one new function.
    const code = [
      // ──── Section 1: import + QR ────
      `import React, { useState, useEffect } from 'react';`,
      `/**`,
      ` * @fileoverview Flight booking confirmation card.`,
      ` */`,
      `import React, { useState, useEffect } from 'react';`,
      `function MockQRCode({ size = 48 } = {}) {`,
      `  return <svg width={size} height={size}><rect /></svg>;`,
      `}`,
      // ──── Section 2: import + QR + Barcode ────
      `/**`,
      ` * @fileoverview Flight booking confirmation card.`,
      ` */`,
      `import React, { useState, useEffect } from 'react';`,
      `function MockQRCode({ size = 48 } = {}) {`,
      `  return <svg width={size} height={size}><rect /></svg>;`,
      `}`,
      `function MockBarcode({ width = 120 } = {}) {`,
      `  return <svg width={width}><rect /></svg>;`,
      `}`,
      // ──── Section 3: import + QR + Barcode + Main ────
      `/**`,
      ` * @fileoverview Flight booking confirmation card.`,
      ` */`,
      `import React, { useState, useEffect } from 'react';`,
      `function MockQRCode({ size = 48 } = {}) {`,
      `  return <svg width={size} height={size}><rect /></svg>;`,
      `}`,
      `function MockBarcode({ width = 120 } = {}) {`,
      `  return <svg width={width}><rect /></svg>;`,
      `}`,
      `export default function FlightCard() {`,
      `  const [t, setT] = useState(0);`,
      `  return <div><MockQRCode /><MockBarcode /></div>;`,
      `}`,
    ].join("\n");

    const result = parseGeneration(code);

    // Should produce exactly 3 unique components.
    assert.equal(result.components.length, 3);
    const names = result.components.map((c) => c.name);
    assert.deepEqual(names, ["MockQRCode", "MockBarcode", "FlightCard"]);

    // FlightCard is the main component.
    assert.equal(result.components[2].isMain, true);
    assert.equal(result.components[0].isMain, false);

    // Imports must not appear in shared.
    assert.ok(
      !result.shared.includes("import"),
      "shared should not contain imports"
    );

    // No duplicate function bodies in any component's code.
    for (const comp of result.components) {
      const fnCount = (comp.code.match(/function /g) || []).length;
      assert.equal(fnCount, 1, `${comp.name} should have exactly one function`);
    }
  });

  it("handles code with no imports (hooks as bare globals)", () => {
    // The model sometimes omits imports entirely, referencing useState
    // and useEffect as bare globals. The iframe injects React imports.
    const code = [
      `function Counter() {`,
      `  const [count, setCount] = useState(0);`,
      `  useEffect(() => { document.title = count; }, [count]);`,
      `  return <button onClick={() => setCount(count + 1)}>{count}</button>;`,
      `}`,
    ].join("\n");

    const result = parseGeneration(code);

    assert.equal(result.components.length, 1);
    assert.equal(result.components[0].name, "Counter");
    assert.equal(result.shared, "");
  });

  it("falls back gracefully on unparseable code", () => {
    const code = `this is not valid javascript {{{ !!!`;
    const result = parseGeneration(code);

    assert.equal(result.components.length, 1);
    assert.equal(result.components[0].name, "Component");
    assert.equal(result.components[0].isMain, true);
    assert.equal(result.shared, "");
  });
});

// ─── extractProps ───────────────────────────────────────────────────────────

describe("extractProps", () => {
  it("extracts a prop with type, description, and default", () => {
    const code = [
      `/**`,
      ` * @fileoverview A card component.`,
      ` * @prop {string} title - The card heading (default: "Sample Card")`,
      ` */`,
      `function Card({ title = "Sample Card" }) { return <div>{title}</div>; }`,
    ].join("\n");

    const props = extractProps(code);

    assert.equal(props.length, 1);
    assert.equal(props[0].name, "title");
    assert.equal(props[0].type, "string");
    assert.equal(props[0].description, "The card heading");
    assert.equal(props[0].defaultValue, '"Sample Card"');
    assert.equal(props[0].optional, false);
  });

  it("extracts optional props with bracket syntax", () => {
    const code = `/** @prop {string} [badge] - Optional badge label (default: none) */`;

    const props = extractProps(code);

    assert.equal(props.length, 1);
    assert.equal(props[0].name, "badge");
    assert.equal(props[0].optional, true);
    assert.equal(props[0].defaultValue, "none");
  });

  it("handles props with no default value", () => {
    const code = `/** @prop {number} count - Number of items */`;

    const props = extractProps(code);

    assert.equal(props.length, 1);
    assert.equal(props[0].name, "count");
    assert.equal(props[0].type, "number");
    assert.equal(props[0].description, "Number of items");
    assert.equal(props[0].defaultValue, null);
  });

  it("extracts multiple props from a single JSDoc block", () => {
    const code = [
      `/**`,
      ` * @fileoverview A pricing table.`,
      ` * @prop {string} title - Plan name (default: "Pro")`,
      ` * @prop {number} price - Monthly price (default: 29)`,
      ` * @prop {boolean} [featured] - Highlight this plan (default: false)`,
      ` * @prop {string} currency - Currency symbol (default: "$")`,
      ` */`,
    ].join("\n");

    const props = extractProps(code);

    assert.equal(props.length, 4);
    assert.equal(props[0].name, "title");
    assert.equal(props[1].name, "price");
    assert.equal(props[1].type, "number");
    assert.equal(props[2].name, "featured");
    assert.equal(props[2].optional, true);
    assert.equal(props[2].defaultValue, "false");
    assert.equal(props[3].name, "currency");
  });

  it("returns empty array for code with no @prop annotations", () => {
    const code = `function Plain() { return <div>No props</div>; }`;

    assert.deepEqual(extractProps(code), []);
  });

  it("returns empty array for empty string", () => {
    assert.deepEqual(extractProps(""), []);
  });

  it("normalizes type to lowercase", () => {
    const code = `/** @prop {String} name - The name (default: "World") */`;

    const props = extractProps(code);

    assert.equal(props[0].type, "string");
  });
});

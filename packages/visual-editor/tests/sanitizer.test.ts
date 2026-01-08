/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, beforeEach } from "node:test";
import { JSDOM } from "jsdom";
import { Template } from "@breadboard-ai/utils/template.js";

suite("escapeNodeText", () => {
  let Sanitizer: typeof import("../src/utils/sanitizer.js");
  beforeEach(async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    global.document = dom.window.document;

    // Now that JSDOM is in place we can add in the Sanitizer (which uses Lit).
    Sanitizer = await import("../src/utils/sanitizer.js");
  });

  test("handles empty values", () => {
    assert.equal(Sanitizer.escapeNodeText(null), "");
    assert.equal(Sanitizer.escapeNodeText(undefined), "");
    assert.equal(Sanitizer.escapeNodeText(""), "");
  });

  test("escapes content", () => {
    assert.equal(
      Sanitizer.escapeNodeText("<script></script>"),
      "&lt;script&gt;&lt;/script&gt;"
    );

    assert.equal(
      Sanitizer.escapeNodeText("\x3Cscript\x3E</script>"),
      "&lt;script&gt;&lt;/script&gt;"
    );

    assert.equal(
      Sanitizer.escapeNodeText('<img src="foo" onerror=prompt(domain)>'),
      `&lt;img src="foo" onerror=prompt(domain)&gt;`
    );
  });

  test("handles standalone & chars", () => {
    assert.equal(
      Sanitizer.escapeNodeText("Morecambe & Wise"),
      "Morecambe &amp; Wise"
    );
  });

  test.only("double-encodes already-encoded chars", () => {
    assert.equal(
      Sanitizer.escapeNodeText("Morecambe &amp; Wise"),
      "Morecambe &amp;amp; Wise"
    );

    assert.equal(Sanitizer.escapeNodeText("10 &gt; 8"), "10 &amp;gt; 8");
    assert.equal(Sanitizer.escapeNodeText("8 &lt; 18"), "8 &amp;lt; 18");
    assert.equal(
      Sanitizer.escapeNodeText("They said &quot;Hello&quot;"),
      "They said &amp;quot;Hello&amp;quot;"
    );
    assert.equal(
      Sanitizer.escapeNodeText("They said &#39;Hello&#39;"),
      "They said &amp;#39;Hello&amp;#39;"
    );
    assert.equal(
      Sanitizer.escapeNodeText("&amp;&lt;&gt;&#39;&quot;"),
      "&amp;amp;&amp;lt;&amp;gt;&amp;#39;&amp;quot;"
    );

    assert.equal(
      Sanitizer.escapeNodeText("Morecambe &amp; Wise"),
      "Morecambe &amp;amp; Wise"
    );

    assert.equal(Sanitizer.escapeNodeText("10 &gt; 8"), "10 &amp;gt; 8");
    assert.equal(Sanitizer.escapeNodeText("8 &lt; 18"), "8 &amp;lt; 18");
    assert.equal(
      Sanitizer.escapeNodeText("They said &quot;Hello&quot;"),
      "They said &amp;quot;Hello&amp;quot;"
    );
    assert.equal(
      Sanitizer.escapeNodeText("They said &#39;Hello&#39;"),
      "They said &amp;#39;Hello&amp;#39;"
    );
    assert.equal(
      Sanitizer.escapeNodeText("&amp;&lt;&gt;&#39;&quot;"),
      "&amp;amp;&amp;lt;&amp;gt;&amp;#39;&amp;quot;"
    );
  });

  test("works with templates", () => {
    const tmpl = new Template(`
          10 > 20;

          <img src="foo.jpg">

          Initial topic:
          {{"type": "in", "path": "a6f7367b-66f3-4d1b-9a57-a51f83110bc3", "title": "Get topic"}}

          Research:
          {{"type": "in", "path": "7a3fd89a-d86d-4aea-98cd-15194027dff1", "title": "Do Research"}}

          <`);

    tmpl.substitute(
      (part) => part.title,
      (part) => Sanitizer.escapeNodeText(part)
    );
    assert.strictEqual(
      tmpl.renderable,
      `
          10 &gt; 20;

          &lt;img src="foo.jpg"&gt;

          Initial topic:
          Get topic

          Research:
          Do Research

          &lt;`
    );
  });
});

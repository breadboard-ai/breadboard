/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, beforeEach } from "node:test";
import { Template } from "../../src/template.js";
import { JSDOM } from "jsdom";
import { type Sanitizer as typeSanitizer } from "../../src/index.js";

suite("escape", () => {
  let Sanitizer: typeof typeSanitizer;
  beforeEach(async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    global.document = dom.window.document;

    // Now that JSDOM is in place we can add in the Sanitizer (which uses Lit).
    Sanitizer = await import("../../src/sanitizer.js");
  });

  test("handles empty values", () => {
    assert.equal(Sanitizer.escape(null), "");
    assert.equal(Sanitizer.escape(undefined), "");
    assert.equal(Sanitizer.escape(""), "");
  });

  test("escapes content", () => {
    assert.equal(
      Sanitizer.escape("<script></script>"),
      "&lt;script&gt;&lt;/script&gt;"
    );

    assert.equal(
      Sanitizer.escape("\x3Cscript\x3E</script>"),
      "&lt;script&gt;&lt;/script&gt;"
    );

    assert.equal(
      Sanitizer.escape('<img src="foo" onerror=prompt(domain)>'),
      `&lt;img src="foo" onerror=prompt(domain)&gt;`
    );
  });

  test("handles standalone & chars", () => {
    assert.equal(Sanitizer.escape("Morecambe & Wise"), "Morecambe &amp; Wise");
  });

  test.only("double-encodes already-encoded chars", () => {
    assert.equal(
      Sanitizer.escape("Morecambe &amp; Wise"),
      "Morecambe &amp;amp; Wise"
    );

    assert.equal(Sanitizer.escape("10 &gt; 8"), "10 &amp;gt; 8");
    assert.equal(Sanitizer.escape("8 &lt; 18"), "8 &amp;lt; 18");
    assert.equal(
      Sanitizer.escape("They said &quot;Hello&quot;"),
      "They said &amp;quot;Hello&amp;quot;"
    );
    assert.equal(
      Sanitizer.escape("They said &#39;Hello&#39;"),
      "They said &amp;#39;Hello&amp;#39;"
    );
    assert.equal(
      Sanitizer.escape("&amp;&lt;&gt;&#39;&quot;"),
      "&amp;amp;&amp;lt;&amp;gt;&amp;#39;&amp;quot;"
    );

    assert.equal(
      Sanitizer.escape("Morecambe &amp; Wise"),
      "Morecambe &amp;amp; Wise"
    );

    assert.equal(Sanitizer.escape("10 &gt; 8"), "10 &amp;gt; 8");
    assert.equal(Sanitizer.escape("8 &lt; 18"), "8 &amp;lt; 18");
    assert.equal(
      Sanitizer.escape("They said &quot;Hello&quot;"),
      "They said &amp;quot;Hello&amp;quot;"
    );
    assert.equal(
      Sanitizer.escape("They said &#39;Hello&#39;"),
      "They said &amp;#39;Hello&amp;#39;"
    );
    assert.equal(
      Sanitizer.escape("&amp;&lt;&gt;&#39;&quot;"),
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
      (part) => Sanitizer.escape(part)
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

suite("unescape", () => {
  let Sanitizer: typeof typeSanitizer;
  beforeEach(async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    global.document = dom.window.document;

    // Now that JSDOM is in place we can add in the Sanitizer (which uses Lit).
    Sanitizer = await import("../../src/sanitizer.js");
  });

  test("handles empty values", () => {
    assert.equal(Sanitizer.unescape(null), "");
    assert.equal(Sanitizer.unescape(undefined), "");
    assert.equal(Sanitizer.unescape(""), "");
  });

  test("unescapes content", () => {
    assert.equal(
      Sanitizer.unescape("&lt;script&gt;&lt;/script&gt;"),
      "<script></script>"
    );
  });

  test("unescapes double-escaped content", () => {
    assert.equal(
      Sanitizer.unescape("&amp;amp; &amp;lt; &amp;gt; &amp;quot; &amp;#39;"),
      "&amp; &lt; &gt; &quot; &#39;"
    );
  });

  test("unescape does not strip HTML", () => {
    assert.equal(Sanitizer.unescape("<p>hello</p>"), "<p>hello</p>");
  });

  test("unescapes more complicated values", () => {
    assert.equal(
      Sanitizer.unescape("Morecambe &amp; Wise"),
      "Morecambe & Wise"
    );

    assert.equal(Sanitizer.unescape("10 &gt; 8"), "10 > 8");
    assert.equal(Sanitizer.unescape("8 &lt; 18"), "8 < 18");
    assert.equal(
      Sanitizer.unescape("They said &quot;Hello&quot;"),
      'They said "Hello"'
    );
    assert.equal(
      Sanitizer.unescape("They said &#39;Hello&#39;"),
      "They said 'Hello'"
    );
    assert.equal(Sanitizer.unescape("&amp;&lt;&gt;&#39;&quot;"), "&<>'\"");
  });
});

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import * as Sanitizer from "../../src/sanitizer.js";
import { Template } from "../../src/template.js";

suite("escape", () => {
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
  });

  test("handles standalone & chars", () => {
    assert.equal(Sanitizer.escape("Morecambe & Wise"), "Morecambe &amp; Wise");
  });

  test("double-encodes already-encoded chars", () => {
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

      &lt;img src=&quot;foo.jpg&quot;&gt;

      Initial topic:
      Get topic

      Research:
      Do Research

      &lt;`
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
});

suite("unescape", () => {
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

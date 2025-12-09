export { unescape };

const unescapeTest = /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi;

const namedEntities: Record<string, string> = {
  colon: ":",
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  // add more as needed
};

function unescape(html: string): string {
  return html.replace(unescapeTest, (_, n) => {
    n = n.toLowerCase();
    if (n in namedEntities) return namedEntities[n];

    if (n.charAt(0) === "#") {
      const code =
        n.charAt(1) === "x" ? parseInt(n.substring(2), 16) : +n.substring(1);

      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return "";
  });
}

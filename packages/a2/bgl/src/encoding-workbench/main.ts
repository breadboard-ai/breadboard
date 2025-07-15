/**
 * @fileoverview Add a description for your module here.
 */

export { invoke as default, describe };

const b =
  "VGhlIHdlYXRoZXIgaW4gTG9zIEFsdG9zLCBDQSB0b2RheSwgTW9uZGF5LCBNYXkgMTIsIDIwMjUsIGlzIG1vc3RseSBzdW5ueSB3aXRoIGEgY3VycmVudCB0ZW1wZXJhdHVyZSBvZiA2MsKwRiAoMTfCsEMpLiBJdCBmZWVscyBsaWtlIDYxwrBGICgxNsKwQykgd2l0aCA1NyUgaHVtaWRpdHkgYW5kIGEgMCUgY2hhbmNlIG9mIHJhaW4uCgpIZXJlIGlzIGEgbW9yZSBkZXRhaWxlZCBmb3JlY2FzdCBmb3IgdG9kYXk6CiogICAqKk1vcm5pbmc6KiogTW9zdGx5IGNsb3VkeSwgd2l0aCBhIGxvdyBjaGFuY2Ugb2YgYSBzaG93ZXIgaW4gdGhlIGFmdGVybm9vbiBbNF0uIFBhcnRseSBjbG91ZHkgbGF0ZSBpbiB0aGUgbW9ybmluZywgdGhlbiBiZWNvbWluZyBzdW5ueSBbNl0uCiogICAqKkFmdGVybm9vbjoqKiBBIG1peCBvZiBzdW4gYW5kIGNsb3VkcyBbNV0uIEhpZ2hzIGluIHRoZSA2MHMgWzZdLiBDaGFuY2Ugb2YgcmFpbiBhcm91bmQgMjAtMjklIFsyLCA0XS4KKiAgICoqRXZlbmluZzoqKiBTdW5ueSBpbiB0aGUgZXZlbmluZyBbNF0uIE1vc3RseSBjbGVhciBpbiB0aGUgZXZlbmluZywgdGhlbiBiZWNvbWluZyBtb3N0bHkgY2xvdWR5IFs2XS4gTG93cyBpbiB0aGUgbG93ZXIgNTBzIFs2XS4KKiAgICoqT3Zlcm5pZ2h0OioqIFBhcnRseSBjbG91ZHkgb3Zlcm5pZ2h0IFs0LCA1XS4gTW9zdGx5IGNsb3VkeSBbNl0uCgpXaW5kcyBhcmUgZXhwZWN0ZWQgdG8gYmUgd2VzdCBhdCAxMCB0byAyMCBtcGggWzUsIDZdLCB3aXRoIHNvbWUgc291cmNlcyBpbmRpY2F0aW5nIG5vcnRod2VzdCB3aW5kcyA5IHRvIDExIG1waCBbNywgOF0gb3Igc291dGh3ZXN0IHdpbmRzIDUgdG8gMTUgbXBoIFs2XS4KClRoZSBhaXIgcXVhbGl0eSBpcyBnZW5lcmFsbHkgYWNjZXB0YWJsZSBmb3IgbW9zdCBpbmRpdmlkdWFscywgdGhvdWdoIHNlbnNpdGl2ZSBncm91cHMgbWlnaHQgZXhwZXJpZW5jZSBtaW5vciB0byBtb2RlcmF0ZSBzeW1wdG9tcyBmcm9tIGxvbmctdGVybSBleHBvc3VyZSBbMl0u";

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

async function invoke({
  context: _context,
}: {
  context: LLMContent[];
}): Promise<Outcome<{ context: LLMContent[] }>> {
  const text = decodeBase64(b);
  return { context: [{ parts: [{ text }] }] };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {},
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
        },
      },
    } satisfies Schema,
  };
}

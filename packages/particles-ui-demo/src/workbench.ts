import { generate, createSpec } from "./gemini";
import particleTypes from "./types/particles?raw";

// const p = `Examine the code before and write a companion guide for UX designers.
// The purpose of this guide will be to help them write specs for this UI toolkit.

// From reading this guide, they should be able to write things like: "the item
// is a card, and it has three segments, with the first segment having a weight of ..." etc.

// Use plain English rather than specific types in descriptions. Instead of
// Orientation.HORIZONTAL, say "horizontal".

// \`\`\`ts
// ${particleTypes}
// \`\`\`
// `;

// const si = `You are an experienced TypeScript programmer whose particular skill
// is to explain TypeScript code to UX designers.

// You are working as part of an AI system, so no chit-chat and no explaining what you're doing and why.
// DO NOT start with "Okay", or "Alright" or any preambles. Just the output, please.`;
// const spec = await generate(p, si);
// console.log("SPEC", spec);

const spec = await createSpec(
  `Write UI for a single editable item in an editable TODO list. The item must have a picture, title, description, due date and a "Delete" action.`
);
console.log("SPEC", spec);

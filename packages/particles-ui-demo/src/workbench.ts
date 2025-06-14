import { createParticles, createSpec } from "./gemini";

const goal = `Write UI for a single editable item in an editable TODO list. The item must have a picture, title, description, due date and a "Delete" action.`;
const spec = await createSpec(goal);
console.log("SPEC", spec);

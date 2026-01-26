import { llm } from "../../../src/a2/a2/utils.js";

export const title = "Blog Post Writer";

export const objective =
  llm`Make a blog post writer. It takes a topic, then does some research on it, then writes an outline, then generates an snazzy header graphic based on this outline, and in parallel, writes the blog post based on the outline. Then shows the header graphic and the blog post as a final result.
  
Topic: Cold Fusion`.asContent();

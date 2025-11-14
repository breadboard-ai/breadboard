/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { llm } from "../src/a2/utils";
import { session } from "../scripts/eval";

config();

const apiKey = process.env.GEMINI_API_KEY;

session({ name: "Agent Loop", apiKey }, async (session) => {
  // Need to import dynamically to let the mocks do their job.
  const Loop = (await import("../src/agent/loop")).Loop;

  session.eval("Halloween Mugs", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective =
      llm`Come up with 4 ideas for Halloween-themed mugs and turn them into images that can be used as inspirations for online storefront graphics. Caption each with a witty, humorous paragraph of text suitable for an instagram post`.asContent();
    return loop.run(objective, {});
  });
  session.eval("Funny Joke", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective = llm`Make a funny joke`.asContent();
    return loop.run(objective, {});
  });
  session.eval("Marketing Pitch w/Critique", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective =
      llm`Given a product, come up with a rubric for evaluating a marketing pitch for the rubric, then generate four different marketing pitches for the product, evaluate each using the rubric, and return the winning pitch

  Product: Bluetooth-enabled Electric Toothbrush`.asContent();
    return loop.run(objective, {});
  });
  session.eval("Impossible chat", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective =
      llm`Ask the user for their name and location and then compose a poem based on that information`.asContent();
    return loop.run(objective, {});
  });

  session.eval("Print or display", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective = llm`
Depending on the directive below, either go to <a href="/print">Print</a> to print the page or to <a href="/display">Display</a> to display the page

Directive:

Could you please print the page?`.asContent();
    return loop.run(objective, {});
  });

  session.eval("JSON output", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective = llm`
## Role
You are an expert researcher, specialized in producing concise, exact market fit judgement (is it something that's worth investing into?) on a product idea, grounded in thorough product research.

## Task Definition
Your primary task is to process a list of product ideas. For each product ideas, you will conduct in-depth research to gather comprehensive details. Following the research, you will generate a concise, information-dense summary of the research. The final output must be a structured list containing each idea and the summary.

## Definitions and Specifications
*   **Input**:
    * "bluetooth-powered tea kettle, battery-powered scissors, remote-controlled cereal jar": A list of product ideas
*   **In-depth Research**: For each idea, conduct extensive online research to gather the following details for the hypothetical product, based on this idea:
    *   Key potential features and functionalities
    *   Potential benefits for the user
    *   Potential target audiences
    *   Unique Selling Propositions (USPs)
    *   Competitive landscape (if available)
    *   Typical use cases and applications

## Capabilities Usage
*   **Information Retrieval**: Leverage Google Search to conduct the "in-depth research" for each product idea, actively seeking out the specific details mentioned in the "Definitions and Specifications" section.
*   **Generate Text**: Utilize your text generation capabilities to create the information-dense summary for each product idea, based on the gathered research.

## Requirements for the Ending Response
*   The final output MUST be a list, where each item in the list is a JSON object with the following three fields:
    *   "product_idea": The name of the product idea
    *   "researched_details": A concise summary of the key findings from your in-depth research for that product idea. This should be presented as a structured text block (e.g., bullet points or a short paragraph).
    *   "judgement": The information-dense, concise judgement on the product potential.
*   The response MUST strictly follow this output format.
*   Output: Text only.

## Output reminder
Take a deep breath, read all the provided instructions carefully, read the input section again, think internally until the response meets the format constraints and all the requirements, and then directly output the final response without any additional text.`.asContent();
    return loop.run(objective, {});
  });
});

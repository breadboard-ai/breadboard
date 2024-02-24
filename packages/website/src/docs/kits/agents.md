---
layout: docs.njk
title: Agent Kit
tags:
  - kits
---

{% assign src_url = "https://github.com/breadboard-ai/breadboard/tree/main/packages/agent-kit/src/nodes/" %}

The Agent kit contains Breadboard nodes to quickly organize LLM-based workers (or just "workers") to perform semi-autonomous asynchronous tasks.

By "semi-autonomous", we mean the ability of the workers to collaborate by themselves and with the users to advance toward some objective according to a prescribed plan. As a loose analogy, with this kit, we are able to create functional organizations that include both human and synthetic members.

The word "asynchronous" hints at the sense of timing. The organizations, constructed with this kit aren't meant to engage in fulfilling objectives with real-time or near real-time requirements. They are best suited for tasks where the time constraints aren't firm, and taking it minutes or hours to arrive at the solution is perfectly acceptable.

> [!WARNING]
>
> This kit is in active development and isn't yet fully there. Things may shift. Construction debris may be found in your cookies.

## Overview

The kit consists of Nodes that are called "workers". All workers have the same basic shape: they have a `context` input port and produce a `context` output port. Most workers will have additional ports to enable them to perform work, but all will follow "`context` in, `context` out" pattern.

The `context` ports are used to pass the work context. By connecting one worker's `context` port to another worker's `context`, we establish a _workflow_: a relationship between the two workers where they pass work between each other. By arranging workflows across multiple workers, we can create ensembles of workers.

As it is passed from one worker to another, the work context accumulates: each worker appends their work at the end before passing the context on. This enables us to have workflows that retain full memory of the entire workflow. We can refer to previous steps in the workflow and build on them.

If we want, we can also reset context and start anew, discarding the built-up context. Later on, the kit will grow tools to merge and split work contexts, as well as filter them.

## Worker (agents.worker)

The Worker node represents the simplest kind of worker: a worker that is given an instruction. This instruction typically shapes its character and orients it a bit toward the task we have in mind for it. Here's an example of a worker:

```ts
const summarizer = agents.worker({
  context,
  instruction: `You are a genius legal expert.
    You specialize in carefully reading the dense paragraphs of patent
    application texts and summarizing them in a few simple sentences that
    most people can understand.`,
});
```

This particular worker is instructed to be a summarizer of patent applications. This pattern should be fairly familiar to those playing with LLMs: the instruction acts as a sort of "system prompt", and the `context` input supplies the "user prompt".

The worker outputs the updated `context` as expected. In addition, the Worker node has a `text` port, which can be used to just get the work output, without any context. This can be useful for showing final results or resetting the context.

The `context` input is fairly flexible in what it accepts. It will take the `context` output of any other worker. It will also happily accept just a string input and transform it into a proper context behind the scenes.

This last trick is useful for quickly creating worker-based boards. Here's one that is a wrapper around our summarizer worker from above:

```ts
export default await board(({ paragraph }) => {
  // Describe the input (this is where the user will paste the dense paragraph).
  paragraph.title("Text to summarize").isString().format("multiline");
  // Engage the summarizer
  const summarizer = agents.worker({
    // Pass the input as context.
    context: paragraph,
    instruction: `You are a genius legal expert.
      You specialize in carefully reading the dense paragraphs of patent
      application texts and summarizing them in a few simple sentences that
      most people can understand.`,
  });
  return { text: summarizer.text };
}).serialize({
  title: "Dense text summarizer",
  description:
    "Turns particularly dense text passages into easy-to-understand summaries",
  version: "0.0.1",
});
```

We can easily create workflows with workers. If we want to add a critic to review and critique the produced summary, we simply pass the summarizer's context to a new worker with the appropriate instruction:

```ts
const summarizer = agents.worker({
  context: paragraph,
  instruction: `You are a genius legal expert.
      You specialize in carefully reading the dense paragraphs of patent
      application texts and summarizing them in a few simple sentences that
      most people can understand.`,
});
const critic = agents.worker({
  // Pass summarizer's context to the critic.
  context: summarizer.context,
  instruction: `You are a reviewer of summaries produced from patent
    applications.
    Compare the summary with the original text and identify three areas of
    improvement.
    What is missing? What could be better phrased? What could be removed?
    Is there any technical jargon that could be replaced with simpler terms?`,
});
```

In this simple workflow, the two workers now collaborate, albeit in a very primitive way: the summarizer does work, then passes it onto the critic, who reviews and critiques the work.

## Structured Worker (agents.structuredWorker)

The Structured Worker node offers a different kind of worker: this one knows how to adhere to some structure in its output.

Structured Workers are a little bit more effortful to construct, but they are a lot more powerful. In addition to `instruction`, a Structured Worker has a `schema` input port, which expects a valid [JSON schema](https://json-schema.org/).

Let's rework the critic from above as the structured worker:

```ts
const critic = agents.worker({
  // Pass summarizer's context to the critic.
  context: summarizer.context,
  instruction: `You are a reviewer of summaries produced from patent
    applications.
    Compare the summary with the original text and identify three areas of
    improvement.
    What is missing? What could be better phrased? What could be removed?
    Is there any technical jargon that could be replaced with simpler terms?`,
  schema: {
    type: "object",
    properties: {
      improvements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            improvement: {
              type: "string",
              description: "a suggested improvement",
            },
            reasoning: {
              type: "string",
              description: "reasoning behind the improvement",
            },
          },
        },
      },
    },
  },
});
```

This may look a bit daunting, but roughly, it tells the worker to produce results in a very specific format: a JSON object containing three items, each containing a proposed improvement and a reasoning behind it.

Here's a sample output of our critic above:

```json
{
  "improvements": [
    {
      "improvement": "Add a mention of the fact that the system can be used for
      various tasks, such as translation, spelling correction, and optical
      character recognition.",
      "reasoning": "This information is included in the original text and would
      make the summary more comprehensive."
    },
    {
      "improvement": "Replace the phrase \"obtained data\" with \"data from the
      language model\".",
      "reasoning": "This would make the summary easier to understand for
      non-technical readers."
    },
    {
      "improvement": "Remove the phrase \"The processing server can be
      implemented in various configurations\".",
      "reasoning": "This information is not essential to understanding the main
      concept of the system."
    }
  ]
}
```

Asking for structured outputs can dramatically elevate the quality of worker's output. Think of the structure as rails that encourage the worker to reason about the problem in a certain way. Especially in situation where we're asking the worker do something that requires critical thinking, thinking in steps, or relying on own reasoning to zero in on a solution, Structured Worker will be your favorite synthetic colleage.

Workers are very happy to take JSON output, so we can simply pass this work as context to another worker, whether it's a structured worker or not.

Because it is given a task to adhere to a strict schema, the Structured Worker validates its own output and, if the output is invalid, will automatically try again, up to five times. Typically, this is enough to overcome any validation-related challenges, but in the worst case, the Structured Worker will throw an error and give up, halting the workflow.

## Repeater

The Repeater node creates a repeating loop of workers, enabling us to create cycles within our workflows.

The repeater takes in a work `context` and, with each iteration, appends the work to it. This way, the workers inside of the iteration can build on the work they've done before.

In addition to the the `context` input and output, it expects the following inputs:

- `worker` -- required, a worker to repeat. Typically, here we supply another board that does some useful repeatable chunk of work.

- `max` -- optional, maximum number of repetitions to make. Set it to `-1` to go infinitely (this is also the default value).

If the repeater is configured to exit (the `max` value isn't `-1`), it will return the full context of work accumulated through all iterations.

Let's suppose we have a small sub-team of Structured Workers that does one iteration of the task of summarizing dense documents:

```ts
const summarizerSubteam = board(({ context }) => {
  context.title("Text to summarize").isString().format("multiline");

  const summarizer = agents.structuredWorker({
    $metadata: { title: "Summarizer" },
    context,
    instruction:
      "You are a genius legal expert. You specialize in carefully reading the dense paragraphs of patent application texts and summarizing them in a few simple sentences that most people can understand. Incorporate all improvements, if they are suggested",
    schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "the summary",
        },
      },
    } satisfies Schema,
  });

  const critic = agents.structuredWorker({
    $metadata: { title: "Reviewer" },
    context: summarizer.context,
    instruction:
      "You are a reviewer of summaries produced from patent applications, helping to make the summaries become more accessible and clear. Compare the latest summary with the original text and identify three areas of improvement. What is missing? What could be better phrased? What could be removed? Is there any technical jargon that could be replaced with simpler terms?",
    schema: {
      type: "object",
      properties: {
        improvements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              improvement: {
                type: "string",
                description: "a suggested improvement",
              },
              reasoning: {
                type: "string",
                description: "reasoning behind the improvement",
              },
            },
          },
        },
      },
    } satisfies Schema,
  });
  return { context: critic.context };
});
```

Now, with the Repeater node, we can make them iterate 5 times on the task we give them:

```ts
const denseParagraphOfText = "... <text goes here> ... ";

const iterate = agents.repeater({
  $metadata: { title: "Iterative Improvement" },
  context: denseParagraphOfText,
  worker: summarizerSubteam,
  max: 5,
});
```

What will happen here is that once the first worker (the "Summarizer") is done, it will hand off the work to the second worker (the "Reviewer"), who will suggest improvements, and then, thanks to the Repeater, will hand the work back to the first worker, who will incorporate improvements, handing the improved summary to the second worker, and so on.

As a result, the team will deliver an iteratively improved summary of the text.

## Human (agents.human)

The Human node is a way to insert a real person into our team of synthetic workers. Such a person may steer the work with comments, accept or reject work, collaborating with the synthetic workers.

When running the graph, the node manifests as showing intermediate output and asking for input in response to this output.

Just like any node in the Agents Kit, the Human node receives and produces `context`. In addition, it takes two optional inputs:

- `title` -- to give the user input field a helpful title. If not provided, the input field have the title of "User".

- `description` -- to give the input field an additional hint. If not provided, the hint will have the value of "User's question or request".

When the Human node receives context, it will check to see if the last bit of work was produced by synthetic workers. If so, it will helpfully output that work for the user to see.

Combining the Repeater, Human, and Worker node, we can build a very simple chatbot. This Repeater creates the conversation loop with Human and Worker in it:

```ts
const bot = agents.repeater({
  $metadata: { title: "Chat Bot" },

  worker: board(({ context, instruction }) => {
    const human = agents.human({
      context: context,
      title: "User",
      description: "Type here to talk to the chat bot",
    });

    const bot = agents.worker({
      context: human.context,
      instruction: `As a friendly assistant bot, reply to request below in a
        helpful, delighted, and brief manner to assist the user as quickly as
        possible.

        Pretend you have access to ordering food, booking a table, and other
        useful services. You can also ask for more information if needed.`,
    });
    return { context: bot.context };
  }),
});
```

---
layout: docs.liquid
title: Gemini Kit
tags:
  - kits
---

This kit contains components that provide access to Gemini API. Currently, there are two components: the `text` and the `nano`.

## The `text` component

Use this component to use the larger Gemini models: [Flash](https://ai.google.dev/gemini-api/docs/models/gemini#gemini-1.5-flash) and [Pro](https://ai.google.dev/gemini-api/docs/models/gemini#gemini-1.5-pro).

The component has no required inputs, but expects one of either **Context** or **Text** input port values to be supplied. Otherwise, it will throw an error.

{{ "/breadboard/static/boards/kits/gemini-text-context.bgl.json" | board }}

The component's inputs and outputs mimic Gemini [`generateContent`](https://ai.google.dev/api/generate-content) API, with a few important additions:

- The component will automatically retry the API call if it fails, unless the response error code is `404`, `429` or `400` (See Gemini API [error codes](https://ai.google.dev/gemini-api/docs/troubleshooting#error-codes) for reference). The **Retry Count** port allows specifying how many times to retry the API call.

- The component has **Text** input and output ports for convenience and simpler use cases that don't involve multi-modal inputs or recurring conversation context.

### Input Ports

- **Context** (id: `context`) -- the conversation context. Expects an array of Gemini API's [Content](https://ai.google.dev/api/rest/v1beta/Content) objects. If not supplied, falls back to **Text**.

- **Text** (id: `text`) -- text to use as prompt for generation. This is a less sophisticated version of **Context**, allowing you to pass a string, rather than having to construct the [Content](https://ai.google.dev/api/rest/v1beta/Content) object array. If **Context** input port value is supplied, the **Text** value will be ignored.

- **Tools** (id: `tools`) -- the array of tool call declarations, as defined in [Gemini API](https://ai.google.dev/api/generate-content).

- **Model** (id: `model`) -- the model to use. Currently, the two options are `gemini-1.5-flash-latest` and `gemini-1.5-pro-latest`.

- **Response MIME Type** (id: `responseMimeType`) -- the output response MIME type of the generated text. Supported values are `text/plan` and `application/json`. See Gemini API [GenerationConfig](https://ai.google.dev/api/generate-content#generationconfig) for more information.

- **Retry Count** (id: `retry`) -- how many times to retry the API call if it fails.

- **Safety Settings** (id: `safetySettings`) -- the safety settings for the API call, an array of `SafetySetting` objects. See Gemini API [SafetySetting](https://ai.google.dev/api/generate-content#safetysetting) for more information.

- **Stop Sequences** (id: `stopSequences`) -- the array of strings that will stop the output.

- **System Instruction** (id: `systemInstruction`) -- the [system instruction](https://ai.google.dev/gemini-api/docs/system-instructions?hl=en&lang=rest) for the API call. The port value can be either a string or a [Content](https://ai.google.dev/api/rest/v1beta/Content) object. See [`generateContent`](https://ai.google.dev/api/generate-content) documentation for more information.

### Output Ports

- **Context** (id: `context`) -- the outgoing conversation context. Will be a Gemini API's [Content](https://ai.google.dev/api/rest/v1beta/Content) object, containing the latest generated response, including tool calls.

- **Text** (id: `text`) -- the same value as **Context**, presented as a string. Convenient when not using tool calls.

### Example

The board above is how one might typically use the `text` node. Here's another example, using **Text** input and output ports:

{{ "/breadboard/static/boards/kits/gemini-text-text.bgl.json" | board }}

For a more elaborate use case, let's give it a few tools and let it make a decision to call them:

{{ "/breadboard/static/boards/kits/gemini-text-tool.bgl.json" | board }}

When we invoke this board with a prompt like "write me a poem?", we will see it respond with text, as usual. However, if we ask it questions like "what is the square root of e?" or "what is the distance between Earth and Moon?", it will issue a tool call:

![Tool Call Example](/breadboard/static/images/gemini-kit/tool-call-example.png)

## The `nano` component

Allows calling the [on-device Gemini Nano](https://developer.chrome.com/docs/ai/built-in) model via the experimental Prompt API. You have to sign up for early access [here](https://docs.google.com/forms/d/e/1FAIpQLSfZXeiwj9KO9jMctffHPym88ln12xNWCrVkMY_u06WfSTulQg/viewform).

{{ "/breadboard/static/boards/kits/gemini-nano.bgl.json" | board }}

### Input Ports

- **Prompt** (id: `prompt`) -- the text-only prompt for the model

### Output Ports

- **Text** (id: `text`) -- the generated text output

### Example

The board above provides a simple example of how to use the component in a board.

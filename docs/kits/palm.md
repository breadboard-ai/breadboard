---
title: PaLM Kit
description: Integration with Google's PaLM API for text generation and embeddings.
---

# PaLM Kit

The PaLM Kit provides nodes for integrating with Google's PaLM (Pathways Language Model) API, enabling text generation and embedding capabilities in your Breadboard graphs.

## Overview

The PaLM Kit wraps the Google PaLM API, providing easy-to-use nodes for:

- **Text Generation**: Generate text completions using PaLM models
- **Text Embeddings**: Generate embeddings for text inputs

## Authentication

The PaLM Kit requires a Google API key with access to the PaLM API. Use the Secrets Kit to securely provide your API key.

```typescript
import { board } from "@google-labs/breadboard";
import { secrets } from "@google-labs/core-kit";

const palmBoard = board(() => {
  const apiKey = secrets({ keys: ["PALM_API_KEY"] });
  // Use apiKey in PaLM nodes
  return { apiKey };
});
```

Store your API key in an environment variable or `.env` file:

```bash
PALM_API_KEY=your_api_key_here
```

## Nodes

### `generateText`

Generates text completions using the PaLM text generation model.

**Inputs:**

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `text` | string | The prompt text to complete | (required) |
| `temperature` | number | Controls randomness (0-1) | 0.7 |
| `candidateCount` | number | Number of completions to generate | 1 |
| `topP` | number | Nucleus sampling parameter | 0.95 |
| `topK` | number | Top-k sampling parameter | 40 |
| `maxOutputTokens` | number | Maximum tokens to generate | 256 |

**Outputs:**

| Property | Type | Description |
|----------|------|-------------|
| `candidates` | array | Array of generated text completions |
| `candidates[].output` | string | The generated text |

**Example:**

```typescript
import { board } from "@google-labs/breadboard";
import { palm } from "@google-labs/palm-kit";
import { secrets } from "@google-labs/core-kit";

const storyGenerator = board(({ prompt }) => {
  const apiKey = secrets({ keys: ["PALM_API_KEY"] });
  
  const completion = palm.generateText({
    text: prompt,
    temperature: 0.8,
    maxOutputTokens: 512,
  }).in({ apiKey });
  
  return { story: completion.candidates[0].output };
});
```

### `embedText`

Generates embeddings for text inputs using the PaLM embedding model.

**Inputs:**

| Property | Type | Description |
|----------|------|-------------|
| `text` | string | The text to embed | (required) |

**Outputs:**

| Property | Type | Description |
|----------|------|-------------|
| `embedding` | array | Array of floating point numbers representing the text embedding |

**Example:**

```typescript
import { board } from "@google-labs/breadboard";
import { palm } from "@google-labs/palm-kit";
import { secrets } from "@google-labs/core-kit";

const textEmbedder = board(({ text }) => {
  const apiKey = secrets({ keys: ["PALM_API_KEY"] });
  
  const embedding = palm.embedText({
    text,
  }).in({ apiKey });
  
  return { embedding: embedding.embedding };
});
```

## Integration with Template Kit

Combine the PaLM Kit with the Template Kit for dynamic prompt engineering.

```typescript
import { board } from "@google-labs/breadboard";
import { palm } from "@google-labs/palm-kit";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { secrets } from "@google-labs/core-kit";

const promptEngineering = board(({ topic, style }) => {
  const apiKey = secrets({ keys: ["PALM_API_KEY"] });
  
  // Create a dynamic prompt using templates
  const prompt = templates.prompt({
    template: `Write a {{style}} story about {{topic}}.`,
    topic,
    style,
  });
  
  // Generate text using the templated prompt
  const story = palm.generateText({
    text: prompt.prompt,
    temperature: 0.9,
    maxOutputTokens: 1024,
  }).in({ apiKey });
  
  return { 
    story: story.candidates[0].output,
    prompt: prompt.prompt 
  };
});
```

## Complete Example

Here's a complete example showing a board that generates creative content with error handling:

```typescript
import { board } from "@google-labs/breadboard";
import { palm } from "@google-labs/palm-kit";
import { templates } from "@google-labs/template-kit";
import { secrets } from "@google-labs/core-kit";

const creativeWriter = board(({ subject, genre }) => {
  const apiKey = secrets({ keys: ["PALM_API_KEY"] });
  
  // Build a structured prompt
  const prompt = templates.prompt({
    template: `Create a {{genre}} story about {{subject}}. 
Make it engaging and approximately 200 words long.`,
    subject,
    genre,
  });
  
  // Generate the story
  const result = palm.generateText({
    text: prompt.prompt,
    temperature: 0.8,
    candidateCount: 1,
    maxOutputTokens: 800,
  }).in({ apiKey });
  
  return { 
    story: result.candidates[0].output,
    metadata: {
      prompt: prompt.prompt,
      tokensUsed: result.candidates[0].tokenCount,
    }
  };
});

// Run the board
const result = await creativeWriter({ 
  subject: "a robot learning to paint",
  genre: "heartwarming" 
});

console.log(result.story);
```

## Error Handling

The PaLM Kit nodes will throw errors for invalid API keys, rate limits, or invalid parameters. Wrap calls in try-catch blocks or use the Core Kit's `run` node for error handling:

```typescript
import { board } from "@google-labs/breadboard";
import { palm } from "@google-labs/palm-kit";
import { core } from "@google-labs/core-kit";

const safeGenerate = board(({ text, apiKey }) => {
  const result = core.run({
    board: palm.generateText({ text }),
    inputs: { apiKey },
  });
  
  return { 
    output: result.candidates?.[0]?.output || "Error generating text",
    success: !!result.candidates 
  };
});
```

## API Reference

For the most up-to-date information on the PaLM API, see the [Google AI documentation](https://developers.generativeai.google/).

## Installation

```bash
npm install @google-labs/palm-kit
```

Import in your project:

```typescript
import { palm } from "@google-labs/palm-kit";
```

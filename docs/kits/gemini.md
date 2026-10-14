---
title: Gemini Kit
description: Integration with Google's Gemini AI models for text generation, chat, and embeddings.
layout: docs
---

# Gemini Kit

The Gemini Kit provides nodes for integrating with Google's Gemini AI models, enabling text generation, multi-turn conversations, and text embeddings within your Breadboard graphs.

## Prerequisites

To use the Gemini Kit, you need a Google AI Studio API key:

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey) and sign in with your Google account
2. Create a new API key
3. Store the key securely using the Secrets node (see [Security Best Practices](#security-best-practices))

## Available Nodes

### `gemini.generate`

Generates text completions using Gemini models.

#### Inputs

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `text` | `string` | Yes | The prompt text to send to the model |
| `model` | `string` | No | Model name (default: `gemini-pro`) |
| `temperature` | `number` | No | Sampling temperature (0.0 - 1.0, default: 0.7) |
| `maxTokens` | `number` | No | Maximum tokens to generate |
| `topK` | `number` | No | Top-k sampling parameter |
| `topP` | `number` | No | Top-p sampling parameter |
| `stopSequences` | `string[]` | No | Sequences that stop generation |
| `safetySettings` | `object` | No | Content safety configuration |
| `apiKey` | `string` | Yes | API key (use Secrets node) |

#### Outputs

| Property | Type | Description |
|----------|------|-------------|
| `text` | `string` | Generated text response |
| `candidates` | `object[]` | Alternative responses |
| `usage` | `object` | Token usage statistics |

### `gemini.chat`

Handles multi-turn conversations with context preservation.

#### Inputs

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `text` | `string` | Yes | The current message to send |
| `context` | `object[]` | No | Previous conversation history |
| `model` | `string` | No | Model name (default: `gemini-pro`) |
| `temperature` | `number` | No | Sampling temperature (0.0 - 1.0) |
| `maxTokens` | `number` | No | Maximum tokens to generate |
| `apiKey` | `string` | Yes | API key (use Secrets node) |

#### Outputs

| Property | Type | Description |
|----------|------|-------------|
| `text` | `string` | Model's response text |
| `context` | `object[]` | Updated conversation history |
| `usage` | `object` | Token usage statistics |

### `gemini.embed`

Generates embeddings for text input.

#### Inputs

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `text` | `string` | Yes | Text to embed |
| `model` | `string` | No | Embedding model (default: `embedding-001`) |
| `apiKey` | `string` | Yes | API key (use Secrets node) |

#### Outputs

| Property | Type | Description |
|----------|------|-------------|
| `embedding` | `number[]` | Vector representation of input text |
| `usage` | `object` | Token usage statistics |

## Configuration Options

### Model Selection

Available models:
- `gemini-pro`: General purpose text generation and chat
- `gemini-pro-vision`: Multimodal (text and image) understanding
- `embedding-001`: Text embeddings for similarity search

### Generation Parameters

- **temperature**: Controls randomness (0.0 = deterministic, 1.0 = creative)
- **maxTokens**: Limits response length
- **topK**: Limits vocabulary to top K tokens
- **topP**: Nucleus sampling threshold

### Safety Settings

Configure content filtering:

```json
{
  "harassment": "BLOCK_MEDIUM_AND_ABOVE",
  "hateSpeech": "BLOCK_MEDIUM_AND_ABOVE",
  "sexuallyExplicit": "BLOCK_MEDIUM_AND_ABOVE",
  "dangerousContent": "BLOCK_MEDIUM_AND_ABOVE"
}
```

## Examples

### Basic Text Generation

```json
{
  "nodes": [
    {
      "id": "secrets",
      "type": "secrets",
      "configuration": {
        "keys": ["GEMINI_API_KEY"]
      }
    },
    {
      "id": "generate",
      "type": "gemini.generate",
      "configuration": {
        "text": "Explain quantum computing in simple terms",
        "temperature": 0.7
      }
    }
  ],
  "edges": [
    {
      "from": "secrets",
      "to": "generate",
      "out": "GEMINI_API_KEY",
      "in": "apiKey"
    }
  ]
}
```

### Multi-Turn Conversation

```json
{
  "nodes": [
    {
      "id": "secrets",
      "type": "secrets",
      "configuration": {
        "keys": ["GEMINI_API_KEY"]
      }
    },
    {
      "id": "chat",
      "type": "gemini.chat",
      "configuration": {
        "text": "What are the main ingredients?",
        "context": [
          {"role": "user", "content": "I want to bake chocolate chip cookies."},
          {"role": "model", "content": "Great choice! You'll need flour, sugar, butter, eggs, and chocolate chips."}
        ]
      }
    }
  ],
  "edges": [
    {
      "from": "secrets",
      "to": "chat",
      "out": "GEMINI_API_KEY",
      "in": "apiKey"
    }
  ]
}
```

### Streaming Responses

To handle streaming responses, wire the output to a node that processes chunks:

```json
{
  "nodes": [
    {
      "id": "generate",
      "type": "gemini.generate",
      "configuration": {
        "text": "Write a short story",
        "stream": true
      }
    },
    {
      "id": "output",
      "type": "output"
    }
  ],
  "edges": [
    {
      "from": "generate",
      "to": "output",
      "out": "stream",
      "in": "text"
    }
  ]
}
```

### Error Handling

Handle API errors gracefully:

```json
{
  "nodes": [
    {
      "id": "generate",
      "type": "gemini.generate"
    },
    {
      "id": "errorHandler",
      "type": "runJavascript",
      "configuration": {
        "code": "if (input.error) { return { fallback: 'Service temporarily unavailable' }; } return input;"
      }
    }
  ],
  "edges": [
    {
      "from": "generate",
      "to": "errorHandler",
      "out": "*"
    }
  ]
}
```

## Integration Examples

### With Template Kit

Use templates to construct dynamic prompts:

```json
{
  "nodes": [
    {
      "id": "template",
      "type": "template",
      "configuration": {
        "template": "Translate the following to {{language}}: {{text}}"
      }
    },
    {
      "id": "generate",
      "type": "gemini.generate"
    }
  ],
  "edges": [
    {
      "from": "template",
      "to": "generate",
      "out": "string",
      "in": "text"
    }
  ]
}
```

### With Core Kit

Wire outputs to conditional logic:

```json
{
  "nodes": [
    {
      "id": "generate",
      "type": "gemini.generate"
    },
    {
      "id": "checkLength",
      "type": "jsonata",
      "configuration": {
        "expression": "$length(text) > 100 ? 'long' : 'short'"
      }
    }
  ],
  "edges": [
    {
      "from": "generate",
      "to": "checkLength",
      "out": "text",
      "in": "json"
    }
  ]
}
```

## Security Best Practices

### Using Secrets Node

Never hardcode API keys in board definitions. Use the Secrets node:

```json
{
  "nodes": [
    {
      "id": "secrets",
      "type": "secrets",
      "configuration": {
        "keys": ["GEMINI_API_KEY"]
      }
    },
    {
      "id": "generate",
      "type": "gemini.generate"
    }
  ],
  "edges": [
    {
      "from": "secrets",
      "to": "generate",
      "out": "GEMINI_API_KEY",
      "in": "apiKey"
    }
  ]
}
```

Store the actual key in your environment:

```bash
export GEMINI_API_KEY="your-api-key-here"
```

### Key Rotation

- Rotate API keys regularly
- Use separate keys for development and production
- Monitor usage in Google AI Studio dashboard

### Rate Limiting

Be aware of Gemini API rate limits:
- Free tier: 60 requests per minute
- Pay-as-you-go: Higher limits available

Implement retry logic with exponential backoff for production applications.

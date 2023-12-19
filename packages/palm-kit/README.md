# PaLM Kit

![Milestone](https://img.shields.io/badge/milestone-M3-red) ![Stability](https://img.shields.io/badge/stability-wip-green) [![Discord](https://img.shields.io/discord/1138546999872999556?logo=discord)](https://discord.gg/breadboard)

A Breadboard Kit with nodes to access PaLM APIs.

## Node Reference

This kit contains the following nodes:

### The `generateText` node

This is a [PaLM API](https://developers.generativeai.google/) text completion node. To produce useful output, the node needs a `PALM_KEY` input and the `text` input.

#### Example:

Given this input:

```json
{
  "PALM_KEY": "<your API key>",
  "text": "How old is planet Earth?"
}
```

The node will produce this output:

```json
{
  "completion": "It is about 4.5 billion years old."
}
```

#### Inputs:

- `PALM_KEY` required, must contain the Google Cloud Platform API key for the project has the "Generative Language API" API enabled.
- `text` required, sent as the prompt for the completion.
- `stopSequences` optional array of strings. These will be passed as the stop sequences to the completion API.

#### Outputs:

- `completion` - result of the PaLM API text completion.

### The `embedText` node

This is a [PaLM API](https://developers.generativeai.google/) text embedding node. Just like the `generateText` node, it needs a `PALM_KEY` input and the `text` input.

#### Example:

Given this input:

```json
{
  "PALM_KEY": "<your API key>",
  "text": "How old is planet Earth?"
}
```

The node will output a 768-dimensional embedding of the text:

```json
{
  "embedding": [0.1, ... ]
}
```

#### Inputs:

- `PALM_KEY` required, must contain the Google Cloud Platform API key for the project has the "Generative Language API" API enabled.

- `text` required, text to embed.

#### Outputs:

- `embedding` - result of the PaLM API text embedding, a 768-dimensional array of floating-point numbers.

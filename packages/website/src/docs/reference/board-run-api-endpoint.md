---
layout: docs.liquid
title: Board Run API Endpoint Protocol
tags:
  - reference
  - miscellaneous
---

Describes how to use the Board Run API Endpoint. This API endpoint is different from the [invoke BSE endpoint](../bse/#the-invoke-path) in that it follows the ["Run" mode semantics](/breadboard/docs/reference/runtime-semantics#run-mode).

## Endpoint

`POST {API_URL}`

When using Board Server, it will be the URL of the board, with the `json` extension replaced by `api/run`. For example a board at this location:

```url
http://mycoolboardserver.example.com/boards/@pluto/chat-agent.bgl.json
```

Will have the API endpoint at:

```url
http://mycoolboardserver.example.com/boards/@pluto/chat-agent.bgl.api/run
```

## Authentication

Authentication is performed using an API key.

- Include the API key in the request body with the key `$key`.

## Request

### Headers

- `Content-Type: application/json`

### Body

The request body should be a JSON object with the following structure:

```json
{
  "$key": "YOUR_API_KEY",
  "$next": "OPTIONAL_RESUMPTION_STATE",
  ...inputs
}
```

- `$key` (string, required): The API key. When accessing this endpoint on a Board Server, the Board Server API Key.
- `$next` (string, optional): The state to resume from, if continuing a previous interaction.
- `...inputs` (object, required): The inputs to the board. The structure of this object depends on the specific board being run and must match the schema supplied in the input request.

Example input for initiating request:

```json
{
  "$key": "YOUR_API_KEY",
  "context": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Hello, my name is Pluto! When talking with me, please start by addressing me by name"
        }
      ]
    }
  ]
}
```

Example input for continuing request:

```json
{
  "$key": "YOUR_API_KEY",
  "$next": "RESUME_FROM_THIS_STATE",
  "text": {
    "role": "user",
    "parts": [{ "text": "What is Breadboard?" }]
  }
}
```

You can also initiate request with no inputs. In this case, the response will contain the `input` type response and supply the schema:

```json
{
  "$key": "YOUR_API_KEY"
}
```

## Response

The response is a Server-Sent Events (SSE) stream. Each event in the stream is a serialized JSON object prefixed by `data: ` and separated by `\n\n`.

### Event Format

Each event is an array with two or three elements: `[type, data, next]`. The `next` element is only present when the `type` value is `"input"`.

The `type` can be one of the following:

1. `"input"`
2. `"output"`
3. `"error"`

### Event Types

1. Input Event

```json
["input", {
  "node": { ... },
  "inputArguments": {
    "schema": { ... },
  },
  ...
},
"NEXT_TOKEN"
]
```

- `node` (object): An object describing the the input component that is requesting input. This information can be used to better identify the particular input. For instance, if we're making a frontend app that uses this API, it can use the `id` of the input to associate it with a particular UI element.
- `schema` (object): Describes the expected input schema for the input component. This information can be used to understand the structure of the input being requested.

- `NEXT` (string): A token representing the state to use when resuming the interaction.

2. Output Event

```json
["output", {
  "node": { ... },
  "outputs": { ... },
  ...
}]
```

- `node` (object): Same as above, but for the output component.
- `outputs` (object): Contains the output data from this output component.

3. Error Event

```json
["error", "ERROR_MESSAGE"]
```

- The second element is a string describing the error that occurred.

## Error Handling

- If an error occurs during processing, an error event will be sent in the SSE stream.
- HTTP status codes are used to indicate request-level errors (e.g., 400 for bad requests, 401 for authentication errors).

## Resuming Interactions

To continue an interaction:

1. Extract the `next` value from the most recent input event.
2. Include this value as `$next` in your next request body.

## Examples

### Initiating a conversation

Request:

```http
POST {API_URL} HTTP/1.1
Content-Type: application/json

{
  "$key": "YOUR_API_KEY",
  "context": [
    {
      "role": "user",
      "parts": [{ "text": "Hello, my name is Dimitri! When talking with me, please start by addressing me by name" }]
    }
  ]
}
```

### Continuing a conversation

Request:

```http
POST {API_URL} HTTP/1.1
Content-Type: application/json

{
  "$key": "YOUR_API_KEY",
  "$next": "PREVIOUS_NEXT_VALUE",
  "text": {
    "role": "user",
    "parts": [{ "text": "What is Breadboard?" }]
  }
}
```

## Notes

- The specific structure of inputs and outputs may vary depending on the board being run.
- Always handle the SSE stream properly, parsing each event and acting accordingly based on its type.
- Store the `next` value from input events to enable conversation continuity.

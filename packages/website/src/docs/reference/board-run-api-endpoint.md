---
layout: docs.liquid
title: Board Server API Endpoints
tags:
  - reference
  - miscellaneous
---

This doc describes how to use the Board Server API Endpoints.

Every board has two endpoints:

1. The "invoke" API endpoint that follows the ["Run as component" mode](/breadboard/docs/reference/runtime-semantics#run-as-component-mode) runtime semantics.
2. The "run" API endpoint that follows the ["Run" mode](/breadboard/docs/reference/runtime-semantics#run-mode) runtime semantics.

What's the difference between "invoke" and "run"?

The "invoke" bails on the first "[Output](/breadboard/docs/reference/kits/built-in/#the-output-component)" component it encounters, which makes it very similar to calling a function: any "Output" in the board acts as a `return` statement.

Conversely, "run" continues to run past the "Output" and only stops when the board finishes (which may be never). Use "invoke" when you have a simple board (like a tool) and "run" for boards that have multiple turns or multiple outputs.

# Invoke API Endpoint

`POST {API_URL}`

When using a Board Server, the `API_URL` will be the URL of the board, with the `json` extension replaced by `api/invoke`. For example a board at this location:

```url
http://mycoolboardserver.example.com/boards/@pluto/chat-agent.bgl.json
```

Will have the API endpoint at:

```url
http://mycoolboardserver.example.com/boards/@pluto/chat-agent.bgl.api/invoke
```

The invoke API endpoint is a simple request/response API. The request is a JSON object and a response is a JSON object.

## Authentication

Authentication is performed using the Board Server API key. Include the key in the request body as a property named `$key`.

## Request

### Headers

- `Content-Type: application/json`

### Body

The request body should be a JSON object with the following structure:

```json
{
  "$key": "BOARD_SERVER_API_KEY",
  ...inputs
}
```

- `$key` (string, required): The API key. When accessing this endpoint on a Board Server, the Board Server API Key.
- `...inputs` (object, required): The inputs to the board.

### Providing inputs

The structure of `inputs` depends on the "Input" component that is the entry point into the board. In Breadboard, every "Input" component defines its [input ports](/breadboard/docs/reference/kits/built-in/#input-ports). Most of the time, an "Input" will have just one port, but it is also possible to define many ports per "Input".

> [!TIP]
> A good analogy is to think of the "Input" component as a function call and ports as named arguments for this function call.

Each port has a unique id that helps to distinguish it from other ports within this "Input". This id can be found by looking up the "ID" field in the Schema editor for the "Input" component. For example, this port has the id of `property-1`:

![Input Schema editor expanded](/breadboard/static/images/built-in-kit/input-schema-expanded.png)

The port also has a type that defines the format of the data that the port is expecting. The port definition above expects a "String" type, which is just a string. Supplying valid inputs for the "Input" component with this port will look like this:

```json
{
  "$key": "BOARD_SERVER_API_KEY",
  "property-1": "Mountain View, CA"
}
```

Another common port type used in Breadboard is LLM Content Array. It's a bit of a mouthful, but it's effectively a way to pass conversation context between components. Most of the time, you'll be working with this type, so it's very likely that the input you're encountering will ask for the data in this format. This format is [defined in more detail](https://ai.google.dev/api/caching#Content) in Gemini API reference. In Breadboard, its definition looks like this:

![Input Schema editor of LLM Content Array](/breadboard/static/images/endpoint-docs/llm-content-array-schema.png)

If you just want to send text to the "Input" component with this port type, it will look something like this:

```json
{
  "$key": "BOARD_SERVER_API_KEY",
  "property-3": [
    {
      "role": "user",
      "parts": [
        {
          "text": "A place with all the views and mountains"
        }
      ]
    }
  ]
}
```

> [!TIP]
> To find out what ports the "Input" expects, click on its "Schema" field in Visual Editor and look at the configured ports.

## Response

The response body is a JSON object with the port values of the "Output" component.

```json
{
  ... outputs
}
```

- `... outputs`: the key/value pairs of the "Output" component.

### Invoke API Endpoint Examples

For instance, let's suppose we have a board that has a single "Input" component with "Question" and "Thought" ports and a single "Output" component with the "Prompt" port.

{{ "/breadboard/static/boards/kits/template-prompt-template.bgl.json" | board }}

This board is a good candidate for using with the Invoke API endpoint: it's linear (has no cycles), and it only has one output.

When we look at the schema of the "Input", we see that the ids of the inputs are, respectively, "question" and "thought":

![Invoke Example Schema editor expanded](/breadboard/static/images/endpoint-docs/invoke-example-schema.png)

Thus, the structure of the request will be:

```json
{
  "$key": "BOARD_SERVER_API_KEY",
  "question": "What's the distance between Earth and Moon?",
  "thought": "I need to research the distance between Earth and Moon"
}
```

Now, when we look at the schema of the "Output" component, we see that the id of its single port is "prompt":

![Invoke Example Schema editor expanded](/breadboard/static/images/endpoint-docs/invoke-example-out-schema.png)

So the response we'll get will be:

```json
{
  "prompt": "Question: What's the distance between Earth and Moon?\nThought: I need to research the distance between Earth and Moon"
}
```

> [!TIP]
> By looking at the schemas of "Input" and "Output" component, we can determine the shape of the request and the response of the "invoke" API endpoint.

# Run API Endpoint

`POST {API_URL}`

When using a Board Server, the `API_URL` will be the URL of the board, with the `json` extension replaced by `api/run`. For example a board at this location:

```url
http://mycoolboardserver.example.com/boards/@pluto/chat-agent.bgl.json
```

Will have the API endpoint at:

```url
http://mycoolboardserver.example.com/boards/@pluto/chat-agent.bgl.api/run
```

## Life of a run

A good mental model for a using the "run" API endpoint is that of having a multi-turn conversation with it: you give it a request, it runs for a little bit, and then comes back with a response. Based on the response, you formulate the next request and send it back to the endpoint. It runs again and gives you the next response.

In effect, the endpoint pauses the run of the board and hands the control over to you. When you're ready to resume running, you send the next request.

### When the endpoint pauses

The "run" API endpoint will pause the board whenever it comes across an "[Input](/breadboard/docs/reference/kits/built-in/#the-input-component)" component. Using the multi-turn conversation analogy, the endpoint yields the control of execution to you to provide the input values for the "Input" component, and then resumes running with the provided input values.

### The "next" token

To facilitate this multi-turn interaction, the API endpoint has a concept of a "next" token: a string that identifies the place in the multi-turn conversation and allows the endpoint to resume the next turn of the conversation from that place.

![Sequence Diagram of the Run API endpoint](/breadboard/static/images/endpoint-docs/run-sequence-diagram.png)

When sending a request to the endpoint -- unless this is a very first request -- you typically supply the "next" token along with the request. In return, the board will send you back a new "next" token as part of its response.

When (if) the board finished running, it will return without handing you back a "next" token, indicating that it is done running.

### First request

You can start the multi-turn interaction by sending an empty request (just the board server API key), or, if you know what the first input will be, you can supply the input values as part of first request.

## Authentication

Authentication is performed using the Board Server API key. Include the key in the request body as a property named `$key`.

## Request

### Headers

- `Content-Type: application/json`

### Body

The request body should be a JSON object with the following structure:

```json
{
  "$key": "BOARD_SERVER_API_KEY",
  "$next": "OPTIONAL_RESUMPTION_STATE",
  ...inputs
}
```

- `$key` (string, required): The API key. When accessing this endpoint on a Board Server, the Board Server API Key.
- `$next` (string, optional): The state to resume from, if continuing a previous interaction.
- `...inputs` (object, required): The inputs to the board.

The structure of `inputs` depends on the "Input" component that at which the board is currently paused and follows the same rules as describe in the "[Providing Inputs](#providing-inputs)" section above.

### Request examples

To initiate a new multi-turn interaction, you can send a request with no inputs.

```json
{
  "$key": "BOARD_SERVER_API_KEY"
}
```

Alternatively, you can supply the inputs if you know what "Input" component the board will encounter first. In this case, the "run" API endpoint will initiate the multi-turn interaction and, when it encounters the first "Input", supply these inputs to it.

```json
{
  "$key": "BOARD_SERVER_API_KEY",
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
  "$key": "BOARD_SERVER_API_KEY",
  "$next": "RESUME_FROM_THIS_STATE",
  "text": {
    "role": "user",
    "parts": [{ "text": "What is Breadboard?" }]
  }
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

- `node` (object): An object describing the the "Input" component at which the API endpoint is currently paused. This information can be used to better identify the particular input. For instance, if we're making a frontend app that uses this API, it can use the `id` of the input to associate it with a particular UI element.
- `schema` (object, [JSON Schema](https://json-schema.org/)): Describes the expected input schema for the "Input" component at which the API endpoint is currently paused. This information can be used to understand the structure of the input being requested.

- `NEXT_TOKEN` (string): A token representing the state to use when resuming the multi-turn interaction.

2. Output Event

```json
["output", {
  "node": { ... },
  "outputs": { ... },
  ...
}]
```

- `node` (object): Same as above, but for the "Output" component.
- `outputs` (object): Contains the output data from this "Output" component.

3. Error Event

```json
["error", "ERROR_MESSAGE"]
```

- The second element is a string describing the error that occurred.

## Error Handling

- If an error occurs as part of the running the board, an error event is sent in the SSE stream.
- Otherwise, HTTP status codes are used to indicate request-level errors (e.g., 400 for bad requests, 401 for authentication errors).

## Resuming Interactions

To continue an interaction:

1. Extract the `next` value from the most recent input event.
2. Include this value as `$next` in your next request body.

### Run API Endpoint Examples

### Initiating a conversation

Request:

```http
POST {API_URL} HTTP/1.1
Content-Type: application/json

{
  "$key": "BOARD_SERVER_API_KEY",
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
  "$key": "BOARD_SERVER_API_KEY",
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

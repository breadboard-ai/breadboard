---
layout: docs.njk
title: JSON Kit
tags:
  - kits
---

{% assign src_url = "https://github.com/breadboard-ai/breadboard/tree/main/packages/json-kit/src/nodes/" %}

This kit contains nodes that facilitate wrangling JSON objects. It contains the following nodes: **jsonata**, **validateJson**, and **xmlToJson**.

## The `jsonata` node

{{ "/breadboard/static/boards/kits/json-jsonata.bgl.json" | board }}

Use this node to evaluate a [JSONata](https://jsonata.org/) expressions in your board. JSONata is a versatile JSON query language (a kind of "SQL for JSON"). The node takes a JSON object, applies the JSONata expression to it, and returns the resulting object. See [https://jsonata.org/](https://jsonata.org/) for more details on the JSONata expression language.

### Input ports

![jsonata node input ports](/breadboard/static/images/json-kit/jsonata-inputs.png)

The `jsonata` node has the following input ports:

- **Expression** (id: `expression`) -- required, a string that contains the JSONata expression to evaluate.

- **Raw** (id: `raw`) -- an optional boolean that specifies whether the result of the expression should be passed as-is (`true`), or it should be passed as the `result` output port (`false`, default).

- **JSON** (id: `json`) -- an optional JSON object that will be used as the context for the expression. If `json` is not specified, the node will use all input ports (minus `expression` and `raw`) as the context.

### Output ports

- **Result** (id: `result`) -- the result of the expression, unless `raw` is `true`. In the latter case, the result is treated as the the collection of output ports.

### Example

If we send the set the **Expression** to:

```jsonata
`$join(snippet, '\n')`
```

and then send the following JSON to the **JSON** port:

```json
[
  {
    "snippet": "Question: How old is planet Earth?"
  },
  {
    "snippet": "Thought: I wonder how old planet Earth is?"
  }
]
```

We will get this output from the **Result** port:

```text
Question: How old is planet Earth?
Thought: I wonder how old planet Earth is?"
```

> [!TIP]
> This example is captured in the board above.

### Implementation

- [jsonata.ts]({{src_url}}jsonata.ts)

## validateJson

{{ "/breadboard/static/boards/kits/json-validate-json.bgl.json" | board }}

Evaluates whether a string contains valid JSON that (optionally) conforms to a given JSON Schema.

The most common usage of this node is processing LLM output that contains JSON.

It takes in a string input, and first attempts to parse it as JSON. Because the LLM output commonly surrounds JSON with [Markdown JSON code block](https://www.markdownguide.org/extended-syntax/#syntax-highlighting), the node will look for the first code block like that and only look inside of it. If a code block is not found, it will try to parse the entire output as JSON.

If the string successfully parses into JSON, it will attempt to validate this JSON against a provided schema. If the schema is not supplied, it will declare success.

In any other case, the node will throw an error. As with any Breadboard node, this error can be captured by wiring the `$error` output port (you will need to temporarily turn off "Hide Advanced Ports on Nodes" in Visual Editor Settings to see the port).

### Input ports

![validateJson node input ports](/breadboard/static/images/json-kit/validate-json-inputs.png)

The `validateJson` node has the following input ports:

- **JSON String** (id: `json`) -- the JSON string to parse and validate as JSON

- **Schema** (id: `schema`) -- the JSON Schema to validate the JSON string against (optional). If the schema is not supplied, the JSON validation step is skipped.

- **Strict** (id: `strictSchema`) -- the flag (boolean) to enforce (`true`) or turn off (`false`, default) [strict mode](https://ajv.js.org/strict-mode.html#strict-mode) validation of the supplied JSON (optional)

### Output ports

- **JSON** (id: `json`) -- the validated JSON object (if successful)

### Example

If we set the **Schema** to:

```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "snippet": {
        "type": "string"
      }
    }
  }
}
```

And send the following to **JSON String** input port:

````markdown
Here's the output:

```json
[
  { "snippet": "Question: How old is planet Earth?" },
  { "snippet": "Thought: I wonder how old planet Earth is?" }
]
```
````

We will see the following JSON object on the **JSON** output port:

```json
[
  { "snippet": "Question: How old is planet Earth?" },
  { "snippet": "Thought: I wonder how old planet Earth is?" }
]
```

### Implementation

- [validateJson.ts]({{src_url}}validate-json.ts)

## The `xmlToJson` node

{{ "/breadboard/static/boards/kits/json-xml-to-json.bgl.json" | board }}

Use this node to convert XML to JSON. JSON is a sort of [lingua franca](https://en.wikipedia.org/wiki/Lingua_franca) in Breadboard, so this node is useful when starting with XML data.

This node takes a string as its single input port. It then tries to parse it as XML. If successful, it then converts it to the `alt-json` format that is described in [here](https://developers.google.com/gdata/docs/json).

### Input ports

The `xmlToJson` node has a single input port:

- **XML String** (id: `xml`) -- expects a valid stringified XML

### Output Ports

The `xmlToJson` node has a single output port:

- **JSON** (id: `json`) -- provides a JSON object that represents the supplied XML.

### Example

If we send the following string to **XML String** input port:

```xml
<snippets>
  <snippet title="Snippet 1">Question: How old is planet Earth?</snippet>
  <snippet title="Snippet 2">Thought: I wonder how old planet Earth is?</snippet>
</snippets>
```

We will get this value from **JSON** output port:

```json
[
  "$doc",
  {
    "snippets": {
      "$t": ["  ", "  "],
      "snippet": [
        {
          "$t": ["Question: How old is planet Earth?"],
          "title": "Snippet 1"
        },
        {
          "$t": ["Thought: I wonder how old planet Earth is?"],
          "title": "Snippet 2"
        }
      ]
    }
  }
]
```

### Implementation:

- [xml-to-json.ts]({{src_url}}xml-to-json.ts)

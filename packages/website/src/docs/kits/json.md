---
layout: docs.njk
title: JSON Kit
tags:
  - kits
  - wip
---

{% assign src_url = "https://github.com/breadboard-ai/breadboard/tree/main/packages/json-kit/src/nodes/" %}

This kit contains nodes that facilitate wrangling JSON objects. It contains the following nodes: **jsonata**, **validateJson**, and **xmlToJson**.

## The `jsonata` node

{{ "/breadboard/static/boards/kits/json-jsonata.bgl.json" | board }}

Use this node to evaluate [JSONata](https://jsonata.org/) expressions in your board. JSONata is a versatile JSON query language (a kind of "SQL for JSON"). The node takes a JSON object, applies the JSONata expression to it, and returns the resulting object.
See [https://jsonata.org/](https://jsonata.org/) for more details on the JSONata expression language.

### Input ports

![jsonata node input ports](/breadboard/static/images/json-kit/jsonata-inputs.png)

The `jsonata` node has the following input ports:

- `expression` -- required, a string that contains the JSONata expression to evaluate.

- `raw` -- an optional boolean that specifies whether the result of the expression should be passed as-is (`true`), or it should be passed as the `result` output port (`false`, default).

- `json` -- an optional JSON object that will be used as the context for the expression. If `json` is not specified, the node will use all input ports (minus `expression` and `raw`) as the context.

### Output ports

- `result` -- the result of the expression, unless `raw` is `true`. In the latter case, the result is treated as the the collection of output ports.

### Example

If we send the set the `expression` to:

```jsonata
`$join(snippet, '\n')`
```

and then send the following JSON to the `json` port:

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

We will get this output from the `result` port:

```text
Question: How old is planet Earth?
Thought: I wonder how old planet Earth is?"
```

> [!TIP]
> This example is captured in the board above.

### Implementation

- [jsonata.ts]({{src_url}}jsonata.ts)

## validateJson

Validates given JSON against a given JSON Schema.

## The `xmlToJson` node

Use this node to convert XML to JSON. Most nodes in the starter kit are designed to work with JSON, so this node is useful when you have XML data.

This nodes takes one required `xml` property, which it treats as XML and converts to it to JSON as the `json` output property. The format of JSON follows the `alt-json` convention that is described in https://developers.google.com/gdata/docs/json.

### Example

If we send the following inputs to `xml-to-json`:

```json
{
  "xml": "<root><question>How old is planet Earth?</question><thought>I wonder how old planet Earth is?</thought></root>"
}
```

We will get this output:

```json
{
  "json": {
    "root": {
      "question": { "$t": "How old is planet Earth?" },
      "thought": { "$t": "I wonder how old planet Earth is?" }
    }
  }
}
```

### Inputs:

- `xml` - required, must contain a string that represents XML.

### Outputs:

- `json` - the result of converting XML to JSON.

### Implementation:

- [xml-to-json.ts]({{src_url}}xml-to-json.ts)

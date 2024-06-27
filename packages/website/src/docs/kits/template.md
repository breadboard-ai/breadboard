---
layout: docs.njk
title: Template Kit
tags:
  - kits
---

{% assign src_url = "https://github.com/breadboard-ai/breadboard/tree/main/packages/template-kit/src/nodes/" %}

This kit contains two nodes: **promptTemplate** and **urlTemplate**. Both are intended to facilitate the often-necessary string-munging when working with LLMs or accessing APIs.

## The `promptTemplate` node

{{ "/breadboard/static/boards/kits/template-prompt-template.bgl.json" | board }}

Use this node to populate simple handlebar-style templates. It takes a string template that can contain zero or more placeholders that will be replaced with values from inputs.

Specify placeholders in the handlebar-style in format -- like `{{inputName}}` in the template. The placeholders in the template will pop up as input ports for the node, ready to be wired in. The node will replace all placeholders with values from the wired in input ports and pass the result along as output.

### Input ports

The `promptTemplate` node has a variable number of input ports.

![promptTemplate node input ports](/breadboard/static/images/template-kit/prompt-template-inputs.png)

- **Template** (id: `template`) -- the template to fill out. Required.

- **Placeholder input ports** -- zero or more additional ports that will be used to replace placeholders in the template.

### Output ports

The `promptTemplate` node has a single output:

- **Prompt** (id: `prompt`) -- a string that contains the result of replacing placeholders in the **Template** with values from the placeholder input ports.

### Example

If we set our **Prompt** to:

```markdown{% raw %}
Question: {{question}}
Thought: {{thought}}
{% endraw %}
```

And then send "How old is planet Earth" to the **question** input port along with "I wonder how old planet Earth is?" to the **thought** input port, we will get this **Result**:

```markdown
Question: How old is planet Earth?
Thought: I wonder how old planet Earth is?
```

> [!TIP]
> This example is captured in the board above.

### Implementation:

- [prompt-template.ts]({{src_url}}prompt-template.ts)

## The `urlTemplate` node

{{ "/breadboard/static/boards/kits/template-url-template.bgl.json" | board }}

Use this node to safely construct URLs. It's similar in spirit to the `promptTemplate` node, except it ensures that the handlebar parameters are properly encoded as part of the URL. This node relies on the [URI template specification](https://tools.ietf.org/html/rfc6570) to construct URLs, so the syntax is using single curly braces instead of double curly braces.

### Input ports

The `urlTemplate` node has a variable number of input ports.

- **Template** (id: `template`) -- required, a template for the URL. It can contain zero or more placeholders that will be replaced with values from the input property bag. Specify placeholders as `{propertyName}` in the template.

- **Placeholder input ports** -- zero or more inputs that will be used to replace placeholders in the template.

### Outputs ports

The `urlTemplate` node has a single output port.

- `url` a string that contains the result of replacing placeholders in the template with values from the inputs.

### Example

If we set the **Template** to:

```url
https://www.googleapis.com/books/v1/volumes?q={query}&orderBy=relevance
```

And send "utopian sci-fi" to the **query** input, we will see this at the **URL** output:

```url
https://www.googleapis.com/books/v1/volumes?q=utopian%20sci-fi&orderBy=relevance
```

### Implementation

- [url-template.ts]({{src_url}}url-template.ts)

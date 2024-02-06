@google-labs/template-kit / [Exports](modules.md)

# Template Kit

![Milestone](https://img.shields.io/badge/milestone-M4-red) ![Stability](https://img.shields.io/badge/stability-wip-green)

The Template Kit is a collection of [Breadboard](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard) nodes that are helpful for templating.

## Installing

The Template Kit requires Node version >=v19.0.0. To install:

```sh
npm install @google-labs/template-kit
```

## Node Types

Here are all node handlers that are included in the Template Kit.

### The `promptTemplate` node

Use this node to populate simple handlebar-style templates. A required input is `template`, which is a string that contains the template prompt template. The template can contain zero or more placeholders that will be replaced with values from inputs. Specify placeholders as `{{inputName}}` in the template. The placeholders in the template must match the inputs wired into this node. The node will replace all placeholders with values from the input property bag and pass the result along as the `prompt` output property.

#### Example:

If we send the following inputs to `promptTemplate`:

```json
{
  "template": "Question: {{question}}\nThought: {{thought}}",
  "question": "How old is planet Earth?",
  "thought": "I wonder how old planet Earth is?"
}
```

We will get this output:

```json
{
  "prompt": "Question: How old is planet Earth?\nThought: I wonder how old planet Earth is?"
}
```

#### Inputs:

- `template` - required property
- zero or more inputs that will be used to replace placeholders in the template.

#### Outputs:

- `prompt` a string that contains the result of replacing placeholders in the template with values from the inputs.

#### Implementation:

- [src/nodes/prompt-template.ts](src/nodes/prompt-template.ts)

### The `urlTemplate` node

Use this node to safely construct URLs. It's similar in spirit to the `promptTemplate` node, except it ensures that the handlebar parameters are properly encoded as part of the URL. This node relies on the [URI template specification](https://tools.ietf.org/html/rfc6570) to construct URLs, so the syntax is using single curly braces instead of double curly braces.

#### Example:

If we send the following inputs to `urlTemplate`:

```json
{
  "template": "https://example.com?question={question}",
  "question": "How old is planet Earth?"
}
```

We will get this output:

```json
{
  "url": "https://example.com?question=How%20old%20is%20planet%20Earth%3F"
}
```

#### Inputs:

- `template` -- required, a template for the URL. It can contain zero or more placeholders that will be replaced with values from the input property bag. Specify placeholders as `{propertyName}` in the template.
- zero or more inputs that will be used to replace placeholders in the template.

#### Outputs:

- `url` a string that contains the result of replacing placeholders in the template with values from the inputs.

#### Implementation:

- [src/nodes/url-template.ts](src/nodes/url-template.ts)

# Template Kit

The Template Kit provides text templating capabilities with variable substitution for Breadboard boards.

## Overview

The `template` node enables dynamic text generation by substituting variables within template strings using the `{{variableName}}` syntax.

## Basic Usage

```typescript
import { board } from "@breadboard-ai/build";
import { template } from "@google-labs/template-kit";

const myBoard = board({
  inputs: {
    userName: { type: "string", description: "Name of the user" },
    topic: { type: "string", description: "Topic to discuss" }
  },
  outputs: {
    message: { type: "string" }
  }
}, async ({ userName, topic }) => {
  const greeting = template({
    template: "Hello {{userName}}, let's talk about {{topic}}."
  });
  
  return {
    message: greeting({ userName, topic })
  };
});
```

## Template Syntax

Templates use double curly braces for variable interpolation:

- `{{variableName}}` - Replaced with the value of the input port named `variableName`
- Variables are replaced as strings
- Undefined variables result in empty strings or errors depending on configuration

## Input/Output Wiring

Template variables are wired as inputs to the template node:

```typescript
const promptTemplate = template({
  template: `Context: {{context}}
Question: {{question}}
Answer:`
});

// Wire inputs
promptTemplate.wire("context", contextInput);
promptTemplate.wire("question", questionInput);

// Or inline
const result = promptTemplate({
  context: "Some context",
  question: "The question?"
});
```

## Schema Definitions

Define input schemas for type safety and documentation:

```typescript
import { input } from "@breadboard-ai/build";

const contextInput = input({
  type: "string",
  description: "Background context for the prompt",
  title: "Context"
});

const questionInput = input({
  type: "string",
  description: "The question to answer",
  title: "Question"
});

const board = {
  inputs: {
    context: contextInput,
    question: questionInput
  },
  // ... rest of board definition
};
```

## Integration with LLM Nodes

Templates are commonly used to construct prompts for LLM nodes:

```typescript
import { gemini } from "@google-labs/gemini-kit";

const board = {
  inputs: {
    userQuery: { type: "string" },
    systemContext: { type: "string" }
  },
  outputs: {
    response: { type: "string" }
  }
}, async (inputs) => {
  // Create prompt template
  const prompt = template({
    template: `System: {{systemContext}}
    
User: {{userQuery}}
    
Assistant:`
  });
  
  // Wire template inputs
  const formattedPrompt = prompt({
    systemContext: inputs.systemContext,
    userQuery: inputs.userQuery
  });
  
  // Pass to Gemini
  const response = gemini({
    text: formattedPrompt,
    model: "gemini-1.5-flash"
  });
  
  return { response };
});
```

## Nested Templates

Compose complex templates by nesting:

```typescript
const header = template({
  template: "# {{title}}\n\n"
});

const body = template({
  template: "{{header}}Content: {{content}}\nFooter: {{footer}}"
});

// Chain templates
const headerResult = header({ title: "My Doc" });
const final = body({
  header: headerResult,
  content: "Main content here",
  footer: "End of document"
});
```

## Conditional Logic

Use conditional expressions within templates:

```typescript
const conditionalTemplate = template({
  template: `Hello {{name}}{{^name}}there{{/name}}!`
});
```

Or handle conditionals in the board logic:

```typescript
const board = async (inputs) => {
  const template = inputs.includeDetails 
    ? "Details: {{details}}"
    : "Summary: {{summary}}";
    
  return template({ ... });
};
```

## Best Practices

1. **Use descriptive variable names**: Prefer `{{userName}}` over `{{n}}`
2. **Define schemas**: Always specify input types and descriptions
3. **Sanitize inputs**: Validate user input before templating
4. **Handle optional values**: Use conditional logic for optional template variables
5. **Separate concerns**: Use multiple template nodes rather than one complex template

## Error Handling

The template node throws errors when:
- Required template variables are not provided
- The template string is null or undefined

Always ensure all referenced variables in `{{}}` are provided as inputs.
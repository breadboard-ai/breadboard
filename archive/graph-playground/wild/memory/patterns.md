## Assistant many, user many, one output

```mermaid
graph TD;
  passthrough -- accumulator-> --> rememberUser
  user-- text->User -->rememberUser
  assistant-- text->Assistant -->rememberAssistant
  rememberUser-- accumulator-> -->rememberAssistant
  rememberAssistant-- accumulator-> -->rememberUser
  rememberAssistant-- accumulator->memory -->template
```

## Assistant many, user once, one output

This is a pattern where the accumulator is initialized by user query.

- Two actors: assistant and user
- One output (template)

```mermaid
graph TD;
  user-- text->User -->rememberUser
  assistant-- text->Assistant -->rememberAssistant
  rememberUser-- accumulator-> -->rememberAssistant
  rememberAssistant-- accumulator-> -->rememberAssistant
  rememberAssistant-- accumulator->memory -->template
```

## MemoryPatternOne

```mermaid
graph TD;
  rememberObservation -- accumulator->memory --> template
  llm -- completion->Thought --> rememberThought
  tool -- result->Observation --> rememberObservation
  user -- text->Question --> rememberQuestion
  rememberThought -- accumulator-> --> rememberObservation
  rememberObservation -- accumulator-> --> rememberThought
  rememberQuestion -- accumulator-> --> rememberThought
  rememberQuestion -- accumulator->memory --> template
```

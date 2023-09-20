[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / GenerateMessageResponse

# Interface: GenerateMessageResponse

The response from the model. This includes candidate messages and conversation history in the form of chronologically-ordered messages.

## Table of contents

### Properties

- [candidates](GenerateMessageResponse.md#candidates)
- [filters](GenerateMessageResponse.md#filters)
- [messages](GenerateMessageResponse.md#messages)

## Properties

### candidates

• `Optional` **candidates**: [`Message`](Message.md)[]

Candidate response messages from the model.

#### Defined in

[types.ts:127](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L127)

___

### filters

• `Optional` **filters**: [`ContentFilter`](ContentFilter.md)[]

A set of content filtering metadata for the prompt and response text. This indicates which `SafetyCategory`(s) blocked a candidate from this response, the lowest `HarmProbability` that triggered a block, and the HarmThreshold setting for that category.

#### Defined in

[types.ts:131](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L131)

___

### messages

• `Optional` **messages**: [`Message`](Message.md)[]

The conversation history used by the model.

#### Defined in

[types.ts:135](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L135)

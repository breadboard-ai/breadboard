[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / GenerateTextResponse

# Interface: GenerateTextResponse

The response from the model, including candidate completions.

## Table of contents

### Properties

- [candidates](GenerateTextResponse.md#candidates)
- [filters](GenerateTextResponse.md#filters)
- [safetyFeedback](GenerateTextResponse.md#safetyfeedback)

## Properties

### candidates

• `Optional` **candidates**: [`TextCompletion`](TextCompletion.md)[]

Candidate responses from the model.

#### Defined in

[types.ts:179](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L179)

___

### filters

• `Optional` **filters**: [`ContentFilter`](ContentFilter.md)[]

A set of content filtering metadata for the prompt and response text. This indicates which `SafetyCategory`(s) blocked a candidate from this response, the lowest `HarmProbability` that triggered a block, and the HarmThreshold setting for that category. This indicates the smallest change to the `SafetySettings` that would be necessary to unblock at least 1 response. The blocking is configured by the `SafetySettings` in the request (or the default `SafetySettings` of the API).

#### Defined in

[types.ts:183](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L183)

___

### safetyFeedback

• `Optional` **safetyFeedback**: [`SafetyFeedback`](SafetyFeedback.md)[]

Returns any safety feedback related to content filtering.

#### Defined in

[types.ts:187](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L187)

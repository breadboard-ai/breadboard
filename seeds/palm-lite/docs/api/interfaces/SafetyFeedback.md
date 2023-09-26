[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / SafetyFeedback

# Interface: SafetyFeedback

Safety feedback for an entire request. This field is populated if content in the input and/or response is blocked due to safety settings. SafetyFeedback may not exist for every HarmCategory. Each SafetyFeedback will return the safety settings used by the request as well as the lowest HarmProbability that should be allowed in order to return a result.

## Table of contents

### Properties

- [rating](SafetyFeedback.md#rating)
- [setting](SafetyFeedback.md#setting)

## Properties

### rating

• `Optional` **rating**: [`SafetyRating`](SafetyRating.md)

Safety rating evaluated from content.

#### Defined in

[types.ts:287](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L287)

___

### setting

• `Optional` **setting**: [`SafetySetting`](SafetySetting.md)

Safety settings applied to the request.

#### Defined in

[types.ts:291](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L291)

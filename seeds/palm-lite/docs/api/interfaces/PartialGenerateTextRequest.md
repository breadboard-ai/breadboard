[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / PartialGenerateTextRequest

# Interface: PartialGenerateTextRequest

Partial `GenerateTextRequest` object, for use with the `Text` class.
It's basically the same as `GenerateTextRequest`, except that `prompt` is optional.

## Hierarchy

- `Omit`<[`GenerateTextRequest`](GenerateTextRequest.md), ``"prompt"``\>

  ↳ **`PartialGenerateTextRequest`**

## Table of contents

### Properties

- [candidateCount](PartialGenerateTextRequest.md#candidatecount)
- [maxOutputTokens](PartialGenerateTextRequest.md#maxoutputtokens)
- [prompt](PartialGenerateTextRequest.md#prompt)
- [safetySettings](PartialGenerateTextRequest.md#safetysettings)
- [stopSequences](PartialGenerateTextRequest.md#stopsequences)
- [temperature](PartialGenerateTextRequest.md#temperature)
- [topK](PartialGenerateTextRequest.md#topk)
- [topP](PartialGenerateTextRequest.md#topp)

## Properties

### candidateCount

• `Optional` **candidateCount**: `number`

Number of generated responses to return. This value must be between [1, 8], inclusive. If unset, this will default to 1.

#### Inherited from

Omit.candidateCount

#### Defined in

[types.ts:143](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L143)

___

### maxOutputTokens

• `Optional` **maxOutputTokens**: `number`

The maximum number of tokens to include in a candidate. If unset, this will default to 64.

#### Inherited from

Omit.maxOutputTokens

#### Defined in

[types.ts:147](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L147)

___

### prompt

• `Optional` **prompt**: [`TextPrompt`](TextPrompt.md)

#### Defined in

[text.ts:29](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L29)

___

### safetySettings

• `Optional` **safetySettings**: [`SafetySetting`](SafetySetting.md)[]

A list of unique `SafetySetting` instances for blocking unsafe content. that will be enforced on the `GenerateTextRequest.prompt` and `GenerateTextResponse.candidates`. There should not be more than one setting for each `SafetyCategory` type. The API will block any prompts and responses that fail to meet the thresholds set by these settings. This list overrides the default settings for each `SafetyCategory` specified in the safety_settings. If there is no `SafetySetting` for a given `SafetyCategory` provided in the list, the API will use the default safety setting for that category.

#### Inherited from

Omit.safetySettings

#### Defined in

[types.ts:155](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L155)

___

### stopSequences

• `Optional` **stopSequences**: `string`[]

The set of character sequences (up to 5) that will stop output generation. If specified, the API will stop at the first appearance of a stop sequence. The stop sequence will not be included as part of the response.

#### Inherited from

Omit.stopSequences

#### Defined in

[types.ts:159](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L159)

___

### temperature

• `Optional` **temperature**: `number`

Controls the randomness of the output. Note: The default value varies by model, see the `Model.temperature` attribute of the `Model` returned the `getModel` function. Values can range from [0.0,1.0], inclusive. A value closer to 1.0 will produce responses that are more varied and creative, while a value closer to 0.0 will typically result in more straightforward responses from the model.

#### Inherited from

Omit.temperature

#### Defined in

[types.ts:163](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L163)

___

### topK

• `Optional` **topK**: `number`

The maximum number of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Top-k sampling considers the set of `top_k` most probable tokens. Defaults to 40. Note: The default value varies by model, see the `Model.top_k` attribute of the `Model` returned the `getModel` function.

#### Inherited from

Omit.topK

#### Defined in

[types.ts:167](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L167)

___

### topP

• `Optional` **topP**: `number`

The maximum cumulative probability of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Tokens are sorted based on their assigned probabilities so that only the most liekly tokens are considered. Top-k sampling directly limits the maximum number of tokens to consider, while Nucleus sampling limits number of tokens based on the cumulative probability. Note: The default value varies by model, see the `Model.top_p` attribute of the `Model` returned the `getModel` function.

#### Inherited from

Omit.topP

#### Defined in

[types.ts:171](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L171)

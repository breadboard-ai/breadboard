[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / GenerateTextRequest

# Interface: GenerateTextRequest

Request to generate a text completion response from the model.

## Implemented by

- [`Text`](../classes/Text.md)

## Table of contents

### Properties

- [candidateCount](GenerateTextRequest.md#candidatecount)
- [maxOutputTokens](GenerateTextRequest.md#maxoutputtokens)
- [prompt](GenerateTextRequest.md#prompt)
- [safetySettings](GenerateTextRequest.md#safetysettings)
- [stopSequences](GenerateTextRequest.md#stopsequences)
- [temperature](GenerateTextRequest.md#temperature)
- [topK](GenerateTextRequest.md#topk)
- [topP](GenerateTextRequest.md#topp)

## Properties

### candidateCount

• `Optional` **candidateCount**: `number`

Number of generated responses to return. This value must be between [1, 8], inclusive. If unset, this will default to 1.

#### Defined in

[types.ts:143](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L143)

___

### maxOutputTokens

• `Optional` **maxOutputTokens**: `number`

The maximum number of tokens to include in a candidate. If unset, this will default to 64.

#### Defined in

[types.ts:147](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L147)

___

### prompt

• `Optional` **prompt**: [`TextPrompt`](TextPrompt.md)

Required. The free-form input text given to the model as a prompt. Given a prompt, the model will generate a TextCompletion response it predicts as the completion of the input text.

#### Defined in

[types.ts:151](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L151)

___

### safetySettings

• `Optional` **safetySettings**: [`SafetySetting`](SafetySetting.md)[]

A list of unique `SafetySetting` instances for blocking unsafe content. that will be enforced on the `GenerateTextRequest.prompt` and `GenerateTextResponse.candidates`. There should not be more than one setting for each `SafetyCategory` type. The API will block any prompts and responses that fail to meet the thresholds set by these settings. This list overrides the default settings for each `SafetyCategory` specified in the safety_settings. If there is no `SafetySetting` for a given `SafetyCategory` provided in the list, the API will use the default safety setting for that category.

#### Defined in

[types.ts:155](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L155)

___

### stopSequences

• `Optional` **stopSequences**: `string`[]

The set of character sequences (up to 5) that will stop output generation. If specified, the API will stop at the first appearance of a stop sequence. The stop sequence will not be included as part of the response.

#### Defined in

[types.ts:159](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L159)

___

### temperature

• `Optional` **temperature**: `number`

Controls the randomness of the output. Note: The default value varies by model, see the `Model.temperature` attribute of the `Model` returned the `getModel` function. Values can range from [0.0,1.0], inclusive. A value closer to 1.0 will produce responses that are more varied and creative, while a value closer to 0.0 will typically result in more straightforward responses from the model.

#### Defined in

[types.ts:163](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L163)

___

### topK

• `Optional` **topK**: `number`

The maximum number of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Top-k sampling considers the set of `top_k` most probable tokens. Defaults to 40. Note: The default value varies by model, see the `Model.top_k` attribute of the `Model` returned the `getModel` function.

#### Defined in

[types.ts:167](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L167)

___

### topP

• `Optional` **topP**: `number`

The maximum cumulative probability of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Tokens are sorted based on their assigned probabilities so that only the most liekly tokens are considered. Top-k sampling directly limits the maximum number of tokens to consider, while Nucleus sampling limits number of tokens based on the cumulative probability. Note: The default value varies by model, see the `Model.top_p` attribute of the `Model` returned the `getModel` function.

#### Defined in

[types.ts:171](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L171)

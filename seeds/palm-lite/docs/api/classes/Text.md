[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / Text

# Class: Text

A convenience builder for text-like requests.

Implements `GenerateTextRequest` interface.

Example:

```typescript
const text = new Text();
text.text("Hello there!");
const data = await fetch(palm(PALM_KEY).text(text));
const response = await data.json();
```

## Implements

- [`GenerateTextRequest`](../interfaces/GenerateTextRequest.md)

## Table of contents

### Constructors

- [constructor](Text.md#constructor)

### Properties

- [candidateCount](Text.md#candidatecount)
- [maxOutputTokens](Text.md#maxoutputtokens)
- [prompt](Text.md#prompt)
- [safetySettings](Text.md#safetysettings)
- [stopSequences](Text.md#stopsequences)
- [temperature](Text.md#temperature)
- [topK](Text.md#topk)
- [topP](Text.md#topp)

### Methods

- [addSafetySetting](Text.md#addsafetysetting)
- [addStopSequence](Text.md#addstopsequence)
- [text](Text.md#text)

## Constructors

### constructor

• **new Text**(`request?`)

Creates a new instance of a `GenerateTextRequest` builder. You can pass this instance directly into `palm().text()`. The builder follows the typical pattern of builder classes, where you can chain methods together to build the request, like so:

```typescript
const text = new Text();
text
.text("Hello there!").
.addSafetySetting("HARM_CATEGORY_DEROGATORY", "BLOCK_LOW_AND_ABOVE")
.addStopSequence("==");
const data = await fetch(palm(PALM_KEY).text(text));
const response = await data.json();
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `request?` | [`PartialGenerateTextRequest`](../interfaces/PartialGenerateTextRequest.md) | A partial request object. Just put things like `temperature` and `candidateCount` into it and they will be used in the built instance. |

#### Defined in

[text.ts:70](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L70)

## Properties

### candidateCount

• `Optional` **candidateCount**: `number`

Number of generated responses to return. This value must be between [1, 8], inclusive. If unset, this will default to 1.

#### Implementation of

[GenerateTextRequest](../interfaces/GenerateTextRequest.md).[candidateCount](../interfaces/GenerateTextRequest.md#candidatecount)

#### Defined in

[text.ts:47](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L47)

___

### maxOutputTokens

• `Optional` **maxOutputTokens**: `number`

The maximum number of tokens to include in a candidate. If unset, this will default to 64.

#### Implementation of

[GenerateTextRequest](../interfaces/GenerateTextRequest.md).[maxOutputTokens](../interfaces/GenerateTextRequest.md#maxoutputtokens)

#### Defined in

[text.ts:48](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L48)

___

### prompt

• **prompt**: [`TextPrompt`](../interfaces/TextPrompt.md)

Required. The free-form input text given to the model as a prompt. Given a prompt, the model will generate a TextCompletion response it predicts as the completion of the input text.

#### Implementation of

[GenerateTextRequest](../interfaces/GenerateTextRequest.md).[prompt](../interfaces/GenerateTextRequest.md#prompt)

#### Defined in

[text.ts:49](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L49)

___

### safetySettings

• `Optional` **safetySettings**: [`SafetySetting`](../interfaces/SafetySetting.md)[]

A list of unique `SafetySetting` instances for blocking unsafe content. that will be enforced on the `GenerateTextRequest.prompt` and `GenerateTextResponse.candidates`. There should not be more than one setting for each `SafetyCategory` type. The API will block any prompts and responses that fail to meet the thresholds set by these settings. This list overrides the default settings for each `SafetyCategory` specified in the safety_settings. If there is no `SafetySetting` for a given `SafetyCategory` provided in the list, the API will use the default safety setting for that category.

#### Implementation of

[GenerateTextRequest](../interfaces/GenerateTextRequest.md).[safetySettings](../interfaces/GenerateTextRequest.md#safetysettings)

#### Defined in

[text.ts:50](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L50)

___

### stopSequences

• `Optional` **stopSequences**: `string`[]

The set of character sequences (up to 5) that will stop output generation. If specified, the API will stop at the first appearance of a stop sequence. The stop sequence will not be included as part of the response.

#### Implementation of

[GenerateTextRequest](../interfaces/GenerateTextRequest.md).[stopSequences](../interfaces/GenerateTextRequest.md#stopsequences)

#### Defined in

[text.ts:51](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L51)

___

### temperature

• `Optional` **temperature**: `number`

Controls the randomness of the output. Note: The default value varies by model, see the `Model.temperature` attribute of the `Model` returned the `getModel` function. Values can range from [0.0,1.0], inclusive. A value closer to 1.0 will produce responses that are more varied and creative, while a value closer to 0.0 will typically result in more straightforward responses from the model.

#### Implementation of

[GenerateTextRequest](../interfaces/GenerateTextRequest.md).[temperature](../interfaces/GenerateTextRequest.md#temperature)

#### Defined in

[text.ts:52](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L52)

___

### topK

• `Optional` **topK**: `number`

The maximum number of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Top-k sampling considers the set of `top_k` most probable tokens. Defaults to 40. Note: The default value varies by model, see the `Model.top_k` attribute of the `Model` returned the `getModel` function.

#### Implementation of

[GenerateTextRequest](../interfaces/GenerateTextRequest.md).[topK](../interfaces/GenerateTextRequest.md#topk)

#### Defined in

[text.ts:53](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L53)

___

### topP

• `Optional` **topP**: `number`

The maximum cumulative probability of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Tokens are sorted based on their assigned probabilities so that only the most liekly tokens are considered. Top-k sampling directly limits the maximum number of tokens to consider, while Nucleus sampling limits number of tokens based on the cumulative probability. Note: The default value varies by model, see the `Model.top_p` attribute of the `Model` returned the `getModel` function.

#### Implementation of

[GenerateTextRequest](../interfaces/GenerateTextRequest.md).[topP](../interfaces/GenerateTextRequest.md#topp)

#### Defined in

[text.ts:54](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L54)

## Methods

### addSafetySetting

▸ **addSafetySetting**(`category`, `threshold`): [`Text`](Text.md)

Helper for adding a `SafetySetting` to the request.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `category` | `undefined` \| ``"HARM_CATEGORY_UNSPECIFIED"`` \| ``"HARM_CATEGORY_DEROGATORY"`` \| ``"HARM_CATEGORY_TOXICITY"`` \| ``"HARM_CATEGORY_VIOLENCE"`` \| ``"HARM_CATEGORY_SEXUAL"`` \| ``"HARM_CATEGORY_MEDICAL"`` \| ``"HARM_CATEGORY_DANGEROUS"`` | A valid `SafetyCategory` enum value. |
| `threshold` | `undefined` \| ``"HARM_BLOCK_THRESHOLD_UNSPECIFIED"`` \| ``"BLOCK_LOW_AND_ABOVE"`` \| ``"BLOCK_MEDIUM_AND_ABOVE"`` \| ``"BLOCK_ONLY_HIGH"`` | A valid `SafetyThreshold` enum value. |

#### Returns

[`Text`](Text.md)

The builder instance.

#### Defined in

[text.ts:90](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L90)

___

### addStopSequence

▸ **addStopSequence**(`sequence`): [`Text`](Text.md)

Helper for adding a stop sequence to the request.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `sequence` | `string` | A stop sequence to add to the request. |

#### Returns

[`Text`](Text.md)

The builder instance.

#### Defined in

[text.ts:101](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L101)

___

### text

▸ **text**(`text`): [`Text`](Text.md)

Helper for setting the `text` property of the prompt.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `text` | `string` | Prompt text |

#### Returns

[`Text`](Text.md)

The builder instance.

#### Defined in

[text.ts:79](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L79)

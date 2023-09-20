[@google-labs/palm-lite](README.md) / Exports

# @google-labs/palm-lite

## Table of contents

### Enumerations

- [PalmModelMethod](enums/PalmModelMethod.md)

### Classes

- [Chat](classes/Chat.md)
- [Text](classes/Text.md)

### Interfaces

- [CitationMetadata](interfaces/CitationMetadata.md)
- [CitationSource](interfaces/CitationSource.md)
- [ContentFilter](interfaces/ContentFilter.md)
- [CountMessageTokensRequest](interfaces/CountMessageTokensRequest.md)
- [CountMessageTokensResponse](interfaces/CountMessageTokensResponse.md)
- [EmbedTextRequest](interfaces/EmbedTextRequest.md)
- [EmbedTextResponse](interfaces/EmbedTextResponse.md)
- [Embedding](interfaces/Embedding.md)
- [Example](interfaces/Example.md)
- [GenerateMessageRequest](interfaces/GenerateMessageRequest.md)
- [GenerateMessageResponse](interfaces/GenerateMessageResponse.md)
- [GenerateTextRequest](interfaces/GenerateTextRequest.md)
- [GenerateTextResponse](interfaces/GenerateTextResponse.md)
- [ListModelsResponse](interfaces/ListModelsResponse.md)
- [Message](interfaces/Message.md)
- [MessagePrompt](interfaces/MessagePrompt.md)
- [Model](interfaces/Model.md)
- [PartialGenerateMessageRequest](interfaces/PartialGenerateMessageRequest.md)
- [PartialGenerateTextRequest](interfaces/PartialGenerateTextRequest.md)
- [SafetyFeedback](interfaces/SafetyFeedback.md)
- [SafetyRating](interfaces/SafetyRating.md)
- [SafetySetting](interfaces/SafetySetting.md)
- [TextCompletion](interfaces/TextCompletion.md)
- [TextPrompt](interfaces/TextPrompt.md)

### Type Aliases

- [SafetyCategory](modules.md#safetycategory)
- [SafetyThreshold](modules.md#safetythreshold)

### Functions

- [palm](modules.md#palm)

## Type Aliases

### SafetyCategory

Ƭ **SafetyCategory**: typeof [`category`](interfaces/SafetySetting.md#category)

Enum of valid categories in `SafetySetting` object.

#### Defined in

[text.ts:17](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L17)

___

### SafetyThreshold

Ƭ **SafetyThreshold**: typeof [`threshold`](interfaces/SafetySetting.md#threshold)

Enum of valid thresholds in `SafetySetting` object.

#### Defined in

[text.ts:21](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/text.ts#L21)

## Functions

### palm

▸ **palm**(`apiKey`): `PaLM`

The entry point into the `palm-lite` library. Usage:
```typescript
import { palm } from "palm-lite";

// Make sure to set the PALM_KEY environment variable.
const PALM_KEY = process.env.PALM_KEY;
const request = palm(PALM_KEY).message({
  prompt: {
    messages: [ { content: "Hello there!" } ],
  },
});
const data = await fetch(request);
const response = await data.json();
console.log(response.candidates[0].content);
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `apiKey` | `string` | PaLM API key |

#### Returns

`PaLM`

Returns an object that lets you make `message`, `text`, and `embedding` request to PaLM API.

#### Defined in

[index.ts:118](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/index.ts#L118)

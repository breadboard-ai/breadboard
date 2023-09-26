[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / GenerateMessageRequest

# Interface: GenerateMessageRequest

Request to generate a message response from the model.

## Implemented by

- [`Chat`](../classes/Chat.md)

## Table of contents

### Properties

- [candidateCount](GenerateMessageRequest.md#candidatecount)
- [prompt](GenerateMessageRequest.md#prompt)
- [temperature](GenerateMessageRequest.md#temperature)
- [topK](GenerateMessageRequest.md#topk)
- [topP](GenerateMessageRequest.md#topp)

## Properties

### candidateCount

• `Optional` **candidateCount**: `number`

Optional. The number of generated response messages to return. This value must be between `[1, 8]`, inclusive. If unset, this will default to `1`.

#### Defined in

[types.ts:103](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L103)

___

### prompt

• `Optional` **prompt**: [`MessagePrompt`](MessagePrompt.md)

Required. The structured textual input given to the model as a prompt. Given a prompt, the model will return what it predicts is the next message in the discussion.

#### Defined in

[types.ts:107](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L107)

___

### temperature

• `Optional` **temperature**: `number`

Optional. Controls the randomness of the output. Values can range over `[0.0,1.0]`, inclusive. A value closer to `1.0` will produce responses that are more varied, while a value closer to `0.0` will typically result in less surprising responses from the model.

#### Defined in

[types.ts:111](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L111)

___

### topK

• `Optional` **topK**: `number`

Optional. The maximum number of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Top-k sampling considers the set of `top_k` most probable tokens.

#### Defined in

[types.ts:115](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L115)

___

### topP

• `Optional` **topP**: `number`

Optional. The maximum cumulative probability of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Nucleus sampling considers the smallest set of tokens whose probability sum is at least `top_p`.

#### Defined in

[types.ts:119](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L119)

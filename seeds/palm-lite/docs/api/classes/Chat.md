[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / Chat

# Class: Chat

A convenience builder for chat-like requests.

Implements `GenerateMessageRequest` interface.

Example:

```typescript
const chat = new Chat();
chat.addMessage("Hello there!");
const data = await fetch(palm(PALM_KEY).message(chat));
const response = await data.json();
```

## Implements

- [`GenerateMessageRequest`](../interfaces/GenerateMessageRequest.md)

## Table of contents

### Constructors

- [constructor](Chat.md#constructor)

### Properties

- [candidateCount](Chat.md#candidatecount)
- [prompt](Chat.md#prompt)
- [temperature](Chat.md#temperature)
- [topK](Chat.md#topk)
- [topP](Chat.md#topp)

### Methods

- [addExample](Chat.md#addexample)
- [addMessage](Chat.md#addmessage)
- [context](Chat.md#context)

## Constructors

### constructor

• **new Chat**(`request?`)

Creates a new instance of a `GenerateMessageRequest` builder. You can pass this instance directly into `palm().message()`. The builder follows the typical pattern of builder classes, where you can chain methods together to build the request, like so:

```typescript
const chat = new Chat();
chat
 .addMessage("Hello there!").
 .addExample({
     input: "Pull up! All craft pull up!",
     output: "It's a trap!",
 });
const data = await fetch(palm(PALM_KEY).message(chat));
const response = await data.json();
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `request?` | [`PartialGenerateMessageRequest`](../interfaces/PartialGenerateMessageRequest.md) | A partial request object. Just put things like `temperature` and `candidateCount` into it and they will be used in the built instance. |

#### Defined in

[chat.ts:55](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/chat.ts#L55)

## Properties

### candidateCount

• `Optional` **candidateCount**: `number`

Optional. The number of generated response messages to return. This value must be between `[1, 8]`, inclusive. If unset, this will default to `1`.

#### Implementation of

[GenerateMessageRequest](../interfaces/GenerateMessageRequest.md).[candidateCount](../interfaces/GenerateMessageRequest.md#candidatecount)

#### Defined in

[chat.ts:34](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/chat.ts#L34)

___

### prompt

• **prompt**: [`MessagePrompt`](../interfaces/MessagePrompt.md)

Required. The structured textual input given to the model as a prompt. Given a prompt, the model will return what it predicts is the next message in the discussion.

#### Implementation of

[GenerateMessageRequest](../interfaces/GenerateMessageRequest.md).[prompt](../interfaces/GenerateMessageRequest.md#prompt)

#### Defined in

[chat.ts:37](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/chat.ts#L37)

___

### temperature

• `Optional` **temperature**: `number`

Optional. Controls the randomness of the output. Values can range over `[0.0,1.0]`, inclusive. A value closer to `1.0` will produce responses that are more varied, while a value closer to `0.0` will typically result in less surprising responses from the model.

#### Implementation of

[GenerateMessageRequest](../interfaces/GenerateMessageRequest.md).[temperature](../interfaces/GenerateMessageRequest.md#temperature)

#### Defined in

[chat.ts:33](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/chat.ts#L33)

___

### topK

• `Optional` **topK**: `number`

Optional. The maximum number of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Top-k sampling considers the set of `top_k` most probable tokens.

#### Implementation of

[GenerateMessageRequest](../interfaces/GenerateMessageRequest.md).[topK](../interfaces/GenerateMessageRequest.md#topk)

#### Defined in

[chat.ts:36](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/chat.ts#L36)

___

### topP

• `Optional` **topP**: `number`

Optional. The maximum cumulative probability of tokens to consider when sampling. The model uses combined Top-k and nucleus sampling. Nucleus sampling considers the smallest set of tokens whose probability sum is at least `top_p`.

#### Implementation of

[GenerateMessageRequest](../interfaces/GenerateMessageRequest.md).[topP](../interfaces/GenerateMessageRequest.md#topp)

#### Defined in

[chat.ts:35](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/chat.ts#L35)

## Methods

### addExample

▸ **addExample**(`example`): [`Chat`](Chat.md)

Helper for adding an example to the prompt.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `example` | `Object` | The example of what the model should generate, in the format of `{ input: string, output: string }`. |
| `example.input` | `string` | - |
| `example.output` | `string` | - |

#### Returns

[`Chat`](Chat.md)

The builder instance.

#### Defined in

[chat.ts:74](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/chat.ts#L74)

___

### addMessage

▸ **addMessage**(`message`): [`Chat`](Chat.md)

Helper for adding to the snapshot of recent conversation history for the prompt. This is what you would typically use to start the conversation and help the model keep traack of it.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `message` | `string` | The message to add to the history of messages. |

#### Returns

[`Chat`](Chat.md)

The builder instance.

#### Defined in

[chat.ts:88](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/chat.ts#L88)

___

### context

▸ **context**(`context`): [`Chat`](Chat.md)

Helper for setting the `context` property of the prompt.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `context` | `string` | Text that should be provided to the model first to ground the response. |

#### Returns

[`Chat`](Chat.md)

The builder instance.

#### Defined in

[chat.ts:64](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/chat.ts#L64)

[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / Model

# Interface: Model

Information about a Generative Language Model.

## Table of contents

### Properties

- [baseModelId](Model.md#basemodelid)
- [description](Model.md#description)
- [displayName](Model.md#displayname)
- [inputTokenLimit](Model.md#inputtokenlimit)
- [name](Model.md#name)
- [outputTokenLimit](Model.md#outputtokenlimit)
- [supportedGenerationMethods](Model.md#supportedgenerationmethods)
- [temperature](Model.md#temperature)
- [topK](Model.md#topk)
- [topP](Model.md#topp)
- [version](Model.md#version)

## Properties

### baseModelId

• `Optional` **baseModelId**: `string`

Required. The name of the base model, pass this to the generation request. Examples: * `chat-bison`

#### Defined in

[types.ts:239](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L239)

___

### description

• `Optional` **description**: `string`

A short description of the model.

#### Defined in

[types.ts:243](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L243)

___

### displayName

• `Optional` **displayName**: `string`

The human-readable name of the model. E.g. "Chat Bison". The name can be up to 128 characters long and can consist of any UTF-8 characters.

#### Defined in

[types.ts:247](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L247)

___

### inputTokenLimit

• `Optional` **inputTokenLimit**: `number`

Maximum number of input tokens allowed for this model.

#### Defined in

[types.ts:251](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L251)

___

### name

• `Optional` **name**: `string`

Required. The resource name of the `Model`. Format: `models/{model}` with a `{model}` naming convention of: * "{base_model_id}-{version}" Examples: * `models/chat-bison-001`

#### Defined in

[types.ts:255](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L255)

___

### outputTokenLimit

• `Optional` **outputTokenLimit**: `number`

Maximum number of output tokens available for this model.

#### Defined in

[types.ts:259](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L259)

___

### supportedGenerationMethods

• `Optional` **supportedGenerationMethods**: `string`[]

The model's supported generation methods. The method names are defined as Pascal case strings, such as `generateMessage` which correspond to API methods.

#### Defined in

[types.ts:263](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L263)

___

### temperature

• `Optional` **temperature**: `number`

Controls the randomness of the output. Values can range over `[0.0,1.0]`, inclusive. A value closer to `1.0` will produce responses that are more varied, while a value closer to `0.0` will typically result in less surprising responses from the model. This value specifies default to be used by the backend while making the call to the model.

#### Defined in

[types.ts:267](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L267)

___

### topK

• `Optional` **topK**: `number`

For Top-k sampling. Top-k sampling considers the set of `top_k` most probable tokens. This value specifies default to be used by the backend while making the call to the model.

#### Defined in

[types.ts:271](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L271)

___

### topP

• `Optional` **topP**: `number`

For Nucleus sampling. Nucleus sampling considers the smallest set of tokens whose probability sum is at least `top_p`. This value specifies default to be used by the backend while making the call to the model.

#### Defined in

[types.ts:275](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L275)

___

### version

• `Optional` **version**: `string`

Required. The version number of the model. This represents the major version

#### Defined in

[types.ts:279](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L279)

[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / StreamCapability

# Class: StreamCapability\<ChunkType\>

## Type parameters

| Name |
| :------ |
| `ChunkType` |

## Implements

- [`StreamCapabilityType`](../interfaces/StreamCapabilityType.md)\<`ChunkType`\>

## Table of contents

### Constructors

- [constructor](StreamCapability.md#constructor)

### Properties

- [kind](StreamCapability.md#kind)
- [stream](StreamCapability.md#stream)

## Constructors

### constructor

• **new StreamCapability**\<`ChunkType`\>(`stream`): [`StreamCapability`](StreamCapability.md)\<`ChunkType`\>

#### Type parameters

| Name |
| :------ |
| `ChunkType` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `stream` | `ReadableStream`\<`ChunkType`\> |

#### Returns

[`StreamCapability`](StreamCapability.md)\<`ChunkType`\>

#### Defined in

[packages/breadboard/src/stream.ts:22](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/stream.ts#L22)

## Properties

### kind

• **kind**: ``"stream"``

#### Implementation of

[StreamCapabilityType](../interfaces/StreamCapabilityType.md).[kind](../interfaces/StreamCapabilityType.md#kind)

#### Defined in

[packages/breadboard/src/stream.ts:19](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/stream.ts#L19)

___

### stream

• **stream**: `ReadableStream`\<`ChunkType`\>

#### Implementation of

[StreamCapabilityType](../interfaces/StreamCapabilityType.md).[stream](../interfaces/StreamCapabilityType.md#stream)

#### Defined in

[packages/breadboard/src/stream.ts:20](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/stream.ts#L20)

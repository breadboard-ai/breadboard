[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / StreamCapabilityType

# Interface: StreamCapabilityType\<ChunkType\>

## Type parameters

| Name | Type |
| :------ | :------ |
| `ChunkType` | `object` |

## Hierarchy

- [`Capability`](Capability.md)

  ↳ **`StreamCapabilityType`**

## Implemented by

- [`StreamCapability`](../classes/StreamCapability.md)

## Table of contents

### Properties

- [kind](StreamCapabilityType.md#kind)
- [stream](StreamCapabilityType.md#stream)

## Properties

### kind

• **kind**: ``"stream"``

#### Overrides

[Capability](Capability.md).[kind](Capability.md#kind)

#### Defined in

[packages/breadboard/src/stream.ts:12](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/stream.ts#L12)

___

### stream

• **stream**: `ReadableStream`\<`ChunkType`\>

#### Defined in

[packages/breadboard/src/stream.ts:13](https://github.com/breadboard-ai/breadboard/blob/254400c2/packages/breadboard/src/stream.ts#L13)

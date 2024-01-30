[@google-labs/breadboard-ui](../README.md) / [Exports](../modules.md) / Types

# Namespace: Types

## Table of contents

### Enumerations

- [HistoryEventType](../enums/Types.HistoryEventType.md)
- [STATUS](../enums/Types.STATUS.md)

### Interfaces

- [CanvasData](../interfaces/Types.CanvasData.md)
- [ImageHandler](../interfaces/Types.ImageHandler.md)

### Type Aliases

- [AnyHistoryEvent](Types.md#anyhistoryevent)
- [Board](Types.md#board)
- [HistoryEntry](Types.md#historyentry)
- [InputArgs](Types.md#inputargs)
- [LoadArgs](Types.md#loadargs)
- [OutputArgs](Types.md#outputargs)
- [StartArgs](Types.md#startargs)

## Type Aliases

### AnyHistoryEvent

Ƭ **AnyHistoryEvent**: `GraphProbeData` \| `NodeStartResponse` \| `NodeEndResponse`

#### Defined in

[packages/breadboard-ui/src/types/types.ts:36](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard-ui/src/types/types.ts#L36)

___

### Board

Ƭ **Board**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `title` | `string` |
| `url` | `string` |
| `version` | `string` |

#### Defined in

[packages/breadboard-ui/src/types/types.ts:30](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard-ui/src/types/types.ts#L30)

___

### HistoryEntry

Ƭ **HistoryEntry**: `HarnessRunResult` & \{ `children`: [`HistoryEntry`](Types.md#historyentry)[] ; `graphNodeData`: \{ `inputs`: `Record`\<`string`, `unknown`\> ; `outputs`: `Record`\<`string`, `unknown`\>  } \| ``null`` \| `undefined` ; `guid`: `string` ; `id`: `string`  }

#### Defined in

[packages/breadboard-ui/src/types/types.ts:53](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard-ui/src/types/types.ts#L53)

___

### InputArgs

Ƭ **InputArgs**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `schema?` | `Schema` |

#### Defined in

[packages/breadboard-ui/src/types/types.ts:83](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard-ui/src/types/types.ts#L83)

___

### LoadArgs

Ƭ **LoadArgs**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `description?` | `string` |
| `diagram?` | `string` |
| `graphDescriptor?` | `GraphDescriptor` |
| `nodes?` | `NodeDescriptor`[] |
| `title?` | `string` |
| `url?` | `string` |
| `version?` | `string` |

#### Defined in

[packages/breadboard-ui/src/types/types.ts:69](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard-ui/src/types/types.ts#L69)

___

### OutputArgs

Ƭ **OutputArgs**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `node` | \{ `configuration?`: `unknown` ; `id`: `string` ; `type`: `string`  } |
| `node.configuration?` | `unknown` |
| `node.id` | `string` |
| `node.type` | `string` |
| `outputs` | \{ `schema?`: `Schema`  } & `Record`\<`string`, `unknown`\> |

#### Defined in

[packages/breadboard-ui/src/types/types.ts:87](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard-ui/src/types/types.ts#L87)

___

### StartArgs

Ƭ **StartArgs**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `boards` | [`Board`](Types.md#board)[] |

#### Defined in

[packages/breadboard-ui/src/types/types.ts:79](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard-ui/src/types/types.ts#L79)

[@google-labs/breadboard-ui](README.md) / Exports

# @google-labs/breadboard-ui

## Table of contents

### Enumerations

- [HarnessEventType](enums/HarnessEventType.md)

### Classes

- [DelayEvent](classes/DelayEvent.md)
- [StartEvent](classes/StartEvent.md)
- [ToastEvent](classes/ToastEvent.md)

### Type Aliases

- [InputArgs](modules.md#inputargs)
- [LoadArgs](modules.md#loadargs)
- [OutputArgs](modules.md#outputargs)
- [ResultArgs](modules.md#resultargs)
- [StartArgs](modules.md#startargs)

### Functions

- [get](modules.md#get)
- [register](modules.md#register)

## Type Aliases

### InputArgs

Ƭ **InputArgs**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `schema` | `Schema` |

#### Defined in

[packages/breadboard-ui/src/input.ts:16](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/input.ts#L16)

___

### LoadArgs

Ƭ **LoadArgs**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `description?` | `string` |
| `diagram?` | `string` |
| `nodes?` | `NodeDescriptor`[] |
| `title` | `string` |
| `url?` | `string` |
| `version?` | `string` |

#### Defined in

[packages/breadboard-ui/src/load.ts:10](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/load.ts#L10)

___

### OutputArgs

Ƭ **OutputArgs**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `node` | \{ `configuration`: `unknown` ; `id`: `string` ; `type`: `string`  } |
| `node.configuration` | `unknown` |
| `node.id` | `string` |
| `node.type` | `string` |
| `outputs` | \{ `schema`: `Schema`  } & `Record`\<`string`, `unknown`\> |

#### Defined in

[packages/breadboard-ui/src/output.ts:13](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/output.ts#L13)

___

### ResultArgs

Ƭ **ResultArgs**: `Object`

**`License`**

Copyright 2023 Google LLC
SPDX-License-Identifier: Apache-2.0

#### Type declaration

| Name | Type |
| :------ | :------ |
| `result` | `string` |
| `title` | `string` |

#### Defined in

[packages/breadboard-ui/src/result.ts:7](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/result.ts#L7)

___

### StartArgs

Ƭ **StartArgs**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `boards` | \{ `title`: `string` ; `url`: `string` ; `version`: `string`  }[] |

#### Defined in

[packages/breadboard-ui/src/start.ts:9](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/start.ts#L9)

## Functions

### get

▸ **get**(): `UIController`

#### Returns

`UIController`

#### Defined in

[packages/breadboard-ui/src/index.ts:49](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/index.ts#L49)

___

### register

▸ **register**(): `void`

#### Returns

`void`

#### Defined in

[packages/breadboard-ui/src/index.ts:28](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard-ui/src/index.ts#L28)

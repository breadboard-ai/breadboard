[@google-labs/breadboard-ui](README.md) / Exports

# @google-labs/breadboard-ui

## Table of contents

### Classes

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

[seeds/breadboard-ui/src/input.ts:14](https://github.com/google/labs-prototypes/blob/a792f6c/seeds/breadboard-ui/src/input.ts#L14)

___

### LoadArgs

Ƭ **LoadArgs**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `description?` | `string` |
| `diagram?` | `string` |
| `title` | `string` |
| `url?` | `string` |
| `version?` | `string` |

#### Defined in

[seeds/breadboard-ui/src/load.ts:10](https://github.com/google/labs-prototypes/blob/a792f6c/seeds/breadboard-ui/src/load.ts#L10)

___

### OutputArgs

Ƭ **OutputArgs**: `Record`<`string`, `unknown`\> & { `schema`: `Schema`  }

#### Defined in

[seeds/breadboard-ui/src/output.ts:13](https://github.com/google/labs-prototypes/blob/a792f6c/seeds/breadboard-ui/src/output.ts#L13)

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

[seeds/breadboard-ui/src/result.ts:7](https://github.com/google/labs-prototypes/blob/a792f6c/seeds/breadboard-ui/src/result.ts#L7)

___

### StartArgs

Ƭ **StartArgs**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `boards` | { `title`: `string` ; `url`: `string`  }[] |

#### Defined in

[seeds/breadboard-ui/src/start.ts:9](https://github.com/google/labs-prototypes/blob/a792f6c/seeds/breadboard-ui/src/start.ts#L9)

## Functions

### get

▸ **get**(): `UIController`

#### Returns

`UIController`

#### Defined in

[seeds/breadboard-ui/src/index.ts:41](https://github.com/google/labs-prototypes/blob/a792f6c/seeds/breadboard-ui/src/index.ts#L41)

___

### register

▸ **register**(): `void`

#### Returns

`void`

#### Defined in

[seeds/breadboard-ui/src/index.ts:24](https://github.com/google/labs-prototypes/blob/a792f6c/seeds/breadboard-ui/src/index.ts#L24)

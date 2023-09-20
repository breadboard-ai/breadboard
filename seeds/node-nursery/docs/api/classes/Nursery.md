[@google-labs/node-nursery](../README.md) / [Exports](../modules.md) / Nursery

# Class: Nursery

Syntactic sugar to easily create nodes.

## Implements

- `Kit`

## Table of contents

### Constructors

- [constructor](Nursery.md#constructor)

### Properties

- [#handlers](Nursery.md##handlers)
- [#nodeFactory](Nursery.md##nodefactory)
- [url](Nursery.md#url)

### Accessors

- [handlers](Nursery.md#handlers)

### Methods

- [addToVectorDatabase](Nursery.md#addtovectordatabase)
- [cache](Nursery.md#cache)
- [createVectorDatabase](Nursery.md#createvectordatabase)
- [embedDocs](Nursery.md#embeddocs)
- [embedString](Nursery.md#embedstring)
- [localMemory](Nursery.md#localmemory)
- [map](Nursery.md#map)
- [queryVectorDatabase](Nursery.md#queryvectordatabase)
- [schemish](Nursery.md#schemish)
- [templateParser](Nursery.md#templateparser)
- [textAsset](Nursery.md#textasset)
- [textAssetsFromPath](Nursery.md#textassetsfrompath)
- [validateJson](Nursery.md#validatejson)

## Constructors

### constructor

• **new Nursery**(`nodeFactory`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `nodeFactory` | `NodeFactory` |

#### Defined in

[nursery.ts:69](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L69)

## Properties

### #handlers

• `Private` **#handlers**: `NodeHandlers`

#### Defined in

[nursery.ts:63](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L63)

___

### #nodeFactory

• `Private` **#nodeFactory**: `NodeFactory`

#### Defined in

[nursery.ts:62](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L62)

___

### url

• **url**: `string` = `"npm:@google-labs/node-nursery"`

#### Implementation of

Kit.url

#### Defined in

[nursery.ts:61](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L61)

## Accessors

### handlers

• `get` **handlers**(): `NodeHandlers`

#### Returns

`NodeHandlers`

#### Implementation of

Kit.handlers

#### Defined in

[nursery.ts:65](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L65)

## Methods

### addToVectorDatabase

▸ **addToVectorDatabase**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:81](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L81)

___

### cache

▸ **cache**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:123](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L123)

___

### createVectorDatabase

▸ **createVectorDatabase**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:74](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L74)

___

### embedDocs

▸ **embedDocs**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:95](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L95)

___

### embedString

▸ **embedString**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:102](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L102)

___

### localMemory

▸ **localMemory**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:130](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L130)

___

### map

▸ **map**(`config?`): `BreadboardNode`<`MapInputs`, `MapOutputs`\>

Work in progress implementation of a `map` node as part of work on
issue #110.

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`MapInputs`, `MapOutputs`\>

#### Defined in

[nursery.ts:180](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L180)

___

### queryVectorDatabase

▸ **queryVectorDatabase**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:88](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L88)

___

### schemish

▸ **schemish**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:148](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L148)

___

### templateParser

▸ **templateParser**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

Parses a template and returns a JSON schema of placeholders.

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:163](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L163)

___

### textAsset

▸ **textAsset**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:109](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L109)

___

### textAssetsFromPath

▸ **textAssetsFromPath**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:116](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L116)

___

### validateJson

▸ **validateJson**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:137](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/node-nursery/src/nursery.ts#L137)

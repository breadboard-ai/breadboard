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
- [batcher](Nursery.md#batcher)
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

[nursery.ts:71](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L71)

## Properties

### #handlers

• `Private` **#handlers**: `NodeHandlers`

#### Defined in

[nursery.ts:65](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L65)

___

### #nodeFactory

• `Private` **#nodeFactory**: `NodeFactory`

#### Defined in

[nursery.ts:64](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L64)

___

### url

• **url**: `string` = `"npm:@google-labs/node-nursery"`

#### Implementation of

Kit.url

#### Defined in

[nursery.ts:63](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L63)

## Accessors

### handlers

• `get` **handlers**(): `NodeHandlers`

#### Returns

`NodeHandlers`

#### Implementation of

Kit.handlers

#### Defined in

[nursery.ts:67](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L67)

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

[nursery.ts:83](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L83)

___

### batcher

▸ **batcher**(`config?`): `BreadboardNode`<`BatcherInputs`, `BatcherOutputs`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`BatcherInputs`, `BatcherOutputs`\>

#### Defined in

[nursery.ts:194](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L194)

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

[nursery.ts:125](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L125)

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

[nursery.ts:76](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L76)

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

[nursery.ts:97](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L97)

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

[nursery.ts:104](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L104)

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

[nursery.ts:132](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L132)

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

[nursery.ts:182](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L182)

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

[nursery.ts:90](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L90)

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

[nursery.ts:150](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L150)

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

[nursery.ts:165](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L165)

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

[nursery.ts:111](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L111)

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

[nursery.ts:118](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L118)

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

[nursery.ts:139](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/node-nursery/src/nursery.ts#L139)

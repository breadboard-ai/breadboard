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

- [#create](Nursery.md##create)
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

[nursery.ts:74](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L74)

## Properties

### #handlers

• `Private` **#handlers**: `NodeHandlers`<`NodeHandlerContext`\>

#### Defined in

[nursery.ts:68](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L68)

___

### #nodeFactory

• `Private` **#nodeFactory**: `NodeFactory`

#### Defined in

[nursery.ts:67](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L67)

___

### url

• **url**: `string` = `"npm:@google-labs/node-nursery"`

#### Implementation of

Kit.url

#### Defined in

[nursery.ts:66](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L66)

## Accessors

### handlers

• `get` **handlers**(): `NodeHandlers`<`NodeHandlerContext`\>

#### Returns

`NodeHandlers`<`NodeHandlerContext`\>

#### Implementation of

Kit.handlers

#### Defined in

[nursery.ts:70](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L70)

## Methods

### #create

▸ `Private` **#create**<`Inputs`, `Outputs`\>(`type`, `config`): `BreadboardNode`<`Inputs`, `Outputs`\>

#### Type parameters

| Name |
| :------ |
| `Inputs` |
| `Outputs` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`Inputs`, `Outputs`\>

#### Defined in

[nursery.ts:79](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L79)

___

### addToVectorDatabase

▸ **addToVectorDatabase**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:93](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L93)

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

[nursery.ts:190](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L190)

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

[nursery.ts:129](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L129)

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

[nursery.ts:87](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L87)

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

[nursery.ts:105](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L105)

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

[nursery.ts:111](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L111)

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

[nursery.ts:135](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L135)

___

### map

▸ **map**<`In`, `Out`\>(`config?`): `BreadboardNode`<`MapInputs`, `MapOutputs`\>

Work in progress implementation of a `map` node as part of work on
issue #110.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `In` | `InputValues` |
| `Out` | `Partial`<`Record`<`string`, `NodeValue`\>\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `config` | `ConfigOrLambda`<`In`, `Out`\> |

#### Returns

`BreadboardNode`<`MapInputs`, `MapOutputs`\>

#### Defined in

[nursery.ts:179](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L179)

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

[nursery.ts:99](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L99)

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

[nursery.ts:150](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L150)

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

[nursery.ts:163](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L163)

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

[nursery.ts:117](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L117)

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

[nursery.ts:123](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L123)

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

[nursery.ts:141](https://github.com/google/labs-prototypes/blob/5114223/seeds/node-nursery/src/nursery.ts#L141)

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
- [chunker](Nursery.md#chunker)
- [createVectorDatabase](Nursery.md#createvectordatabase)
- [embedDocs](Nursery.md#embeddocs)
- [embedString](Nursery.md#embedstring)
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

| Name          | Type          |
| :------------ | :------------ |
| `nodeFactory` | `NodeFactory` |

#### Defined in

[nursery.ts:70](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L70)

## Properties

### #handlers

• `Private` **#handlers**: `NodeHandlers`<`NodeHandlerContext`\>

#### Defined in

[nursery.ts:64](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L64)

---

### #nodeFactory

• `Private` **#nodeFactory**: `NodeFactory`

#### Defined in

[nursery.ts:63](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L63)

---

### url

• **url**: `string` = `"npm:@google-labs/node-nursery"`

#### Implementation of

Kit.url

#### Defined in

[nursery.ts:62](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L62)

## Accessors

### handlers

• `get` **handlers**(): `NodeHandlers`<`NodeHandlerContext`\>

#### Returns

`NodeHandlers`<`NodeHandlerContext`\>

#### Implementation of

Kit.handlers

#### Defined in

[nursery.ts:66](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L66)

## Methods

### #create

▸ `Private` **#create**<`Inputs`, `Outputs`\>(`type`, `config`): `BreadboardNode`<`Inputs`, `Outputs`\>

#### Type parameters

| Name      |
| :-------- |
| `Inputs`  |
| `Outputs` |

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `type`   | `string`                  |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`Inputs`, `Outputs`\>

#### Defined in

[nursery.ts:75](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L75)

---

### addToVectorDatabase

▸ **addToVectorDatabase**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:89](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L89)

---

### batcher

▸ **batcher**(`config?`): `BreadboardNode`<`BatcherInputs`, `BatcherOutputs`\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`BatcherInputs`, `BatcherOutputs`\>

#### Defined in

[nursery.ts:180](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L180)

---

### cache

▸ **cache**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:125](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L125)

---

### chunker

▸ **chunker**(`config?`): `BreadboardNode`<`ChunkerInputs`, `ChunkerOutputs`\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`ChunkerInputs`, `ChunkerOutputs`\>

#### Defined in

[nursery.ts:187](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L187)

---

### createVectorDatabase

▸ **createVectorDatabase**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:83](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L83)

---

### embedDocs

▸ **embedDocs**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:101](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L101)

---

### embedString

▸ **embedString**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:107](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L107)

---

### map

▸ **map**<`In`, `Out`\>(`config?`): `BreadboardNode`<`MapInputs`, `MapOutputs`\>

Work in progress implementation of a `map` node as part of work on
issue #110.

#### Type parameters

| Name  | Type                                         |
| :---- | :------------------------------------------- |
| `In`  | `InputValues`                                |
| `Out` | `Partial`<`Record`<`string`, `NodeValue`\>\> |

#### Parameters

| Name     | Type                           |
| :------- | :----------------------------- |
| `config` | `ConfigOrLambda`<`In`, `Out`\> |

#### Returns

`BreadboardNode`<`MapInputs`, `MapOutputs`\>

#### Defined in

[nursery.ts:169](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L169)

---

### queryVectorDatabase

▸ **queryVectorDatabase**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:95](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L95)

---

### schemish

▸ **schemish**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:140](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L140)

---

### templateParser

▸ **templateParser**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

Parses a template and returns a JSON schema of placeholders.

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:153](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L153)

---

### textAsset

▸ **textAsset**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:113](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L113)

---

### textAssetsFromPath

▸ **textAssetsFromPath**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:119](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L119)

---

### validateJson

▸ **validateJson**(`config?`): `BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Parameters

| Name     | Type                      |
| :------- | :------------------------ |
| `config` | `OptionalIdConfiguration` |

#### Returns

`BreadboardNode`<`InputValues`, `Partial`<`Record`<`string`, `NodeValue`\>\>\>

#### Defined in

[nursery.ts:131](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/node-nursery/src/nursery.ts#L131)

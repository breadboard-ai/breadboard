[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / V

# Class: V\<T\>

## Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `NodeValue` = `NodeValue` |

## Implements

- `PromiseLike`\<`T` \| `undefined`\>

## Table of contents

### Constructors

- [constructor](V.md#constructor)

### Methods

- [as](V.md#as)
- [asNodeInput](V.md#asnodeinput)
- [default](V.md#default)
- [description](V.md#description)
- [examples](V.md#examples)
- [format](V.md#format)
- [in](V.md#in)
- [invoke](V.md#invoke)
- [isArray](V.md#isarray)
- [isBoolean](V.md#isboolean)
- [isNumber](V.md#isnumber)
- [isObject](V.md#isobject)
- [isString](V.md#isstring)
- [isUnknown](V.md#isunknown)
- [memoize](V.md#memoize)
- [optional](V.md#optional)
- [then](V.md#then)
- [title](V.md#title)
- [to](V.md#to)

## Constructors

### constructor

• **new V**\<`T`\>(): [`V`](V.md)\<`T`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `unknown` = `unknown` |

#### Returns

[`V`](V.md)\<`T`\>

## Methods

### as

▸ **as**(`newKey`): [`V`](V.md)\<`T`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `newKey` | `string` \| `KeyMap` |

#### Returns

[`V`](V.md)\<`T`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:282](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L282)

___

### asNodeInput

▸ **asNodeInput**(): [[`AbstractNode`](AbstractNode.md)\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\>, \{ `[key: string]`: `string`;  }, `boolean`, [`Schema`](../modules.md#schema)]

#### Returns

[[`AbstractNode`](AbstractNode.md)\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\>, \{ `[key: string]`: `string`;  }, `boolean`, [`Schema`](../modules.md#schema)]

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:257](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L257)

___

### default

▸ **default**(`value`): [`V`](V.md)\<`T`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `value` | `string` |

#### Returns

[`V`](V.md)\<`T`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:299](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L299)

___

### description

▸ **description**(`description`): [`V`](V.md)\<`T`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `description` | `string` |

#### Returns

[`V`](V.md)\<`T`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:297](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L297)

___

### examples

▸ **examples**(`...examples`): [`V`](V.md)\<`T`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `...examples` | `string`[] |

#### Returns

[`V`](V.md)\<`T`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:298](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L298)

___

### format

▸ **format**(`format`): [`V`](V.md)\<`T`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `format` | `string` |

#### Returns

[`V`](V.md)\<`T`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:296](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L296)

___

### in

▸ **in**(`inputs`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | [`V`](V.md)\<`unknown`\> \| [`InputsMaybeAsValues`](../modules.md#inputsmaybeasvalues)\<[`NewInputValuesWithNodeFactory`](../modules.md#newinputvalueswithnodefactory), [`NewInputValuesWithNodeFactory`](../modules.md#newinputvalueswithnodefactory)\> \| [`AbstractNode`](AbstractNode.md)\<[`NewInputValuesWithNodeFactory`](../modules.md#newinputvalueswithnodefactory), `OutputValues`\> |

#### Returns

`void`

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:275](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L275)

___

### invoke

▸ **invoke**(`config?`): [`__NodeProxy`](../modules.md#__nodeproxy)\<[`NewInputValuesWithNodeFactory`](../modules.md#newinputvalueswithnodefactory), `OutputValues`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `config?` | `BuilderNodeConfig`\<[`NewInputValuesWithNodeFactory`](../modules.md#newinputvalueswithnodefactory)\> |

#### Returns

[`__NodeProxy`](../modules.md#__nodeproxy)\<[`NewInputValuesWithNodeFactory`](../modules.md#newinputvalueswithnodefactory), `OutputValues`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:286](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L286)

___

### isArray

▸ **isArray**(): [`V`](V.md)\<`unknown`[]\>

#### Returns

[`V`](V.md)\<`unknown`[]\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:292](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L292)

___

### isBoolean

▸ **isBoolean**(): [`V`](V.md)\<`boolean`\>

#### Returns

[`V`](V.md)\<`boolean`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:291](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L291)

___

### isNumber

▸ **isNumber**(): [`V`](V.md)\<`number`\>

#### Returns

[`V`](V.md)\<`number`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:290](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L290)

___

### isObject

▸ **isObject**(): [`V`](V.md)\<\{ `[key: string]`: `NodeValue`;  }\>

#### Returns

[`V`](V.md)\<\{ `[key: string]`: `NodeValue`;  }\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:293](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L293)

___

### isString

▸ **isString**(): [`V`](V.md)\<`string`\>

#### Returns

[`V`](V.md)\<`string`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:289](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L289)

___

### isUnknown

▸ **isUnknown**(): [`V`](V.md)\<`unknown`\>

#### Returns

[`V`](V.md)\<`unknown`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:288](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L288)

___

### memoize

▸ **memoize**(): [`V`](V.md)\<`T`\>

#### Returns

[`V`](V.md)\<`T`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:284](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L284)

___

### optional

▸ **optional**(): [`V`](V.md)\<`T`\>

#### Returns

[`V`](V.md)\<`T`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:300](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L300)

___

### then

▸ **then**\<`TResult1`, `TResult2`\>(`onfulfilled?`, `onrejected?`): `PromiseLike`\<`TResult1` \| `TResult2`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `TResult1` | `undefined` \| `T` |
| `TResult2` | `never` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `onfulfilled?` | ``null`` \| (`value`: `undefined` \| `T`) => `TResult1` \| `PromiseLike`\<`TResult1`\> |
| `onrejected?` | ``null`` \| (`reason`: `unknown`) => `TResult2` \| `PromiseLike`\<`TResult2`\> |

#### Returns

`PromiseLike`\<`TResult1` \| `TResult2`\>

#### Implementation of

PromiseLike.then

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:250](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L250)

___

### title

▸ **title**(`title`): [`V`](V.md)\<`T`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `title` | `string` |

#### Returns

[`V`](V.md)\<`T`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:295](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L295)

___

### to

▸ **to**\<`ToO`, `ToC`\>(`to`, `config?`): [`__NodeProxy`](../modules.md#__nodeproxy)\<`Partial`\<\{ `[key: string]`: `T`;  }\> & `ToC`, `ToO`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `ToO` | extends `OutputValues` = `OutputValues` |
| `ToC` | extends [`NewInputValuesWithNodeFactory`](../modules.md#newinputvalueswithnodefactory) = [`NewInputValuesWithNodeFactory`](../modules.md#newinputvalueswithnodefactory) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `to` | `string` \| [`__NodeProxy`](../modules.md#__nodeproxy)\<`Partial`\<\{ `[key: string]`: `T`;  }\> & `ToC`, `ToO`\> \| `NodeHandler`\<`Partial`\<\{ `[key: string]`: `T`;  }\> & `ToC`, `ToO`\> |
| `config?` | `ToC` |

#### Returns

[`__NodeProxy`](../modules.md#__nodeproxy)\<`Partial`\<\{ `[key: string]`: `T`;  }\> & `ToC`, `ToO`\>

#### Defined in

[packages/breadboard/src/new/grammar/types.ts:264](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/grammar/types.ts#L264)

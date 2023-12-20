[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / V

# Class: V\<T\>

## Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `NodeValue` \| `unknown` = `NodeValue` |

## Implements

- `PromiseLike`\<`T` \| `undefined`\>

## Table of contents

### Constructors

- [constructor](V.md#constructor)

### Methods

- [as](V.md#as)
- [asNodeInput](V.md#asnodeinput)
- [in](V.md#in)
- [invoke](V.md#invoke)
- [memoize](V.md#memoize)
- [then](V.md#then)
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

[packages/breadboard/src/new/recipe-grammar/types.ts:273](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L273)

___

### asNodeInput

▸ **asNodeInput**(): [[`AbstractNode`](AbstractNode.md)\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\>, \{ `[key: string]`: `string`;  }, `boolean`]

#### Returns

[[`AbstractNode`](AbstractNode.md)\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\>, \{ `[key: string]`: `string`;  }, `boolean`]

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:253](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L253)

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

[packages/breadboard/src/new/recipe-grammar/types.ts:266](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L266)

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

[packages/breadboard/src/new/recipe-grammar/types.ts:277](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L277)

___

### memoize

▸ **memoize**(): [`V`](V.md)\<`T`\>

#### Returns

[`V`](V.md)\<`T`\>

#### Defined in

[packages/breadboard/src/new/recipe-grammar/types.ts:275](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L275)

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

[packages/breadboard/src/new/recipe-grammar/types.ts:246](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L246)

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

[packages/breadboard/src/new/recipe-grammar/types.ts:255](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/recipe-grammar/types.ts#L255)

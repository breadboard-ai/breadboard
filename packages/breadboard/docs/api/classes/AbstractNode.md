[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / AbstractNode

# Class: AbstractNode\<I, O\>

## Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValues`](../modules.md#newinputvalues) = [`NewInputValues`](../modules.md#newinputvalues) |
| `O` | extends [`NewOutputValues`](../modules.md#newoutputvalues) = [`NewOutputValues`](../modules.md#newoutputvalues) |

## Implements

- [`Serializeable`](../interfaces/Serializeable.md)

## Table of contents

### Constructors

- [constructor](AbstractNode.md#constructor)

### Properties

- [configuration](AbstractNode.md#configuration)
- [id](AbstractNode.md#id)
- [incoming](AbstractNode.md#incoming)
- [outgoing](AbstractNode.md#outgoing)
- [type](AbstractNode.md#type)

### Methods

- [addIncomingEdge](AbstractNode.md#addincomingedge)
- [describe](AbstractNode.md#describe)
- [invoke](AbstractNode.md#invoke)
- [serialize](AbstractNode.md#serialize)
- [serializeNode](AbstractNode.md#serializenode)

## Constructors

### constructor

• **new AbstractNode**\<`I`, `O`\>(): [`AbstractNode`](AbstractNode.md)\<`I`, `O`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `I` | extends [`NewInputValues`](../modules.md#newinputvalues) = [`NewInputValues`](../modules.md#newinputvalues) |
| `O` | extends [`NewOutputValues`](../modules.md#newoutputvalues) = [`NewOutputValues`](../modules.md#newoutputvalues) |

#### Returns

[`AbstractNode`](AbstractNode.md)\<`I`, `O`\>

## Properties

### configuration

• `Abstract` **configuration**: `Partial`\<`I`\>

#### Defined in

[packages/breadboard/src/new/runner/types.ts:84](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/types.ts#L84)

___

### id

• `Abstract` **id**: `string`

#### Defined in

[packages/breadboard/src/new/runner/types.ts:80](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/types.ts#L80)

___

### incoming

• `Abstract` **incoming**: `EdgeInterface`\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues), [`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\>[]

#### Defined in

[packages/breadboard/src/new/runner/types.ts:83](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/types.ts#L83)

___

### outgoing

• `Abstract` **outgoing**: `EdgeInterface`\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues), [`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\>[]

#### Defined in

[packages/breadboard/src/new/runner/types.ts:82](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/types.ts#L82)

___

### type

• `Abstract` **type**: `string`

#### Defined in

[packages/breadboard/src/new/runner/types.ts:81](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/types.ts#L81)

## Methods

### addIncomingEdge

▸ **addIncomingEdge**(`from`, `out`, `in_`, `constant?`, `schema?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `from` | [`AbstractNode`](AbstractNode.md)\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\> |
| `out` | `string` |
| `in_` | `string` |
| `constant?` | `boolean` |
| `schema?` | [`Schema`](../modules.md#schema) |

#### Returns

`void`

#### Defined in

[packages/breadboard/src/new/runner/types.ts:86](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/types.ts#L86)

___

### describe

▸ **describe**(`scope?`, `inputs?`, `inputSchema?`, `outputSchema?`): `Promise`\<`undefined` \| [`NodeDescriberResult`](../modules.md#nodedescriberresult)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `scope?` | `ScopeInterface` |
| `inputs?` | [`NewInputValues`](../modules.md#newinputvalues) |
| `inputSchema?` | [`Schema`](../modules.md#schema) |
| `outputSchema?` | [`Schema`](../modules.md#schema) |

#### Returns

`Promise`\<`undefined` \| [`NodeDescriberResult`](../modules.md#nodedescriberresult)\>

#### Defined in

[packages/breadboard/src/new/runner/types.ts:95](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/types.ts#L95)

___

### invoke

▸ **invoke**(`inputs`, `dynamicScope?`): `Promise`\<`O`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs` | `I` |
| `dynamicScope?` | `ScopeInterface` |

#### Returns

`Promise`\<`O`\>

#### Defined in

[packages/breadboard/src/new/runner/types.ts:94](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/types.ts#L94)

___

### serialize

▸ **serialize**(`metadata?`): `Promise`\<[`GraphDescriptor`](../modules.md#graphdescriptor)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `metadata?` | [`GraphMetadata`](../modules.md#graphmetadata) |

#### Returns

`Promise`\<[`GraphDescriptor`](../modules.md#graphdescriptor)\>

#### Implementation of

[Serializeable](../interfaces/Serializeable.md).[serialize](../interfaces/Serializeable.md#serialize)

#### Defined in

[packages/breadboard/src/new/runner/types.ts:102](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/types.ts#L102)

___

### serializeNode

▸ **serializeNode**(): `Promise`\<[[`NodeDescriptor`](../modules.md#nodedescriptor), GraphDescriptor?]\>

#### Returns

`Promise`\<[[`NodeDescriptor`](../modules.md#nodedescriptor), GraphDescriptor?]\>

#### Defined in

[packages/breadboard/src/new/runner/types.ts:104](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/new/runner/types.ts#L104)

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

- [getInputs](AbstractNode.md#getinputs)
- [invoke](AbstractNode.md#invoke)
- [missingInputs](AbstractNode.md#missinginputs)
- [receiveInputs](AbstractNode.md#receiveinputs)
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

[packages/breadboard/src/new/runner/types.ts:83](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L83)

___

### id

• `Abstract` **id**: `string`

#### Defined in

[packages/breadboard/src/new/runner/types.ts:79](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L79)

___

### incoming

• `Abstract` **incoming**: `EdgeInterface`\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues), [`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\>[]

#### Defined in

[packages/breadboard/src/new/runner/types.ts:82](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L82)

___

### outgoing

• `Abstract` **outgoing**: `EdgeInterface`\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues), [`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\>[]

#### Defined in

[packages/breadboard/src/new/runner/types.ts:81](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L81)

___

### type

• `Abstract` **type**: `string`

#### Defined in

[packages/breadboard/src/new/runner/types.ts:80](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L80)

## Methods

### getInputs

▸ **getInputs**(): `I`

#### Returns

`I`

#### Defined in

[packages/breadboard/src/new/runner/types.ts:88](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L88)

___

### invoke

▸ **invoke**(`dynamicScope?`): `Promise`\<`O`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `dynamicScope?` | `ScopeInterface` |

#### Returns

`Promise`\<`O`\>

#### Defined in

[packages/breadboard/src/new/runner/types.ts:90](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L90)

___

### missingInputs

▸ **missingInputs**(): ``false`` \| `string`[]

#### Returns

``false`` \| `string`[]

#### Defined in

[packages/breadboard/src/new/runner/types.ts:86](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L86)

___

### receiveInputs

▸ **receiveInputs**(`edge`, `inputs`): `string`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `edge` | `EdgeInterface`\<[`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues), [`NewInputValues`](../modules.md#newinputvalues), [`NewOutputValues`](../modules.md#newoutputvalues)\> |
| `inputs` | [`NewInputValues`](../modules.md#newinputvalues) |

#### Returns

`string`[]

#### Defined in

[packages/breadboard/src/new/runner/types.ts:85](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L85)

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

[packages/breadboard/src/new/runner/types.ts:92](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L92)

___

### serializeNode

▸ **serializeNode**(): `Promise`\<[[`NodeDescriptor`](../modules.md#nodedescriptor), GraphDescriptor?]\>

#### Returns

`Promise`\<[[`NodeDescriptor`](../modules.md#nodedescriptor), GraphDescriptor?]\>

#### Defined in

[packages/breadboard/src/new/runner/types.ts:94](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/new/runner/types.ts#L94)

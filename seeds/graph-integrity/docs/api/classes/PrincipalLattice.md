[@google-labs/graph-integrity](../README.md) / [Exports](../modules.md) / PrincipalLattice

# Class: PrincipalLattice

Information flow control principal lattice.

Defines a lattice, with TOP being the most restrictive and BOTTOM being the
least restrictive values.

## Table of contents

### Constructors

- [constructor](PrincipalLattice.md#constructor)

### Properties

- [BOTTOM](PrincipalLattice.md#bottom)
- [PRIVATE](PrincipalLattice.md#private)
- [PUBLIC](PrincipalLattice.md#public)
- [TOP](PrincipalLattice.md#top)
- [TRUSTED](PrincipalLattice.md#trusted)
- [UNTRUSTED](PrincipalLattice.md#untrusted)
- [labels](PrincipalLattice.md#labels)

### Methods

- [get](PrincipalLattice.md#get)
- [insert](PrincipalLattice.md#insert)

## Constructors

### constructor

• **new PrincipalLattice**()

#### Defined in

[label.ts:154](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L154)

## Properties

### BOTTOM

• `Readonly` **BOTTOM**: [`Principal`](Principal.md)

#### Defined in

[label.ts:133](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L133)

___

### PRIVATE

• `Readonly` **PRIVATE**: [`Principal`](Principal.md)

#### Defined in

[label.ts:135](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L135)

___

### PUBLIC

• `Readonly` **PUBLIC**: [`Principal`](Principal.md)

#### Defined in

[label.ts:136](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L136)

___

### TOP

• `Readonly` **TOP**: [`Principal`](Principal.md)

#### Defined in

[label.ts:132](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L132)

___

### TRUSTED

• `Readonly` **TRUSTED**: [`Principal`](Principal.md)

#### Defined in

[label.ts:140](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L140)

___

### UNTRUSTED

• `Readonly` **UNTRUSTED**: [`Principal`](Principal.md)

#### Defined in

[label.ts:139](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L139)

___

### labels

• `Readonly` **labels**: `Map`<`string`, `undefined` \| [`Principal`](Principal.md)\>

#### Defined in

[label.ts:142](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L142)

## Methods

### get

▸ **get**(`name`): `undefined` \| [`Principal`](Principal.md)

Get principal by name.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | Name of principal to find |

#### Returns

`undefined` \| [`Principal`](Principal.md)

principal or undefined

#### Defined in

[label.ts:192](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L192)

___

### insert

▸ **insert**(`label`, `below?`, `above?`): `void`

Insert a new principal between two existing label values.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `label` | [`Principal`](Principal.md) | - |
| `below` | [`Principal`](Principal.md) | {Principal} Principal below the new label value |
| `above` | [`Principal`](Principal.md) | {Principal} Principal above the new label value |

#### Returns

`void`

#### Defined in

[label.ts:166](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L166)

[@google-labs/graph-integrity](../README.md) / [Exports](../modules.md) / Principal

# Class: Principal

Information flow control label values, i.e. levels of trust.

## Table of contents

### Constructors

- [constructor](Principal.md#constructor)

### Properties

- [above](Principal.md#above)
- [below](Principal.md#below)
- [name](Principal.md#name)

### Methods

- [isAbove](Principal.md#isabove)
- [isBelow](Principal.md#isbelow)
- [greatestLowerBound](Principal.md#greatestlowerbound)
- [leastUpperBound](Principal.md#leastupperbound)

## Constructors

### constructor

• **new Principal**(`name`)

Create new label. Must be

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | {string} Name of the label value |

**`Method`**

ed into the semi-lattice.

#### Defined in

[label.ts:20](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L20)

## Properties

### above

• **above**: [`Principal`](Principal.md)[]

#### Defined in

[label.ts:12](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L12)

___

### below

• **below**: [`Principal`](Principal.md)[]

#### Defined in

[label.ts:11](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L11)

___

### name

• **name**: `string`

#### Defined in

[label.ts:13](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L13)

## Methods

### isAbove

▸ **isAbove**(`other`): `boolean`

Test whether this label is above another in the semi-lattice.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `other` | [`Principal`](Principal.md) | {Principal} Principal to compare with |

#### Returns

`boolean`

true if this label is above the other

#### Defined in

[label.ts:48](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L48)

___

### isBelow

▸ **isBelow**(`other`): `boolean`

Test whether this label is below another in the semi-lattice.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `other` | [`Principal`](Principal.md) | {Principal} Principal to compare with |

#### Returns

`boolean`

true if this label is above the other

#### Defined in

[label.ts:32](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L32)

___

### greatestLowerBound

▸ `Static` **greatestLowerBound**(`values`): `undefined` \| [`Principal`](Principal.md)

Lower bound of TRUSTED and UNTRUSTED is UNTRUSTED.
Only TRUSTED and TRUSTED is TRUSTED.

Returns undefined for an empty list.

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | [`Principal`](Principal.md)[] |

#### Returns

`undefined` \| [`Principal`](Principal.md)

#### Defined in

[label.ts:97](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L97)

___

### leastUpperBound

▸ `Static` **leastUpperBound**(`values`): `undefined` \| [`Principal`](Principal.md)

Upper bound of TRUSTED and UNTRUSTED is TRUSTED.
Only UNTRUSTED and UNTRUSTED is UNTRUSTED.

Returns undefined for an empty list.

#### Parameters

| Name | Type |
| :------ | :------ |
| `values` | [`Principal`](Principal.md)[] |

#### Returns

`undefined` \| [`Principal`](Principal.md)

#### Defined in

[label.ts:64](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/graph-integrity/src/label.ts#L64)

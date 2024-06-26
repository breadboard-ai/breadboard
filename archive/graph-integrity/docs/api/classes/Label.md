[@google-labs/graph-integrity](../README.md) / [Exports](../modules.md) / Label

# Class: Label

Information flow control label.

## Table of contents

### Constructors

- [constructor](Label.md#constructor)

### Properties

- [confidentiality](Label.md#confidentiality)
- [integrity](Label.md#integrity)

### Methods

- [canFlowTo](Label.md#canflowto)
- [equalsTo](Label.md#equalsto)
- [equalsToExceptForUndefined](Label.md#equalstoexceptforundefined)
- [toString](Label.md#tostring)
- [computeJoinOfLabels](Label.md#computejoinoflabels)
- [computeMeetOfLabels](Label.md#computemeetoflabels)
- [getLabelComponents](Label.md#getlabelcomponents)

## Constructors

### constructor

• **new Label**(`label?`): [`Label`](Label.md)

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `label` | `undefined` \| [`Label`](Label.md) \| \{ `confidentiality?`: [`Principal`](Principal.md) ; `integrity?`: [`Principal`](Principal.md)  } | `undefined` | Label to copy or pair of Principals to create a new label from. |

#### Returns

[`Label`](Label.md)

#### Defined in

[label.ts:208](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/graph-integrity/src/label.ts#L208)

## Properties

### confidentiality

• `Optional` `Readonly` **confidentiality**: [`Principal`](Principal.md)

#### Defined in

[label.ts:201](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/graph-integrity/src/label.ts#L201)

___

### integrity

• `Optional` `Readonly` **integrity**: [`Principal`](Principal.md)

#### Defined in

[label.ts:202](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/graph-integrity/src/label.ts#L202)

## Methods

### canFlowTo

▸ **canFlowTo**(`destinationLabel`): `boolean`

Checks whether the label can flow to the destination label.
Flow between undetermined labels is always allowed.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `destinationLabel` | `undefined` \| [`Label`](Label.md) | label to flow to |

#### Returns

`boolean`

true if the label can flow to the destination label

#### Defined in

[label.ts:314](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/graph-integrity/src/label.ts#L314)

___

### equalsTo

▸ **equalsTo**(`other`): `boolean`

Compare with other label.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `other` | [`Label`](Label.md) | label |

#### Returns

`boolean`

true if the labels are equal

#### Defined in

[label.ts:283](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/graph-integrity/src/label.ts#L283)

___

### equalsToExceptForUndefined

▸ **equalsToExceptForUndefined**(`other`): `boolean`

Compare with other label, but only if both are defined.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `other` | [`Label`](Label.md) | label |

#### Returns

`boolean`

true if the labels are equal

#### Defined in

[label.ts:296](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/graph-integrity/src/label.ts#L296)

___

### toString

▸ **toString**(): `undefined` \| `string`

Convert label to human-readable string.

#### Returns

`undefined` \| `string`

human-readable string

#### Defined in

[label.ts:329](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/graph-integrity/src/label.ts#L329)

___

### computeJoinOfLabels

▸ **computeJoinOfLabels**(`labels`): [`Label`](Label.md)

Join (⊔):

#### Parameters

| Name | Type |
| :------ | :------ |
| `labels` | (`undefined` \| [`Label`](Label.md))[] |

#### Returns

[`Label`](Label.md)

that is equal or less restrictive than any of
the passed

#### Defined in

[label.ts:248](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/graph-integrity/src/label.ts#L248)

___

### computeMeetOfLabels

▸ **computeMeetOfLabels**(`labels`): [`Label`](Label.md)

Meet (⊓):

#### Parameters

| Name | Type |
| :------ | :------ |
| `labels` | (`undefined` \| [`Label`](Label.md))[] |

#### Returns

[`Label`](Label.md)

that is equal or more restrictive than any of
the passed

#### Defined in

[label.ts:229](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/graph-integrity/src/label.ts#L229)

___

### getLabelComponents

▸ **getLabelComponents**(`labels`): `Object`

Extract label components, throwing a away all undefined ones.
Might return empty lists if there are no defined label components.

#### Parameters

| Name | Type |
| :------ | :------ |
| `labels` | (`undefined` \| [`Label`](Label.md))[] |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `confidentialityLabels` | [`Principal`](Principal.md)[] |
| `integrityLabels` | [`Principal`](Principal.md)[] |

#### Defined in

[label.ts:262](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/graph-integrity/src/label.ts#L262)

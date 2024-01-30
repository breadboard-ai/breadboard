[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / SchemaBuilder

# Class: SchemaBuilder

## Table of contents

### Constructors

- [constructor](SchemaBuilder.md#constructor)

### Properties

- [additionalProperties](SchemaBuilder.md#additionalproperties)
- [properties](SchemaBuilder.md#properties)
- [required](SchemaBuilder.md#required)

### Methods

- [addInputs](SchemaBuilder.md#addinputs)
- [addProperties](SchemaBuilder.md#addproperties)
- [addProperty](SchemaBuilder.md#addproperty)
- [addRequired](SchemaBuilder.md#addrequired)
- [build](SchemaBuilder.md#build)
- [setAdditionalProperties](SchemaBuilder.md#setadditionalproperties)
- [empty](SchemaBuilder.md#empty)

## Constructors

### constructor

• **new SchemaBuilder**(): [`SchemaBuilder`](SchemaBuilder.md)

#### Returns

[`SchemaBuilder`](SchemaBuilder.md)

## Properties

### additionalProperties

• **additionalProperties**: `boolean` = `false`

#### Defined in

[packages/breadboard/src/schema.ts:31](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/schema.ts#L31)

___

### properties

• **properties**: `SchemaProperties` = `{}`

#### Defined in

[packages/breadboard/src/schema.ts:33](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/schema.ts#L33)

___

### required

• **required**: `string`[] = `[]`

#### Defined in

[packages/breadboard/src/schema.ts:32](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/schema.ts#L32)

## Methods

### addInputs

▸ **addInputs**(`inputs?`): [`SchemaBuilder`](SchemaBuilder.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `inputs?` | [`InputValues`](../modules.md#inputvalues) |

#### Returns

[`SchemaBuilder`](SchemaBuilder.md)

#### Defined in

[packages/breadboard/src/schema.ts:54](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/schema.ts#L54)

___

### addProperties

▸ **addProperties**(`properties`): [`SchemaBuilder`](SchemaBuilder.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `properties` | `SchemaProperties` |

#### Returns

[`SchemaBuilder`](SchemaBuilder.md)

#### Defined in

[packages/breadboard/src/schema.ts:67](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/schema.ts#L67)

___

### addProperty

▸ **addProperty**(`name`, `schema`): [`SchemaBuilder`](SchemaBuilder.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `schema` | [`Schema`](../modules.md#schema) |

#### Returns

[`SchemaBuilder`](SchemaBuilder.md)

#### Defined in

[packages/breadboard/src/schema.ts:62](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/schema.ts#L62)

___

### addRequired

▸ **addRequired**(`required?`): [`SchemaBuilder`](SchemaBuilder.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `required?` | `string` \| `string`[] |

#### Returns

[`SchemaBuilder`](SchemaBuilder.md)

#### Defined in

[packages/breadboard/src/schema.ts:74](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/schema.ts#L74)

___

### build

▸ **build**(): [`Schema`](../modules.md#schema)

#### Returns

[`Schema`](../modules.md#schema)

#### Defined in

[packages/breadboard/src/schema.ts:35](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/schema.ts#L35)

___

### setAdditionalProperties

▸ **setAdditionalProperties**(`additionalProperties?`): [`SchemaBuilder`](SchemaBuilder.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `additionalProperties?` | `boolean` |

#### Returns

[`SchemaBuilder`](SchemaBuilder.md)

#### Defined in

[packages/breadboard/src/schema.ts:47](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/schema.ts#L47)

___

### empty

▸ **empty**(`additionalProperties?`): [`Schema`](../modules.md#schema)

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `additionalProperties` | `boolean` | `false` |

#### Returns

[`Schema`](../modules.md#schema)

#### Defined in

[packages/breadboard/src/schema.ts:85](https://github.com/breadboard-ai/breadboard/blob/4af8d5b0/packages/breadboard/src/schema.ts#L85)

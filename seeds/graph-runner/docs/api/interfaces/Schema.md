[@google-labs/graph-runner](../README.md) / [Exports](../modules.md) / Schema

# Interface: Schema

## Table of contents

### Properties

- [$id](Schema.md#$id)
- [$ref](Schema.md#$ref)
- [$schema](Schema.md#$schema)
- [additionalItems](Schema.md#additionalitems)
- [additionalProperties](Schema.md#additionalproperties)
- [allOf](Schema.md#allof)
- [anyOf](Schema.md#anyof)
- [const](Schema.md#const)
- [definitions](Schema.md#definitions)
- [dependencies](Schema.md#dependencies)
- [description](Schema.md#description)
- [else](Schema.md#else)
- [enum](Schema.md#enum)
- [exclusiveMaximum](Schema.md#exclusivemaximum)
- [exclusiveMinimum](Schema.md#exclusiveminimum)
- [format](Schema.md#format)
- [id](Schema.md#id)
- [if](Schema.md#if)
- [items](Schema.md#items)
- [maxItems](Schema.md#maxitems)
- [maxLength](Schema.md#maxlength)
- [maxProperties](Schema.md#maxproperties)
- [maximum](Schema.md#maximum)
- [minItems](Schema.md#minitems)
- [minLength](Schema.md#minlength)
- [minProperties](Schema.md#minproperties)
- [minimum](Schema.md#minimum)
- [multipleOf](Schema.md#multipleof)
- [not](Schema.md#not)
- [oneOf](Schema.md#oneof)
- [pattern](Schema.md#pattern)
- [patternProperties](Schema.md#patternproperties)
- [properties](Schema.md#properties)
- [required](Schema.md#required)
- [then](Schema.md#then)
- [title](Schema.md#title)
- [type](Schema.md#type)
- [uniqueItems](Schema.md#uniqueitems)

## Properties

### $id

• `Optional` **$id**: `string`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:52

___

### $ref

• `Optional` **$ref**: `string`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:55

___

### $schema

• `Optional` **$schema**: `string`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:54

___

### additionalItems

• `Optional` **additionalItems**: `boolean` \| [`Schema`](Schema.md)

#### Defined in

node_modules/jsonschema/lib/index.d.ts:66

___

### additionalProperties

• `Optional` **additionalProperties**: `boolean` \| [`Schema`](Schema.md)

#### Defined in

node_modules/jsonschema/lib/index.d.ts:74

___

### allOf

• `Optional` **allOf**: [`Schema`](Schema.md)[]

#### Defined in

node_modules/jsonschema/lib/index.d.ts:91

___

### anyOf

• `Optional` **anyOf**: [`Schema`](Schema.md)[]

#### Defined in

node_modules/jsonschema/lib/index.d.ts:92

___

### const

• `Optional` **const**: `any`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:87

___

### definitions

• `Optional` **definitions**: `Object`

#### Index signature

▪ [name: `string`]: [`Schema`](Schema.md)

#### Defined in

node_modules/jsonschema/lib/index.d.ts:75

___

### dependencies

• `Optional` **dependencies**: `Object`

#### Index signature

▪ [name: `string`]: [`Schema`](Schema.md) \| `string`[]

#### Defined in

node_modules/jsonschema/lib/index.d.ts:84

___

### description

• `Optional` **description**: `string`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:57

___

### else

• `Optional` **else**: [`Schema`](Schema.md)

#### Defined in

node_modules/jsonschema/lib/index.d.ts:97

___

### enum

• `Optional` **enum**: `any`[]

#### Defined in

node_modules/jsonschema/lib/index.d.ts:88

___

### exclusiveMaximum

• `Optional` **exclusiveMaximum**: `number` \| `boolean`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:60

___

### exclusiveMinimum

• `Optional` **exclusiveMinimum**: `number` \| `boolean`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:62

___

### format

• `Optional` **format**: `string`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:90

___

### id

• `Optional` **id**: `string`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:53

___

### if

• `Optional` **if**: [`Schema`](Schema.md)

#### Defined in

node_modules/jsonschema/lib/index.d.ts:95

___

### items

• `Optional` **items**: [`Schema`](Schema.md) \| [`Schema`](Schema.md)[]

#### Defined in

node_modules/jsonschema/lib/index.d.ts:67

___

### maxItems

• `Optional` **maxItems**: `number`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:68

___

### maxLength

• `Optional` **maxLength**: `number`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:63

___

### maxProperties

• `Optional` **maxProperties**: `number`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:71

___

### maximum

• `Optional` **maximum**: `number`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:59

___

### minItems

• `Optional` **minItems**: `number`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:69

___

### minLength

• `Optional` **minLength**: `number`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:64

___

### minProperties

• `Optional` **minProperties**: `number`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:72

___

### minimum

• `Optional` **minimum**: `number`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:61

___

### multipleOf

• `Optional` **multipleOf**: `number`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:58

___

### not

• `Optional` **not**: [`Schema`](Schema.md)

#### Defined in

node_modules/jsonschema/lib/index.d.ts:94

___

### oneOf

• `Optional` **oneOf**: [`Schema`](Schema.md)[]

#### Defined in

node_modules/jsonschema/lib/index.d.ts:93

___

### pattern

• `Optional` **pattern**: `string` \| `RegExp`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:65

___

### patternProperties

• `Optional` **patternProperties**: `Object`

#### Index signature

▪ [name: `string`]: [`Schema`](Schema.md)

#### Defined in

node_modules/jsonschema/lib/index.d.ts:81

___

### properties

• `Optional` **properties**: `Object`

#### Index signature

▪ [name: `string`]: [`Schema`](Schema.md)

#### Defined in

node_modules/jsonschema/lib/index.d.ts:78

___

### required

• `Optional` **required**: `boolean` \| `string`[]

#### Defined in

node_modules/jsonschema/lib/index.d.ts:73

___

### then

• `Optional` **then**: [`Schema`](Schema.md)

#### Defined in

node_modules/jsonschema/lib/index.d.ts:96

___

### title

• `Optional` **title**: `string`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:56

___

### type

• `Optional` **type**: `string` \| `string`[]

#### Defined in

node_modules/jsonschema/lib/index.d.ts:89

___

### uniqueItems

• `Optional` **uniqueItems**: `boolean`

#### Defined in

node_modules/jsonschema/lib/index.d.ts:70

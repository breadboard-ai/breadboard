[@google-labs/breadboard](../README.md) / [Exports](../modules.md) / Kit

# Interface: Kit

## Hierarchy

- [`KitDescriptor`](../modules.md#kitdescriptor)

  ↳ **`Kit`**

## Table of contents

### Properties

- [description](Kit.md#description)
- [title](Kit.md#title)
- [url](Kit.md#url)
- [version](Kit.md#version)

### Accessors

- [handlers](Kit.md#handlers)

## Properties

### description

• `Optional` **description**: `string`

The description of the kit.

#### Inherited from

KitDescriptor.description

#### Defined in

[packages/breadboard/src/types.ts:155](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L155)

___

### title

• `Optional` **title**: `string`

The title of the kit.

#### Inherited from

KitDescriptor.title

#### Defined in

[packages/breadboard/src/types.ts:151](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L151)

___

### url

• **url**: `string`

The URL pointing to the location of the kit.

#### Inherited from

KitDescriptor.url

#### Defined in

[packages/breadboard/src/types.ts:144](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L144)

___

### version

• `Optional` **version**: `string`

Version of the kit.
[semver](https://semver.org/) format is encouraged.

#### Inherited from

KitDescriptor.version

#### Defined in

[packages/breadboard/src/types.ts:160](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L160)

## Accessors

### handlers

• `get` **handlers**(): [`NodeHandlers`](../modules.md#nodehandlers)

#### Returns

[`NodeHandlers`](../modules.md#nodehandlers)

#### Defined in

[packages/breadboard/src/types.ts:339](https://github.com/breadboard-ai/breadboard/blob/5005f139/packages/breadboard/src/types.ts#L339)

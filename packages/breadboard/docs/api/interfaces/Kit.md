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

[seeds/breadboard/src/types.ts:134](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/types.ts#L134)

---

### title

• `Optional` **title**: `string`

The title of the kit.

#### Inherited from

KitDescriptor.title

#### Defined in

[seeds/breadboard/src/types.ts:130](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/types.ts#L130)

---

### url

• **url**: `string`

The URL pointing to the location of the kit.

#### Inherited from

KitDescriptor.url

#### Defined in

[seeds/breadboard/src/types.ts:123](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/types.ts#L123)

---

### version

• `Optional` **version**: `string`

Version of the kit.
[semver](https://semver.org/) format is encouraged.

#### Inherited from

KitDescriptor.version

#### Defined in

[seeds/breadboard/src/types.ts:139](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/types.ts#L139)

## Accessors

### handlers

• `get` **handlers**(): [`NodeHandlers`](../modules.md#nodehandlers)<[`NodeHandlerContext`](NodeHandlerContext.md)\>

#### Returns

[`NodeHandlers`](../modules.md#nodehandlers)<[`NodeHandlerContext`](NodeHandlerContext.md)\>

#### Defined in

[seeds/breadboard/src/types.ts:318](https://github.com/breadboard-ai/breadboard/blob/99919d5/seeds/breadboard/src/types.ts#L318)

[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / ContentFilter

# Interface: ContentFilter

Content filtering metadata associated with processing a single request. ContentFilter contains a reason and an optional supporting string. The reason may be unspecified.

## Table of contents

### Properties

- [message](ContentFilter.md#message)
- [reason](ContentFilter.md#reason)

## Properties

### message

• `Optional` **message**: `string`

A string that describes the filtering behavior in more detail.

#### Defined in

[types.ts:39](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L39)

___

### reason

• `Optional` **reason**: ``"BLOCKED_REASON_UNSPECIFIED"`` \| ``"SAFETY"`` \| ``"OTHER"``

The reason content was blocked during request processing.

#### Defined in

[types.ts:43](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L43)

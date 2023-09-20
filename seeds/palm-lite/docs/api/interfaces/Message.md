[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / Message

# Interface: Message

The base unit of structured text. A `Message` includes an `author` and the `content` of the `Message`. The `author` is used to tag messages when they are fed to the model as text.

## Table of contents

### Properties

- [author](Message.md#author)
- [citationMetadata](Message.md#citationmetadata)
- [content](Message.md#content)

## Properties

### author

• `Optional` **author**: `string`

Optional. The author of this Message. This serves as a key for tagging the content of this Message when it is fed to the model as text. The author can be any alphanumeric string.

#### Defined in

[types.ts:207](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L207)

___

### citationMetadata

• `Optional` **citationMetadata**: [`CitationMetadata`](CitationMetadata.md)

Output only. Citation information for model-generated `content` in this `Message`. If this `Message` was generated as output from the model, this field may be populated with attribution information for any text included in the `content`. This field is used only on output.

#### Defined in

[types.ts:211](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L211)

___

### content

• `Optional` **content**: `string`

Required. The text content of the structured `Message`.

#### Defined in

[types.ts:215](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L215)

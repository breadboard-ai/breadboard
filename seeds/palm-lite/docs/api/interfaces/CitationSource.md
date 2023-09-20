[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / CitationSource

# Interface: CitationSource

A citation to a source for a portion of a specific response.

## Table of contents

### Properties

- [endIndex](CitationSource.md#endindex)
- [license](CitationSource.md#license)
- [startIndex](CitationSource.md#startindex)
- [uri](CitationSource.md#uri)

## Properties

### endIndex

• `Optional` **endIndex**: `number`

Optional. End of the attributed segment, exclusive.

#### Defined in

[types.ts:19](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L19)

___

### license

• `Optional` **license**: `string`

Optional. License for the GitHub project that is attributed as a source for segment. License info is required for code citations.

#### Defined in

[types.ts:23](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L23)

___

### startIndex

• `Optional` **startIndex**: `number`

Optional. Start of segment of the response that is attributed to this source. Index indicates the start of the segment, measured in bytes.

#### Defined in

[types.ts:27](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L27)

___

### uri

• `Optional` **uri**: `string`

Optional. URI that is attributed as a source for a portion of the text.

#### Defined in

[types.ts:31](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L31)

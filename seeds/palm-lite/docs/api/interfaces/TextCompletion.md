[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / TextCompletion

# Interface: TextCompletion

Output text returned from a model.

## Table of contents

### Properties

- [citationMetadata](TextCompletion.md#citationmetadata)
- [output](TextCompletion.md#output)
- [safetyRatings](TextCompletion.md#safetyratings)

## Properties

### citationMetadata

• `Optional` **citationMetadata**: [`CitationMetadata`](CitationMetadata.md)

Output only. Citation information for model-generated `output` in this `TextCompletion`. This field may be populated with attribution information for any text included in the `output`.

#### Defined in

[types.ts:346](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L346)

___

### output

• `Optional` **output**: `string`

Output only. The generated text returned from the model.

#### Defined in

[types.ts:350](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L350)

___

### safetyRatings

• `Optional` **safetyRatings**: [`SafetyRating`](SafetyRating.md)[]

Ratings for the safety of a response. There is at most one rating per category.

#### Defined in

[types.ts:354](https://github.com/Chizobaonorh/labs-prototypes/blob/220f97e/seeds/palm-lite/src/types.ts#L354)

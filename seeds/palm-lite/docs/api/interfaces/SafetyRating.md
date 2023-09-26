[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / SafetyRating

# Interface: SafetyRating

Safety rating for a piece of content. The safety rating contains the category of harm and the harm probability level in that category for a piece of content. Content is classified for safety across a number of harm categories and the probability of the harm classification is included here.

## Table of contents

### Properties

- [category](SafetyRating.md#category)
- [probability](SafetyRating.md#probability)

## Properties

### category

• `Optional` **category**: ``"HARM_CATEGORY_UNSPECIFIED"`` \| ``"HARM_CATEGORY_DEROGATORY"`` \| ``"HARM_CATEGORY_TOXICITY"`` \| ``"HARM_CATEGORY_VIOLENCE"`` \| ``"HARM_CATEGORY_SEXUAL"`` \| ``"HARM_CATEGORY_MEDICAL"`` \| ``"HARM_CATEGORY_DANGEROUS"``

Required. The category for this rating.

#### Defined in

[types.ts:299](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L299)

___

### probability

• `Optional` **probability**: ``"HARM_PROBABILITY_UNSPECIFIED"`` \| ``"NEGLIGIBLE"`` \| ``"LOW"`` \| ``"MEDIUM"`` \| ``"HIGH"``

Required. The probability of harm for this content.

#### Defined in

[types.ts:310](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L310)

[@google-labs/palm-lite](../README.md) / [Exports](../modules.md) / SafetySetting

# Interface: SafetySetting

Safety setting, affecting the safety-blocking behavior. Passing a safety setting for a category changes the allowed proability that content is blocked.

## Table of contents

### Properties

- [category](SafetySetting.md#category)
- [threshold](SafetySetting.md#threshold)

## Properties

### category

• `Optional` **category**: ``"HARM_CATEGORY_UNSPECIFIED"`` \| ``"HARM_CATEGORY_DEROGATORY"`` \| ``"HARM_CATEGORY_TOXICITY"`` \| ``"HARM_CATEGORY_VIOLENCE"`` \| ``"HARM_CATEGORY_SEXUAL"`` \| ``"HARM_CATEGORY_MEDICAL"`` \| ``"HARM_CATEGORY_DANGEROUS"``

Required. The category for this setting.

#### Defined in

[types.ts:323](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L323)

___

### threshold

• `Optional` **threshold**: ``"HARM_BLOCK_THRESHOLD_UNSPECIFIED"`` \| ``"BLOCK_LOW_AND_ABOVE"`` \| ``"BLOCK_MEDIUM_AND_ABOVE"`` \| ``"BLOCK_ONLY_HIGH"``

Required. Controls the probability threshold at which harm is blocked.

#### Defined in

[types.ts:334](https://github.com/Chizobaonorh/labs-prototypes/blob/0d5a680/seeds/palm-lite/src/types.ts#L334)

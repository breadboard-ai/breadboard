/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParticleTemplate } from "../types/types";

export const twoColumnMediaLeft: ParticleTemplate = {
  group: [
    [
      "main",
      {
        group: [
          [
            "left",
            {
              presentation: {
                type: "card",
                behaviors: [],
                orientation: "vertical",
                segments: [
                  {
                    fields: {
                      "hero-image": {
                        as: "particle-viewer-image",
                        title: "Hero Image",
                        take: 1,
                      },
                    },
                    orientation: "vertical",
                    weight: 1,
                    type: "media",
                  },
                  {
                    fields: {
                      "audio-player": {
                        as: "particle-viewer-audio",
                        title: "Audio",
                        take: 1,
                      },
                    },
                    orientation: "vertical",
                    weight: 1,
                    type: "media",
                  },
                ],
              },
            },
          ],
          [
            "right",
            {
              presentation: {
                type: "list",
                behaviors: [],
                orientation: "vertical",
              },
              group: [
                [
                  "list",
                  {
                    presentation: {
                      type: "card",
                      behaviors: [],
                      orientation: "vertical",
                      segments: [
                        {
                          fields: {
                            "body-copy": {
                              as: "particle-viewer-text",
                              title: "Body Copy",
                            },
                          },
                          orientation: "vertical",
                          weight: 1,
                          type: "block",
                        },
                      ],
                    },
                  },
                ],
              ],
            },
          ],
        ],
        presentation: {
          behaviors: [],
          orientation: "horizontal",
          type: "list",
        },
      },
    ],
  ],
  presentation: {
    behaviors: [],
    orientation: "vertical",
    type: "list",
  },
};

export const twoColumnImageRight: ParticleTemplate = {
  presentation: {
    type: "card",
    behaviors: [],
    orientation: "horizontal",
    segments: [
      {
        fields: {
          "body-copy": {
            as: "particle-viewer-text",
            title: "Hero Image",
          },
        },
        orientation: "vertical",
        weight: 1,
        type: "block",
      },

      {
        fields: {
          "hero-image": {
            as: "particle-viewer-image",
            title: "Hero Image",
            take: 1,
          },
        },
        orientation: "vertical",
        weight: 1,
        type: "media",
      },
    ],
  },
};

export const textOnlyVerticalList: ParticleTemplate = {
  group: [
    [
      "text",
      {
        presentation: {
          type: "card",
          behaviors: [],
          orientation: "vertical",
          segments: [
            {
              fields: {
                "body-copy": {
                  as: "particle-viewer-text",
                  title: "Hero Image",
                },
              },
              orientation: "vertical",
              weight: 1,
              type: "block",
            },
          ],
        },
      },
    ],
  ],
  presentation: {
    type: "list",
    behaviors: [],
    orientation: "horizontal",
  },
};

export const imageLeftRightTextBelow: ParticleTemplate = {
  group: [
    [
      "images",
      {
        presentation: {
          type: "card",
          behaviors: [],
          orientation: "horizontal",
          segments: [
            {
              fields: {
                "hero-image": {
                  as: "particle-viewer-image",
                  title: "Images",
                },
              },
              orientation: "horizontal",
              weight: 1,
              type: "media",
            },
          ],
        },
      },
    ],
    [
      "text",
      {
        presentation: {
          type: "card",
          behaviors: [],
          orientation: "vertical",
          segments: [
            {
              fields: {
                "body-copy": {
                  as: "particle-viewer-text",
                  title: "Hero Image",
                },
              },
              orientation: "vertical",
              weight: 1,
              type: "block",
            },
          ],
        },
      },
    ],
  ],
  presentation: {
    type: "list",
    behaviors: [],
    orientation: "vertical",
  },
};

export const wildcardLayout: ParticleTemplate = {
  group: [
    [
      "*",
      {
        presentation: {
          behaviors: [],
          orientation: "vertical",
          type: "list",
        },
      },
    ],
  ],
  presentation: {
    type: "list",
    behaviors: [],
    orientation: "vertical",
  },
};

export const twoColumnImageRightWildcardBelow: ParticleTemplate = {
  group: [
    [
      "main",
      {
        presentation: {
          type: "card",
          behaviors: [],
          orientation: "horizontal",
          segments: [
            {
              fields: {
                "body-copy": {
                  as: "particle-viewer-text",
                  title: "Hero Image",
                },
              },
              orientation: "vertical",
              weight: 1,
              type: "block",
            },

            {
              fields: {
                "hero-image": {
                  as: "particle-viewer-image",
                  title: "Hero Image",
                  take: 1,
                },
              },
              orientation: "vertical",
              weight: 1,
              type: "media",
            },
          ],
        },
      },
    ],
    [
      "*",
      {
        presentation: {
          behaviors: [],
          orientation: "vertical",
          type: "list",
        },
      },
    ],
  ],
  presentation: {
    type: "list",
    behaviors: [],
    orientation: "vertical",
  },
};

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const fix = [
  {
    surfaceId: "itinerary_surface",
    surfaceUpdate: {
      components: [
        {
          id: "root_column",
          component: {
            Column: {
              children: {
                explicitList: ["trip_title", "days_list"],
              },
            },
          },
        },
        {
          id: "trip_title",
          component: {
            Heading: {
              text: {
                literal: "Paris Adventure",
              },
              level: "1",
            },
          },
        },
        {
          id: "days_list",
          component: {
            List: {
              children: {
                explicitList: ["day1_card", "day2_card", "day3_card"],
              },
            },
          },
        },
        {
          id: "day1_card",
          component: {
            Card: {
              child: "day1_column",
            },
          },
        },
        {
          id: "day1_column",
          component: {
            Column: {
              children: {
                explicitList: ["day1_title", "day1_activities_list"],
              },
            },
          },
        },
        {
          id: "day1_title",
          component: {
            Heading: {
              text: {
                literal: "Day 1: Arrival & Eiffel Tower",
              },
              level: "3",
            },
          },
        },
        {
          id: "day1_activities_list",
          component: {
            List: {
              children: {
                explicitList: [
                  "day1_activity1_row",
                  "day1_activity2_row",
                  "day1_activity3_row",
                ],
              },
            },
          },
        },
        {
          id: "day1_activity1_row",
          component: {
            Row: {
              children: {
                explicitList: [
                  "day1_activity1_checkbox",
                  "day1_activity1_text",
                ],
              },
            },
          },
        },
        {
          id: "day1_activity1_checkbox",
          component: {
            CheckBox: {
              label: {
                literal: "",
              },
              value: {
                literalBoolean: false,
              },
            },
          },
        },
        {
          id: "day1_activity1_text",
          component: {
            Text: {
              text: {
                literal: "Check into hotel",
              },
            },
          },
        },
        {
          id: "day1_activity2_row",
          component: {
            Row: {
              children: {
                explicitList: [
                  "day1_activity2_checkbox",
                  "day1_activity2_text",
                ],
              },
            },
          },
        },
        {
          id: "day1_activity2_checkbox",
          component: {
            CheckBox: {
              label: {
                literal: "",
              },
              value: {
                literalBoolean: false,
              },
            },
          },
        },
        {
          id: "day1_activity2_text",
          component: {
            Text: {
              text: {
                literal: "Lunch at a cafe",
              },
            },
          },
        },
        {
          id: "day1_activity3_row",
          component: {
            Row: {
              children: {
                explicitList: [
                  "day1_activity3_checkbox",
                  "day1_activity3_text",
                ],
              },
            },
          },
        },
        {
          id: "day1_activity3_checkbox",
          component: {
            CheckBox: {
              label: {
                literal: "",
              },
              value: {
                literalBoolean: false,
              },
            },
          },
        },
        {
          id: "day1_activity3_text",
          component: {
            Text: {
              text: {
                literal: "Visit the Eiffel Tower",
              },
            },
          },
        },
        {
          id: "day2_card",
          component: {
            Card: {
              child: "day2_column",
            },
          },
        },
        {
          id: "day2_column",
          component: {
            Column: {
              children: {
                explicitList: ["day2_title", "day2_activities_list"],
              },
            },
          },
        },
        {
          id: "day2_title",
          component: {
            Heading: {
              text: {
                literal: "Day 2: Museums & Culture",
              },
              level: "3",
            },
          },
        },
        {
          id: "day2_activities_list",
          component: {
            List: {
              children: {
                explicitList: [
                  "day2_activity1_row",
                  "day2_activity2_row",
                  "day2_activity3_row",
                ],
              },
            },
          },
        },
        {
          id: "day2_activity1_row",
          component: {
            Row: {
              children: {
                explicitList: [
                  "day2_activity1_checkbox",
                  "day2_activity1_text",
                ],
              },
            },
          },
        },
        {
          id: "day2_activity1_checkbox",
          component: {
            CheckBox: {
              label: {
                literal: "",
              },
              value: {
                literalBoolean: false,
              },
            },
          },
        },
        {
          id: "day2_activity1_text",
          component: {
            Text: {
              text: {
                literal: "Visit the Louvre Museum",
              },
            },
          },
        },
        {
          id: "day2_activity2_row",
          component: {
            Row: {
              children: {
                explicitList: [
                  "day2_activity2_checkbox",
                  "day2_activity2_text",
                ],
              },
            },
          },
        },
        {
          id: "day2_activity2_checkbox",
          component: {
            CheckBox: {
              label: {
                literal: "",
              },
              value: {
                literalBoolean: false,
              },
            },
          },
        },
        {
          id: "day2_activity2_text",
          component: {
            Text: {
              text: {
                literal: "Walk through Tuileries Garden",
              },
            },
          },
        },
        {
          id: "day2_activity3_row",
          component: {
            Row: {
              children: {
                explicitList: [
                  "day2_activity3_checkbox",
                  "day2_activity3_text",
                ],
              },
            },
          },
        },
        {
          id: "day2_activity3_checkbox",
          component: {
            CheckBox: {
              label: {
                literal: "",
              },
              value: {
                literalBoolean: false,
              },
            },
          },
        },
        {
          id: "day2_activity3_text",
          component: {
            Text: {
              text: {
                literal: "See the Arc de Triomphe",
              },
            },
          },
        },
        {
          id: "day3_card",
          component: {
            Card: {
              child: "day3_column",
            },
          },
        },
        {
          id: "day3_column",
          component: {
            Column: {
              children: {
                explicitList: ["day3_title", "day3_activities_list"],
              },
            },
          },
        },
        {
          id: "day3_title",
          component: {
            Heading: {
              text: {
                literal: "Day 3: Art & Departure",
              },
              level: "3",
            },
          },
        },
        {
          id: "day3_activities_list",
          component: {
            List: {
              children: {
                explicitList: [
                  "day3_activity1_row",
                  "day3_activity2_row",
                  "day3_activity3_row",
                ],
              },
            },
          },
        },
        {
          id: "day3_activity1_row",
          component: {
            Row: {
              children: {
                explicitList: [
                  "day3_activity1_checkbox",
                  "day3_activity1_text",
                ],
              },
            },
          },
        },
        {
          id: "day3_activity1_checkbox",
          component: {
            CheckBox: {
              label: {
                literal: "",
              },
              value: {
                literalBoolean: false,
              },
            },
          },
        },
        {
          id: "day3_activity1_text",
          component: {
            Text: {
              text: {
                literal: "Visit Musée d'Orsay",
              },
            },
          },
        },
        {
          id: "day3_activity2_row",
          component: {
            Row: {
              children: {
                explicitList: [
                  "day3_activity2_checkbox",
                  "day3_activity2_text",
                ],
              },
            },
          },
        },
        {
          id: "day3_activity2_checkbox",
          component: {
            CheckBox: {
              label: {
                literal: "",
              },
              value: {
                literalBoolean: false,
              },
            },
          },
        },
        {
          id: "day3_activity2_text",
          component: {
            Text: {
              text: {
                literal: "Explore Montmartre",
              },
            },
          },
        },
        {
          id: "day3_activity3_row",
          component: {
            Row: {
              children: {
                explicitList: [
                  "day3_activity3_checkbox",
                  "day3_activity3_text",
                ],
              },
            },
          },
        },
        {
          id: "day3_activity3_checkbox",
          component: {
            CheckBox: {
              label: {
                literal: "",
              },
              value: {
                literalBoolean: false,
              },
            },
          },
        },
        {
          id: "day3_activity3_text",
          component: {
            Text: {
              text: {
                literal: "Depart from CDG",
              },
            },
          },
        },
      ],
    },
  },
  {
    surfaceId: "itinerary_surface",
    beginRendering: {
      root: "root_column",
      styles: {
        font: "sans-serif",
        primaryColor: "#2196F3",
      },
    },
  },
];

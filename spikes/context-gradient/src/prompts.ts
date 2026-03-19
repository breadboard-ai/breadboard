/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Prompt definitions for each gradient level and skill loading.
 */

export { GRADIENT_LEVELS, DEFAULT_OBJECTIVE, loadSkill, loadPersona };
export type { GradientLevel };

interface GradientLevel {
  id: string;
  label: string;
  name: string;
  context: string;
}

const DEFAULT_OBJECTIVE = "Help me find a house";

const GRADIENT_LEVELS: GradientLevel[] = [
  {
    id: "L0",
    label: "L0",
    name: "Bare Objective",
    context: "",
  },
  {
    id: "L1",
    label: "L1",
    name: "Observed Constraints",
    context: [
      "From intake conversation:",
      "- Searching in Brooklyn, NY.",
      "- Budget ceiling appears to be around $2M.",
      "- Household requires at least 2 bedrooms and 1.5 bathrooms.",
      "- Expressed preference for condos or townhouses over co-ops.",
    ].join("\n"),
  },
  {
    id: "L2",
    label: "L2",
    name: "Inferred Lifestyle",
    context: [
      "From intake conversation:",
      "- Searching in Brooklyn, NY.",
      "- Budget ceiling appears to be around $2M.",
      "- Household requires at least 2 bedrooms and 1.5 bathrooms.",
      "- Expressed preference for condos or townhouses over co-ops.",
      "",
      "Lifestyle signals (gathered over several sessions):",
      "- One partner commutes daily to Midtown Manhattan by subway.",
      "  Proximity to an express stop seems important — they've mentioned",
      "  commute time unprompted in three separate conversations.",
      "- The other partner works from home. Quiet space has come up twice.",
      "- Two children in elementary school (ages 6 and 8). School district",
      "  quality appears to be a top-3 decision factor.",
      "- Family pattern suggests high walkability need — they don't own a",
      "  car and mentioned walking to school and grocery stores.",
    ].join("\n"),
  },
  {
    id: "L3",
    label: "L3",
    name: "Deep Profile",
    context: [
      "From intake conversation:",
      "- Searching in Brooklyn, NY.",
      "- Budget ceiling appears to be around $2M.",
      "- Household requires at least 2 bedrooms and 1.5 bathrooms.",
      "- Expressed preference for condos or townhouses over co-ops.",
      "",
      "Lifestyle signals (gathered over several sessions):",
      "- One partner commutes daily to Midtown Manhattan by subway.",
      "  Proximity to an express stop seems important — they've mentioned",
      "  commute time unprompted in three separate conversations.",
      "- The other partner works from home. Quiet space has come up twice.",
      "- Two children in elementary school (ages 6 and 8). School district",
      "  quality appears to be a top-3 decision factor.",
      "- Family pattern suggests high walkability need — they don't own a",
      "  car and mentioned walking to school and grocery stores.",
      "",
      "Preference patterns (observed across interactions):",
      "- Strong negative reaction to a dark apartment shown last week.",
      "  Natural light and south-facing orientation appear non-negotiable.",
      "- Ruled out all basement/garden-level units immediately.",
      "- Gravitates toward pre-war buildings with character but has",
      "  expressed anxiety about maintenance — 'no gut renovations.'",
      "- Mentioned outdoor space positively but hasn't filtered for it.",
      "- Safety concern surfaced when discussing kids walking to school.",
      "- Laundry: in-unit preferred, in-building acceptable.",
      "- Reacted negatively to a noisy street during a virtual tour.",
      "",
      "Decision stage (observed behaviours):",
      "- Three months into the search. They've moved past browsing and",
      "  are now focused on a handful of options.",
      "- Two properties exceed the stated budget. They haven't dismissed",
      "  them — keeps returning to look at both.",
      "- The Carroll Gardens listing is a point of discussion between",
      "  partners. One gravitates toward it, the other has commute",
      "  concerns. They've revisited this in a few sessions.",
    ].join("\n"),
  },
];

/** Load the skill file from the server. */
async function loadSkill(): Promise<string> {
  const res = await fetch("/skill.md");
  if (!res.ok) {
    throw new Error(`Failed to load skill: ${res.status}`);
  }
  return res.text();
}

/** Load the EA persona file from the server. */
async function loadPersona(): Promise<string> {
  const res = await fetch("/persona.md");
  if (!res.ok) {
    throw new Error(`Failed to load persona: ${res.status}`);
  }
  return res.text();
}

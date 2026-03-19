/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Fixed property dataset for the house hunting scenario.
 *
 * 12 Brooklyn properties with enough variation to make the gradient
 * interesting: some near express stops, some near good schools, some
 * with character, some modern. The model reasons about this fixed data
 * differently at each context level.
 */

export { PROPERTIES, formatPropertiesForPrompt };
export type { DataMode };

type DataMode = "raw" | "rich";

interface Property {
  id: number;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  type: string;
  yearBuilt: number;
  description: string;
  features: string[];
  transitNotes: string;
  schoolDistrict: string;
  schoolRating: number;
  walkScore: number;
  safetyScore: number;
  facing: string;
  floor: string;
  outdoor: string;
  laundry: string;
  streetNoise: string;
  image: string;
  priceHistory?: { year: number; price: number }[];
}

const PROPERTIES: Property[] = [
  {
    id: 1,
    address: "412 Carroll St",
    neighborhood: "Park Slope",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6743,
    lng: -73.9812,
    price: 2_150_000,
    beds: 3,
    baths: 2,
    sqft: 1_800,
    type: "Brownstone floor-through",
    yearBuilt: 1899,
    description:
      "Classic brownstone floor-through on a tree-lined block. " +
      "Original details throughout including crown moldings and pocket doors.",
    features: ["Pre-war details", "Fireplace", "High ceilings", "Hardwood floors"],
    transitNotes: "4 min walk to F/G at 4th Ave–9th St (express to Midtown: 22 min)",
    schoolDistrict: "District 15",
    schoolRating: 9.1,
    walkScore: 94,
    safetyScore: 8.4,
    facing: "South",
    floor: "2nd floor (parlor level)",
    outdoor: "Shared garden",
    laundry: "In-unit",
    streetNoise: "Quiet, tree-lined",
    image: "/images/property-1.png",
    priceHistory: [
      { year: 2022, price: 1_750_000 },
      { year: 2023, price: 1_850_000 },
      { year: 2024, price: 1_975_000 },
      { year: 2025, price: 2_150_000 },
    ],
  },
  {
    id: 2,
    address: "88 Montague St, Unit 14C",
    neighborhood: "Brooklyn Heights",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6933,
    lng: -73.9930,
    price: 1_695_000,
    beds: 2,
    baths: 2,
    sqft: 1_200,
    type: "Condo",
    yearBuilt: 2018,
    description:
      "Modern condo in a full-service building with doorman, gym, and roof deck. " +
      "Floor-to-ceiling windows with Manhattan skyline views.",
    features: ["Doorman", "Gym", "Roof deck", "Manhattan views"],
    transitNotes: "6 min walk to 2/3 at Clark St (express to Midtown: 15 min)",
    schoolDistrict: "District 13",
    schoolRating: 7.3,
    walkScore: 97,
    safetyScore: 9.1,
    facing: "West",
    floor: "14th floor",
    outdoor: "Building roof deck",
    laundry: "In-unit",
    streetNoise: "Moderate (commercial street)",
    image: "/images/property-2.png",
    priceHistory: [
      { year: 2022, price: 1_800_000 },
      { year: 2023, price: 1_750_000 },
      { year: 2024, price: 1_720_000 },
      { year: 2025, price: 1_695_000 },
    ],
  },
  {
    id: 3,
    address: "267 Prospect Ave",
    neighborhood: "South Slope",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6621,
    lng: -73.9840,
    price: 1_275_000,
    beds: 2,
    baths: 1.5,
    sqft: 1_350,
    type: "Brownstone duplex",
    yearBuilt: 1910,
    description:
      "Charming duplex in a converted brownstone. Exposed brick, wide-plank floors, " +
      "and a private back patio. Needs some cosmetic updating.",
    features: ["Exposed brick", "Private patio", "Duplex layout", "Original details"],
    transitNotes: "7 min walk to F/G at 4th Ave–9th St (express to Midtown: 22 min)",
    schoolDistrict: "District 15",
    schoolRating: 8.8,
    walkScore: 91,
    safetyScore: 7.9,
    facing: "North",
    floor: "Garden + 1st floor",
    outdoor: "Private patio",
    laundry: "In-building (basement)",
    streetNoise: "Moderate",
    image: "/images/property-3.png",
    priceHistory: [
      { year: 2022, price: 1_100_000 },
      { year: 2023, price: 1_150_000 },
      { year: 2024, price: 1_200_000 },
      { year: 2025, price: 1_250_000 },
    ],
  },
  {
    id: 4,
    address: "1450 Flatbush Ave, Unit 8D",
    neighborhood: "Flatbush",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6365,
    lng: -73.9575,
    price: 485_000,
    beds: 2,
    baths: 1,
    sqft: 900,
    type: "Co-op",
    yearBuilt: 1965,
    description:
      "Affordable 2BR in a well-maintained co-op. Recently updated kitchen, " +
      "good light, and a large living room. Building has laundry and parking.",
    features: ["Updated kitchen", "Parking available", "Good light", "Pet-friendly"],
    transitNotes: "3 min walk to B/Q at Newkirk Plaza (to Midtown: 40 min, no express)",
    schoolDistrict: "District 17",
    schoolRating: 5.4,
    walkScore: 85,
    safetyScore: 6.2,
    facing: "East",
    floor: "8th floor",
    outdoor: "None",
    laundry: "In-building",
    streetNoise: "Noisy (main avenue)",
    image: "/images/property-4.png",
    priceHistory: [
      { year: 2022, price: 935_000 },
      { year: 2023, price: 920_000 },
      { year: 2024, price: 950_000 },
      { year: 2025, price: 975_000 },
    ],
  },
  {
    id: 5,
    address: "71 Hanson Pl, Unit 22F",
    neighborhood: "Fort Greene",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6851,
    lng: -73.9780,
    price: 1_450_000,
    beds: 2,
    baths: 2,
    sqft: 1_150,
    type: "Condo",
    yearBuilt: 2010,
    description:
      "Sleek condo in a luxury tower near BAM. Open layout, chef's kitchen, " +
      "in-unit W/D. Steps from Atlantic Terminal with 9 subway lines.",
    features: ["Luxury tower", "Chef's kitchen", "Near BAM", "9 subway lines"],
    transitNotes: "2 min walk to Atlantic Ave–Barclays (B/D/N/Q/R/2/3/4/5 — express to Midtown: 12 min)",
    schoolDistrict: "District 13",
    schoolRating: 7.0,
    walkScore: 98,
    safetyScore: 7.8,
    facing: "South",
    floor: "22nd floor",
    outdoor: "Balcony",
    laundry: "In-unit",
    streetNoise: "Moderate (urban center)",
    image: "/images/property-5.png",
    priceHistory: [
      { year: 2022, price: 1_650_000 },
      { year: 2023, price: 1_700_000 },
      { year: 2024, price: 1_750_000 },
      { year: 2025, price: 1_825_000 },
    ],
  },
  {
    id: 6,
    address: "834 Sterling Pl",
    neighborhood: "Crown Heights",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6710,
    lng: -73.9520,
    price: 1_100_000,
    beds: 3,
    baths: 2,
    sqft: 1_500,
    type: "Brownstone floor-through",
    yearBuilt: 1905,
    description:
      "Renovated brownstone floor-through with a mix of original details and " +
      "modern finishes. Tree-lined street near the Brooklyn Museum.",
    features: ["Renovated", "Near Brooklyn Museum", "Tree-lined", "Fireplace"],
    transitNotes: "5 min walk to 2/3 at Franklin Ave (to Midtown: 30 min)",
    schoolDistrict: "District 17",
    schoolRating: 6.5,
    walkScore: 89,
    safetyScore: 7.0,
    facing: "South",
    floor: "2nd floor",
    outdoor: "Shared backyard",
    laundry: "In-unit",
    streetNoise: "Quiet, tree-lined",
    image: "/images/property-6.png",
    priceHistory: [
      { year: 2022, price: 575_000 },
      { year: 2023, price: 560_000 },
      { year: 2024, price: 545_000 },
      { year: 2025, price: 525_000 },
    ],
  },
  {
    id: 7,
    address: "230 Jay St, Unit 6B",
    neighborhood: "Downtown Brooklyn",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6923,
    lng: -73.9867,
    price: 975_000,
    beds: 1,
    baths: 1,
    sqft: 750,
    type: "Condo",
    yearBuilt: 2016,
    description:
      "Modern 1BR in a new development. Floor-to-ceiling windows, central air, " +
      "and building amenities. Walking distance to everything.",
    features: ["Modern finishes", "Central air", "Gym", "Concierge"],
    transitNotes: "1 min walk to Jay St–MetroTech (A/C/F/R — express to Midtown: 10 min)",
    schoolDistrict: "District 13",
    schoolRating: 6.8,
    walkScore: 99,
    safetyScore: 8.0,
    facing: "East",
    floor: "6th floor",
    outdoor: "None",
    laundry: "In-unit",
    streetNoise: "Noisy (commercial district)",
    image: "/images/property-7.png",
    priceHistory: [
      { year: 2022, price: 1_300_000 },
      { year: 2023, price: 1_350_000 },
      { year: 2024, price: 1_450_000 },
      { year: 2025, price: 1_550_000 },
    ],
  },
  {
    id: 8,
    address: "1523 Pacific St",
    neighborhood: "Crown Heights",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6742,
    lng: -73.9370,
    price: 2_350_000,
    beds: 4,
    baths: 3,
    sqft: 2_400,
    type: "Townhouse",
    yearBuilt: 1890,
    description:
      "Stunning 4-story townhouse with original woodwork, stained glass, and a " +
      "chef's kitchen renovation. Full finished basement. Needs some exterior work.",
    features: ["Full townhouse", "Stained glass", "Chef's kitchen", "Finished basement"],
    transitNotes: "8 min walk to C at Kingston–Throop (to Midtown: 35 min)",
    schoolDistrict: "District 16",
    schoolRating: 5.6,
    walkScore: 82,
    safetyScore: 6.5,
    facing: "South",
    floor: "4 stories + basement",
    outdoor: "Back garden",
    laundry: "In-unit",
    streetNoise: "Moderate",
    image: "/images/property-8.png",
    priceHistory: [
      { year: 2022, price: 1_800_000 },
      { year: 2023, price: 1_950_000 },
      { year: 2024, price: 2_100_000 },
      { year: 2025, price: 2_350_000 },
    ],
  },
  {
    id: 9,
    address: "42 Willow St",
    neighborhood: "Brooklyn Heights",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6963,
    lng: -73.9957,
    price: 1_790_000,
    beds: 3,
    baths: 2,
    sqft: 1_650,
    type: "Co-op",
    yearBuilt: 1928,
    description:
      "Elegant pre-war 3BR on one of Brooklyn's most beautiful streets. " +
      "Herringbone floors, arched doorways, and a wood-burning fireplace. " +
      "Walk to the Promenade.",
    features: ["Pre-war", "Herringbone floors", "Near Promenade", "Fireplace"],
    transitNotes: "8 min walk to 2/3 at Clark St (express to Midtown: 15 min)",
    schoolDistrict: "District 13",
    schoolRating: 7.3,
    walkScore: 96,
    safetyScore: 9.3,
    facing: "West",
    floor: "3rd floor",
    outdoor: "None",
    laundry: "In-building",
    streetNoise: "Very quiet, residential",
    image: "/images/property-9.png",
    priceHistory: [
      { year: 2022, price: 790_000 },
      { year: 2023, price: 820_000 },
      { year: 2024, price: 835_000 },
      { year: 2025, price: 850_000 },
    ],
  },
  {
    id: 10,
    address: "55 4th Ave, Unit 3R",
    neighborhood: "Boerum Hill",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6856,
    lng: -73.9788,
    price: 1_150_000,
    beds: 2,
    baths: 1,
    sqft: 1_050,
    type: "Condo",
    yearBuilt: 2008,
    description:
      "Bright 2BR in a boutique condo building. South-facing with great light. " +
      "Near Smith St restaurants and the Barclays Center.",
    features: ["South-facing", "Boutique building", "Near Smith St", "Pet-friendly"],
    transitNotes: "3 min walk to Atlantic Ave–Barclays (B/D/N/Q/R/2/3/4/5 — express to Midtown: 12 min)",
    schoolDistrict: "District 15",
    schoolRating: 8.5,
    walkScore: 95,
    safetyScore: 8.2,
    facing: "South",
    floor: "3rd floor",
    outdoor: "None",
    laundry: "In-building",
    streetNoise: "Moderate (4th Ave traffic)",
    image: "/images/property-10.png",
    priceHistory: [
      { year: 2022, price: 1_275_000 },
      { year: 2023, price: 1_350_000 },
      { year: 2024, price: 1_395_000 },
      { year: 2025, price: 1_475_000 },
    ],
  },
  {
    id: 11,
    address: "340 Eastern Pkwy, Unit 5A",
    neighborhood: "Prospect Heights",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6712,
    lng: -73.9643,
    price: 899_000,
    beds: 2,
    baths: 1,
    sqft: 1_000,
    type: "Co-op",
    yearBuilt: 1940,
    description:
      "Solid pre-war 2BR near the Brooklyn Museum and Prospect Park. " +
      "Art deco lobby, good bones, needs updating. Street-level noise from " +
      "Eastern Parkway.",
    features: ["Near Prospect Park", "Art deco building", "Brooklyn Museum", "Good bones"],
    transitNotes: "5 min walk to 2/3 at Eastern Pkwy–Brooklyn Museum (to Midtown: 25 min)",
    schoolDistrict: "District 17",
    schoolRating: 6.9,
    walkScore: 92,
    safetyScore: 7.4,
    facing: "North",
    floor: "5th floor",
    outdoor: "None",
    laundry: "In-building",
    streetNoise: "Noisy (Eastern Parkway)",
    image: "/images/property-11.png",
    priceHistory: [
      { year: 2022, price: 610_000 },
      { year: 2023, price: 635_000 },
      { year: 2024, price: 665_000 },
      { year: 2025, price: 685_000 },
    ],
  },
  {
    id: 12,
    address: "196 Luquer St",
    neighborhood: "Carroll Gardens",
    city: "Brooklyn",
    state: "NY",
    lat: 40.6785,
    lng: -73.9955,
    price: 1_625_000,
    beds: 3,
    baths: 2,
    sqft: 1_700,
    type: "Brownstone duplex",
    yearBuilt: 1895,
    description:
      "Beautiful brownstone duplex on a quiet, family-friendly block. " +
      "Renovated kitchen and baths, original parlor details preserved. " +
      "PS 58 (rated 9.4) is one block away.",
    features: ["Renovated", "Family-friendly block", "PS 58 nearby", "Original details"],
    transitNotes: "6 min walk to F/G at Carroll St (express to Midtown: 25 min)",
    schoolDistrict: "District 15",
    schoolRating: 9.4,
    walkScore: 93,
    safetyScore: 8.7,
    facing: "South",
    floor: "1st + 2nd floor",
    outdoor: "Private garden",
    laundry: "In-unit",
    streetNoise: "Very quiet, residential",
    image: "/images/property-12.png",
    priceHistory: [
      { year: 2022, price: 1_600_000 },
      { year: 2023, price: 1_725_000 },
      { year: 2024, price: 1_800_000 },
      { year: 2025, price: 1_895_000 },
    ],
  },
];

/**
 * Format properties for the prompt.
 *
 * - **raw**: Only what a realtor API would return — address, lat/lng, price,
 *   type, beds/baths, sqft, year built, image. The model must reason about
 *   transit, schools, safety, etc. from its own world knowledge.
 *
 * - **rich**: All fields including pre-computed transit notes, school ratings,
 *   walk scores, safety scores, noise levels, etc.
 */
function formatPropertiesForPrompt(mode: DataMode = "rich"): string {
  const lines = ["## Available Listings\n"];
  lines.push(
    "The following 12 properties are the available dataset. Use ONLY these " +
      "listings — do not invent additional properties.\n\n" +
      "**Image paths are real files served by the host.** Use them exactly " +
      "as-is in `<img src=\"...\">` — do not substitute, invent, or use " +
      "external image URLs.\n"
  );

  if (mode === "raw") {
    lines.push(
      "You are given basic listing data only. Use your knowledge of the area " +
        "to reason about commute times, school quality, walkability, safety, " +
        "and any other dimensions that the personal context warrants.\n"
    );
  }

  for (const p of PROPERTIES) {
    lines.push(`### ${p.id}. ${p.address}, ${p.neighborhood}`);
    lines.push(`- **Location**: ${p.city}, ${p.state} (${p.lat}, ${p.lng})`);
    lines.push(`- **Price**: $${p.price.toLocaleString()}`);
    lines.push(`- **Type**: ${p.type} (built ${p.yearBuilt})`);
    lines.push(`- **Size**: ${p.beds}BR / ${p.baths}BA / ${p.sqft} sqft`);
    lines.push(`- **Image**: \`${p.image}\` (use this exact path)`);

    if (mode === "rich") {
      lines.push(`- **Description**: ${p.description}`);
      lines.push(`- **Features**: ${p.features.join(", ")}`);
      lines.push(`- **Transit**: ${p.transitNotes}`);
      lines.push(`- **School district**: ${p.schoolDistrict} (rating: ${p.schoolRating}/10)`);
      lines.push(`- **Walk score**: ${p.walkScore}/100`);
      lines.push(`- **Safety score**: ${p.safetyScore}/10`);
      lines.push(`- **Facing**: ${p.facing}`);
      lines.push(`- **Floor**: ${p.floor}`);
      lines.push(`- **Outdoor space**: ${p.outdoor}`);
      lines.push(`- **Laundry**: ${p.laundry}`);
      lines.push(`- **Street noise**: ${p.streetNoise}`);
      if (p.priceHistory?.length) {
        const history = p.priceHistory
          .map((h) => `${h.year}: $${h.price.toLocaleString()}`)
          .join(", ");
        lines.push(`- **Price history**: ${history}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Faux party planner data for the Universals Transfer demo.
 *
 * A birthday party in 10 days with guests, tasks, and venue details.
 * Intentionally a different domain from property listings and editorial
 * briefings — the point is to show that universal style preferences
 * transfer to a surface the user has never directly refined.
 */

export { PARTY, formatPartyForPrompt };

interface Guest {
  name: string;
  rsvp: "confirmed" | "pending" | "declined";
  dietary?: string;
  note?: string;
}

interface PartyTask {
  id: string;
  title: string;
  status: "done" | "in-progress" | "todo" | "blocked";
  dueIn: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

interface VenueOption {
  name: string;
  type: string;
  capacity: number;
  cost: string;
  pros: string[];
  cons: string[];
  selected: boolean;
}

const PARTY_INFO = {
  title: "Sasha's 30th Birthday",
  date: "Saturday, April 5th",
  time: "7:00 PM — late",
  theme: "A Night in Havana — tropical cocktails, warm lighting, live music",
  budget: "$2,500",
  budgetSpent: "$1,840",
  imagePrompt:
    "A beautifully decorated rooftop terrace at golden hour, " +
    "string lights, tropical plants, cocktail bar, warm Havana vibes",
};

const GUESTS: Guest[] = [
  { name: "Alex & Jordan", rsvp: "confirmed", dietary: "Vegetarian (Jordan)" },
  { name: "Maya", rsvp: "confirmed", note: "Bringing her guitar" },
  { name: "Tomas", rsvp: "confirmed", dietary: "Gluten-free" },
  { name: "Priya & Dev", rsvp: "confirmed" },
  { name: "Lena", rsvp: "pending", note: "Waiting on flight confirmation" },
  { name: "Chris", rsvp: "pending" },
  { name: "Nadia", rsvp: "confirmed", dietary: "Vegan" },
  { name: "Sam", rsvp: "declined", note: "Out of town — sending a gift" },
  { name: "Felix & Rosa", rsvp: "confirmed", note: "Can help with setup" },
  { name: "Ines", rsvp: "pending", note: "Checking work schedule" },
  { name: "Kai", rsvp: "confirmed" },
  { name: "Amara", rsvp: "confirmed", dietary: "Nut allergy" },
];

const TASKS: PartyTask[] = [
  {
    id: "venue",
    title: "Confirm venue",
    status: "done",
    dueIn: "Completed",
    detail: "Rooftop at The Lantern — deposit paid, 7 PM access.",
    priority: "high",
  },
  {
    id: "catering",
    title: "Finalize catering",
    status: "in-progress",
    dueIn: "5 days",
    detail:
      "Cuban-inspired tapas menu from Alma Kitchen. " +
      "Need final headcount for portions. Dietary accommodations requested.",
    priority: "high",
  },
  {
    id: "drinks",
    title: "Cocktail menu",
    status: "done",
    dueIn: "Completed",
    detail:
      "3 signature cocktails: Havana Sunset (rum), Mojito Clásico, " +
      "Tropical Spritz (non-alcoholic option). Spirits ordered.",
    priority: "medium",
  },
  {
    id: "music",
    title: "Book DJ / live music",
    status: "in-progress",
    dueIn: "3 days",
    detail:
      'Waiting on confirmation from DJ Luna. Backup: curated playlist + ' +
      "Maya's live guitar set for the first hour.",
    priority: "high",
  },
  {
    id: "decorations",
    title: "Decorations & florals",
    status: "todo",
    dueIn: "7 days",
    detail:
      "Tropical florals, string lights, lanterns. " +
      "Felix and Rosa volunteered to help with setup morning-of.",
    priority: "medium",
  },
  {
    id: "cake",
    title: "Order cake",
    status: "done",
    dueIn: "Completed",
    detail:
      'Three-tier guava and passionfruit cake from Dulce Vida. ' +
      "Pickup Saturday 4 PM.",
    priority: "medium",
  },
  {
    id: "invites",
    title: "Send final reminders",
    status: "todo",
    dueIn: "5 days",
    detail:
      "3 guests still pending RSVP. Send a personal follow-up. " +
      "Include parking and dress code info.",
    priority: "medium",
  },
  {
    id: "photo",
    title: "Photo corner setup",
    status: "todo",
    dueIn: "8 days",
    detail:
      "Polaroid camera + props. Backdrop with tropical leaves and " +
      "string lights. Guestbook station beside it.",
    priority: "low",
  },
  {
    id: "playlist",
    title: "Backup playlist",
    status: "in-progress",
    dueIn: "7 days",
    detail:
      "Latin jazz, bossa nova, modern Cuban. 4-hour set. " +
      "Sasha requested no reggaeton before 10 PM.",
    priority: "low",
  },
  {
    id: "transport",
    title: "Guest transport",
    status: "blocked",
    dueIn: "8 days",
    detail:
      "Waiting on final guest count to decide if shuttle is needed. " +
      "Venue has limited street parking.",
    priority: "medium",
  },
];

const VENUES: VenueOption[] = [
  {
    name: "The Lantern Rooftop",
    type: "Rooftop terrace",
    capacity: 40,
    cost: "$800",
    pros: ["City views", "Built-in bar", "String lights included"],
    cons: ["Weather-dependent", "Noise curfew at midnight"],
    selected: true,
  },
  {
    name: "Casa Verde Garden",
    type: "Private courtyard",
    capacity: 30,
    cost: "$600",
    pros: ["Intimate", "Covered area", "BYOB allowed"],
    cons: ["Smaller capacity", "No built-in sound system"],
    selected: false,
  },
  {
    name: "Sasha's apartment",
    type: "Home party",
    capacity: 20,
    cost: "$0",
    pros: ["Free", "Personal", "No time restrictions"],
    cons: ["Too small for full guest list", "Cleanup on hosts"],
    selected: false,
  },
];

const PARTY = { info: PARTY_INFO, guests: GUESTS, tasks: TASKS, venues: VENUES };

function formatPartyForPrompt(): string {
  const lines = ["## Party Details\n"];

  lines.push(`### ${PARTY_INFO.title}`);
  lines.push(`- **Date**: ${PARTY_INFO.date}`);
  lines.push(`- **Time**: ${PARTY_INFO.time}`);
  lines.push(`- **Theme**: ${PARTY_INFO.theme}`);
  lines.push(`- **Budget**: ${PARTY_INFO.budget} (spent: ${PARTY_INFO.budgetSpent})`);
  lines.push(
    `- **Hero image**: Use \`imageUrl("${PARTY_INFO.imagePrompt}")\` for the party header`
  );
  lines.push("");

  // Guest list
  const confirmed = GUESTS.filter((g) => g.rsvp === "confirmed");
  const pending = GUESTS.filter((g) => g.rsvp === "pending");
  const declined = GUESTS.filter((g) => g.rsvp === "declined");

  lines.push(`### Guest List (${GUESTS.length} invited)\n`);
  lines.push(
    `**${confirmed.length} confirmed** · ${pending.length} pending · ${declined.length} declined\n`
  );

  for (const g of GUESTS) {
    let entry = `- **${g.name}** — ${g.rsvp}`;
    if (g.dietary) entry += ` · 🍽 ${g.dietary}`;
    if (g.note) entry += ` · _${g.note}_`;
    lines.push(entry);
  }
  lines.push("");

  // Tasks
  const done = TASKS.filter((t) => t.status === "done").length;
  const inProgress = TASKS.filter((t) => t.status === "in-progress").length;
  const todo = TASKS.filter((t) => t.status === "todo").length;
  const blocked = TASKS.filter((t) => t.status === "blocked").length;

  lines.push(
    `### Tasks (${TASKS.length} total: ${done} done, ${inProgress} in progress, ${todo} to do, ${blocked} blocked)\n`
  );

  for (const t of TASKS) {
    const icon =
      t.status === "done"
        ? "✅"
        : t.status === "in-progress"
          ? "🔄"
          : t.status === "blocked"
            ? "🚫"
            : "📋";
    lines.push(`#### ${icon} ${t.title}`);
    lines.push(`- **Status**: ${t.status} · **Priority**: ${t.priority}`);
    if (t.status !== "done") lines.push(`- **Due in**: ${t.dueIn}`);
    lines.push(`- ${t.detail}`);
    lines.push("");
  }

  // Venue
  lines.push("### Venue Options\n");
  for (const v of VENUES) {
    const marker = v.selected ? "✅ SELECTED" : "";
    lines.push(`#### ${v.name} ${marker}`);
    lines.push(`- **Type**: ${v.type} · **Capacity**: ${v.capacity} · **Cost**: ${v.cost}`);
    lines.push(`- **Pros**: ${v.pros.join(", ")}`);
    lines.push(`- **Cons**: ${v.cons.join(", ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Faux playbook data for the Editorial View spike.
 *
 * 20 playbooks across 5 categories, representing a generic personal
 * productivity dashboard. Each has a status and a vivid image prompt
 * for the Gemini image generation endpoint.
 */

export { PLAYBOOKS, formatPlaybooksForPrompt };
export type { Playbook, PlaybookStatus, PlaybookPriority, PlaybookCategory };

type PlaybookCategory =
  | "Calendar & Planning"
  | "Communication"
  | "Weather & Travel"
  | "News & Reading"
  | "Tasks & Errands";

type PlaybookStatus =
  | "needs-response"
  | "running"
  | "completed"
  | "idle"
  | "scheduled";

type PlaybookPriority = "urgent" | "high" | "medium" | "low";

interface Playbook {
  id: string;
  title: string;
  emoji: string;
  category: PlaybookCategory;
  description: string;
  status: PlaybookStatus;
  statusDetail: string;
  priority: PlaybookPriority;
  lastActivity: string;
  imagePrompt: string;
}

const PLAYBOOKS: Playbook[] = [
  // ─── 📅 Calendar & Planning ─────────────────────────────────────────────────
  {
    id: "daily-agenda",
    title: "Daily Agenda",
    emoji: "📅",
    category: "Calendar & Planning",
    description:
      "Shows today's meetings, deadlines, and free time blocks " +
      "in a clean timeline view.",
    status: "completed",
    statusDetail:
      "Today: 3 meetings, a 90-minute focus block at 2 PM, " +
      "and the evening is clear after 6.",
    priority: "high",
    lastActivity: "Just now",
    imagePrompt:
      "A clean desk with a paper day planner open to today's date, " +
      "a pen resting on it, morning coffee beside it, warm light",
  },
  {
    id: "week-ahead",
    title: "Week Ahead",
    emoji: "📅",
    category: "Calendar & Planning",
    description:
      "A weekly overview showing upcoming events, " +
      "deadlines, and scheduling conflicts.",
    status: "completed",
    statusDetail:
      "Next week looks busy: 2 overlapping meetings on Wednesday. " +
      "Friday afternoon is wide open for deep work.",
    priority: "medium",
    lastActivity: "1 hour ago",
    imagePrompt:
      "A wall calendar with colorful sticky notes marking the week ahead, " +
      "a tidy home office in the background, natural light",
  },
  {
    id: "reminder-hub",
    title: "Reminders",
    emoji: "📅",
    category: "Calendar & Planning",
    description:
      "Collects all reminders from various sources into " +
      "one prioritized list.",
    status: "needs-response",
    statusDetail:
      "2 reminders due today: renew library books and " +
      "confirm dinner reservation for Saturday.",
    priority: "high",
    lastActivity: "30 minutes ago",
    imagePrompt:
      "A phone on a kitchen counter showing a notification, " +
      "a small stack of library books nearby, bright kitchen light",
  },
  {
    id: "birthdays",
    title: "Birthdays & Events",
    emoji: "📅",
    category: "Calendar & Planning",
    description:
      "Tracks upcoming birthdays and personal events " +
      "with gift suggestions and reminders.",
    status: "scheduled",
    statusDetail:
      "A friend's birthday is in 4 days. Last year you sent " +
      "a book — want to browse ideas?",
    priority: "medium",
    lastActivity: "2 days ago",
    imagePrompt:
      "A beautifully wrapped gift on a table with a handwritten card, " +
      "confetti scattered around, warm festive lighting",
  },

  // ─── 💬 Communication ──────────────────────────────────────────────────────
  {
    id: "email-digest",
    title: "Email Digest",
    emoji: "💬",
    category: "Communication",
    description:
      "Surfaces important emails and drafts quick summaries " +
      "so you don't have to read everything.",
    status: "completed",
    statusDetail:
      "12 new emails overnight. 2 need replies: a meeting reschedule " +
      "and a question from a colleague.",
    priority: "high",
    lastActivity: "15 minutes ago",
    imagePrompt:
      "A laptop on a wooden desk showing an inbox, " +
      "a cup of tea steaming beside it, early morning quiet",
  },
  {
    id: "message-catch-up",
    title: "Message Catch-Up",
    emoji: "💬",
    category: "Communication",
    description:
      "Summarizes unread messages across chat apps " +
      "and highlights anything time-sensitive.",
    status: "needs-response",
    statusDetail:
      "3 unread group chats — one is planning this weekend's " +
      "meetup and needs your RSVP by tonight.",
    priority: "urgent",
    lastActivity: "45 minutes ago",
    imagePrompt:
      "A phone face-down on a cafe table, a latte with beautiful " +
      "art beside it, warm afternoon light through a window",
  },
  {
    id: "contact-notes",
    title: "Contact Notes",
    emoji: "💬",
    category: "Communication",
    description:
      "Keeps notes about the people you interact with — " +
      "preferences, recent conversations, follow-ups.",
    status: "idle",
    statusDetail:
      "Last updated when you met with your accountant. " +
      "Next tax review is in 3 months.",
    priority: "low",
    lastActivity: "2 weeks ago",
    imagePrompt:
      "An open address book with handwritten notes, " +
      "a fountain pen, warm desk light, organized and personal",
  },
  {
    id: "voicemail-summary",
    title: "Voicemail Summary",
    emoji: "💬",
    category: "Communication",
    description:
      "Transcribes and summarizes voicemails so you can " +
      "scan them quickly without listening.",
    status: "completed",
    statusDetail:
      "1 new voicemail: the dentist confirming your appointment " +
      "for next Thursday at 10 AM.",
    priority: "low",
    lastActivity: "3 hours ago",
    imagePrompt:
      "An old-style telephone on a side table beside a notepad, " +
      "a sunny hallway in the background, nostalgic and warm",
  },

  // ─── ☁️ Weather & Travel ───────────────────────────────────────────────────
  {
    id: "weather-today",
    title: "Weather Today",
    emoji: "☁️",
    category: "Weather & Travel",
    description:
      "Current conditions and hourly forecast " +
      "with outfit and umbrella suggestions.",
    status: "completed",
    statusDetail:
      "Clear skies this morning, cloud cover building by 3 PM. " +
      "High of 72°F. No umbrella needed.",
    priority: "medium",
    lastActivity: "Just now",
    imagePrompt:
      "A bright blue sky over city rooftops with scattered clouds, " +
      "morning light catching the buildings, optimistic and fresh",
  },
  {
    id: "commute-check",
    title: "Commute Check",
    emoji: "☁️",
    category: "Weather & Travel",
    description:
      "Checks traffic and transit conditions for your " +
      "usual routes and suggests the best option.",
    status: "completed",
    statusDetail:
      "Normal commute today — 25 minutes by transit. " +
      "No delays or disruptions reported.",
    priority: "medium",
    lastActivity: "20 minutes ago",
    imagePrompt:
      "A train platform in morning light, a few commuters waiting, " +
      "an arrival board showing the next train, calm urban scene",
  },
  {
    id: "trip-planner",
    title: "Trip Planner",
    emoji: "☁️",
    category: "Weather & Travel",
    description:
      "Organizes upcoming trips with packing lists, " +
      "reservations, and day-by-day itineraries.",
    status: "running",
    statusDetail:
      "Weekend trip in 9 days. Hotel is booked, still need " +
      "to confirm the restaurant reservation for Saturday.",
    priority: "high",
    lastActivity: "1 day ago",
    imagePrompt:
      "An open suitcase on a bed with neatly folded clothes, " +
      "a passport and boarding pass tucked in the side pocket, " +
      "afternoon light through a bedroom window",
  },
  {
    id: "air-quality",
    title: "Air Quality",
    emoji: "☁️",
    category: "Weather & Travel",
    description:
      "Monitors local air quality index and pollen count " +
      "with alerts for sensitive days.",
    status: "idle",
    statusDetail:
      "AQI is 42 (Good). Pollen count low. " +
      "No alerts — enjoy the outdoors.",
    priority: "low",
    lastActivity: "1 hour ago",
    imagePrompt:
      "A park bench under a tree with dappled sunlight, " +
      "a clear sky visible through the canopy, serene and green",
  },

  // ─── 📰 News & Reading ────────────────────────────────────────────────────
  {
    id: "morning-news",
    title: "Morning News Brief",
    emoji: "📰",
    category: "News & Reading",
    description:
      "A curated selection of today's top stories from " +
      "your preferred topics and sources.",
    status: "completed",
    statusDetail:
      "5 stories ready: 2 on technology, 1 on local transit changes, " +
      "1 science feature, and 1 opinion piece you might enjoy.",
    priority: "medium",
    lastActivity: "10 minutes ago",
    imagePrompt:
      "A newspaper spread on a breakfast table with a coffee cup, " +
      "morning light, a croissant on a small plate, leisurely",
  },
  {
    id: "reading-list",
    title: "Reading List",
    emoji: "📰",
    category: "News & Reading",
    description:
      "Articles and links you've saved for later, " +
      "organized by topic with estimated read times.",
    status: "needs-response",
    statusDetail:
      "14 saved articles, 3 added this week. Oldest is from " +
      "12 days ago — worth a quick cull?",
    priority: "low",
    lastActivity: "6 hours ago",
    imagePrompt:
      "A cozy reading nook with a blanket, an e-reader on the armrest, " +
      "a warm desk lamp, evening light through curtains",
  },
  {
    id: "podcast-queue",
    title: "Podcast Queue",
    emoji: "📰",
    category: "News & Reading",
    description:
      "New episodes from your subscriptions, " +
      "sorted by your listening patterns.",
    status: "completed",
    statusDetail:
      "3 new episodes dropped: a tech interview (42 min), " +
      "a history deep-dive (28 min), and a comedy roundtable (55 min).",
    priority: "low",
    lastActivity: "4 hours ago",
    imagePrompt:
      "Over-ear headphones resting on a wooden desk beside a phone, " +
      "a podcast app visible on screen, soft afternoon light",
  },
  {
    id: "book-tracker",
    title: "Book Tracker",
    emoji: "📰",
    category: "News & Reading",
    description:
      "Tracks what you're reading, your progress, " +
      "and a wish list of what's next.",
    status: "running",
    statusDetail:
      "Currently reading: 62% through a novel. " +
      "2 books in the wish list from recent recommendations.",
    priority: "low",
    lastActivity: "Last night",
    imagePrompt:
      "An open paperback face-down on a nightstand, " +
      "a reading lamp casting a warm glow, a bookmark peeking out",
  },

  // ─── ✅ Tasks & Errands ───────────────────────────────────────────────────
  {
    id: "grocery-list",
    title: "Grocery List",
    emoji: "✅",
    category: "Tasks & Errands",
    description:
      "Running grocery list organized by store aisle " +
      "with recipe-based suggestions.",
    status: "needs-response",
    statusDetail:
      "7 items on the list. Milk and eggs are from Tuesday — " +
      "still need them? Avocados were on sale last week.",
    priority: "medium",
    lastActivity: "2 hours ago",
    imagePrompt:
      "A handwritten grocery list on a small notepad held by a magnet " +
      "on a fridge door, colorful magnets around it, kitchen warmth",
  },
  {
    id: "household-tasks",
    title: "Household Tasks",
    emoji: "✅",
    category: "Tasks & Errands",
    description:
      "Rotating chores and home maintenance reminders " +
      "with suggested schedules.",
    status: "running",
    statusDetail:
      "Laundry is overdue. The air filter was last changed " +
      "68 days ago — recommended every 90.",
    priority: "medium",
    lastActivity: "1 day ago",
    imagePrompt:
      "A tidy laundry room with folded towels in a basket, " +
      "a washing machine mid-cycle, afternoon light, domestic calm",
  },
  {
    id: "package-tracker",
    title: "Package Tracker",
    emoji: "✅",
    category: "Tasks & Errands",
    description:
      "Monitors incoming deliveries and provides " +
      "estimated arrival windows.",
    status: "running",
    statusDetail:
      "2 packages in transit: a book arriving today and " +
      "headphones arriving Thursday.",
    priority: "medium",
    lastActivity: "3 hours ago",
    imagePrompt:
      "A front porch with a delivery box, a welcome mat, " +
      "potted plants on either side, bright midday light",
  },
  {
    id: "quick-notes",
    title: "Quick Notes",
    emoji: "✅",
    category: "Tasks & Errands",
    description:
      "Scratchpad for fleeting thoughts, ideas, and " +
      "things to remember.",
    status: "idle",
    statusDetail:
      "Last note: 'Ask about the parking permit renewal.' " +
      "3 notes this week, 1 archived.",
    priority: "low",
    lastActivity: "Yesterday",
    imagePrompt:
      "A small moleskin notebook open on a park bench, " +
      "a pen clipped to the page, trees in soft focus behind",
  },
];


/**
 * Format all playbooks into a prompt-ready string.
 */
function formatPlaybooksForPrompt(): string {
  const lines = ["## Active Playbooks\n"];
  lines.push(
    "The following 20 playbooks are the user's active life dashboard. " +
      "Use ALL of them — do not invent additional playbooks.\n"
  );

  const byCategory = new Map<PlaybookCategory, Playbook[]>();
  for (const p of PLAYBOOKS) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }

  for (const [category, playbooks] of byCategory) {
    lines.push(`### ${playbooks[0].emoji} ${category}\n`);

    for (const p of playbooks) {
      lines.push(`#### ${p.title}`);
      lines.push(`- **ID**: \`${p.id}\``);
      lines.push(`- **Description**: ${p.description}`);
      lines.push(`- **Status**: ${p.status}`);
      lines.push(`- **Status detail**: ${p.statusDetail}`);
      lines.push(`- **Priority**: ${p.priority}`);
      lines.push(`- **Last activity**: ${p.lastActivity}`);
      lines.push(
        `- **Image**: Use \`imageUrl("${p.imagePrompt}")\` to generate a hero image`
      );
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Agent } from "../../../types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * The Agent Controller for Folio.
 */
export class AgentController extends RootController {
  @field({ deep: true })
  accessor agents: Agent[] = [
    {
      id: "finance-agent",
      name: "Finance Agent",
      bgColor: "var(--opal-color-pastel-1)",
      fgColor: "var(--opal-color-agent-foreground)",
      count: 2,
      cards: [
        {
          id: "super-tool-pause",
          header: "You haven't opened Super Tool in 45 days",
          content:
            "That's a long time for a paid tool. I'd recommend pausing this subscription until you need it again — you can always reactivate it later without losing your data.",
          cta: {
            title: "Super Tool",
            price: "$54.99 / month",
            logo: "/images/icon.png",
            primary: "Pause subscription",
            secondary: "Keep it",
          },
        },
        {
          id: "design-pro-check",
          header: "DesignPro subscription renewal coming up",
          content:
            "Your annual subscription for DesignPro renews in 3 days. You used it 12 times this month, creating 15 presentations and 30 social media assets, so it seems like a keeper.",
          cta: {
            title: "DesignPro",
            price: "$119.99 / year",
            primary: "Approve renewal",
            secondary: "Cancel",
          },
        },
      ],
    },
    {
      id: "operations-agent",
      name: "Operations Agent",
      bgColor: "var(--opal-color-pastel-2)",
      fgColor: "var(--opal-color-agent-foreground)",
      count: 4,
      cards: [
        {
          id: "lena-park-briefing",
          header: "Briefing for Lena Park meeting",
          content:
            "I created a briefing for your conversation with Lena Park, Landscape’s Head of Marketing. Let me know if you have any questions.",
          cta: {
            title: "Client Briefing: Landscape",
            icon: "description",
            primary: "View briefing",
            secondary: "Send pre-meeting notes",
          },
        },
        {
          id: "weekly-digest",
          header: "Weekly operations digest ready",
          content:
            "I've compiled the weekly stats for the team. Efficiency is up 14% across the board, and the engineering team closed a record number of tickets.",
          cta: {
            title: "Weekly Report",
            icon: "assessment",
            primary: "View report",
            secondary: "Share",
          },
        },
        {
          id: "flight-delay",
          header: "Your flight to NYC is delayed",
          content:
            "Flight AA123 is delayed by 45 minutes. I've updated your calendar and notified the hotel. Your ground transportation has also been rescheduled.",
          cta: {
            title: "Flight AA123 Status",
            icon: "flight",
            primary: "View itinerary",
          },
        },
        {
          id: "system-maintenance",
          header: "Scheduled system maintenance",
          content:
            "Folio will be undergoing scheduled maintenance tonight at 2 AM. Expect brief interruptions to the sync service.",
        },
      ],
    },
    {
      id: "agent-3",
      name: "Support Agent",
      bgColor: "var(--opal-color-pastel-3)",
      fgColor: "var(--opal-color-agent-foreground)",
      count: 1,
      cards: [
        {
          id: "customer-issue",
          header: "High priority ticket assigned",
          content:
            "A new high-priority ticket was assigned to you regarding API access issues. The customer is unable to authenticate since the last deployment.",
          cta: {
            title: "Ticket #4521",
            icon: "bug_report",
            primary: "View ticket",
            secondary: "Delegate",
          },
        },
      ],
    },
    {
      id: "creative-agent",
      name: "Creative Agent",
      bgColor: "var(--opal-color-pastel-4)",
      fgColor: "var(--opal-color-agent-foreground)",
      count: 0,
      cards: [],
    },
  ];

  constructor() {
    super("Agent", "AgentController");
  }
}

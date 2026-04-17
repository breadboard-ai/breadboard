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
      fgColor: "var(--opal-color-on-pastel-1)",

      tasks: [
        {
          id: "super-tool-pause",
          type: "subscription-management",
          status: "active",
          digest: {
            title: "You haven't opened Super Tool in 45 days",
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
          block: {
            id: "super-tool-pause-tool",
            type: "subscription-management",
            status: "active",
            title: "Super Tool Subscription",
            subtitle: "You haven't used this in 45 days.",
            content: "/mini-apps/subscription-manager.html",
            actions: [
              { name: "pause", title: "Pause Subscription", icon: "pause" },
              { name: "keep", title: "Keep Active", icon: "check" },
            ],
          },
        },
        {
          id: "send-reminder-task",
          type: "invoice-reminder",
          status: "active",
          block: {
            id: "send-reminder-tool",
            type: "invoice-reminder",
            status: "active",
            title: "Send Invoice Reminder",
            subtitle:
              "Review and send drafted follow-ups for overdue invoices.",
            content: "/mini-apps/invoice-reminder.html",
            borderless: true,
          },
        },
        {
          id: "design-pro-check",
          type: "subscription-management",
          status: "active",
          digest: {
            title: "DesignPro subscription renewal coming up",
            content:
              "Your annual subscription for DesignPro renews in 3 days. You used it 12 times this month, creating 15 presentations and 30 social media assets, so it seems like a keeper.",
            cta: {
              title: "DesignPro",
              price: "$119.99 / year",
              primary: "Approve renewal",
              secondary: "Cancel",
            },
          },
          block: {
            id: "design-pro-check-tool",
            type: "subscription-management",
            status: "active",
            title: "DesignPro Renewal",
            subtitle: "Annual subscription renewing in 3 days.",
            content: "/mini-apps/design-pro-renewal.html",
            actions: [
              { name: "approve", title: "Approve Renewal", icon: "check" },
              { name: "cancel", title: "Cancel Subscription", icon: "close" },
            ],
          },
        },
        {
          id: "generate-invoice-task",
          type: "invoice-generator",
          status: "active",
          block: {
            id: "generate-invoice-tool",
            type: "invoice-generator",
            status: "active",
            title: "Generate Invoice",
            subtitle:
              "Review and send prepared invoices, or create a new one from scratch.",
            content: "/mini-apps/invoice-generator.html",
          },
        },
        {
          id: "log-expense-task",
          type: "expense-logger",
          status: "active",
          block: {
            id: "log-expense-tool",
            type: "expense-logger",
            status: "active",
            displayHint: "high",
            title: "Log Expense",
            subtitle: "Record a business expense or receipt.",
            content: "/mini-apps/expense-logger.html",
          },
        },
        {
          id: "agent-insights-task",
          type: "insights-grid",
          status: "active",
          block: {
            id: "agent-insights",
            type: "insights-grid",
            status: "active",
            title: "Financial Insights",
            subtitle: "Overview of your cash flow and margins.",
            content: "/mini-apps/financial-insights.html",
          },
        },
      ],
    },
    {
      id: "operations-agent",
      name: "Operations Agent",
      bgColor: "var(--opal-color-pastel-2)",
      fgColor: "var(--opal-color-on-pastel-2)",

      tasks: [
        {
          id: "lena-park-briefing",
          type: "meeting-briefing",
          status: "active",
          digest: {
            title: "Briefing for Lena Park meeting",
            content:
              "I created a briefing for your conversation with Lena Park, Landscape’s Head of Marketing. Let me know if you have any questions.",
            cta: {
              title: "Client Briefing: Landscape",
              icon: "description",
              primary: "View briefing",
              secondary: "Send pre-meeting notes",
            },
          },
          block: {
            id: "lena-park-briefing-tool",
            type: "meeting-briefing",
            status: "active",
            title: "Lena Park Briefing",
            subtitle: "Head of Marketing at Landscape.",
            content: "/mini-apps/meeting-briefing.html",
          },
        },
        {
          id: "weekly-digest",
          type: "report-generation",
          status: "active",
          digest: {
            title: "Weekly operations digest ready",
            content:
              "I've compiled the weekly stats for the team. Efficiency is up 14% across the board, and the engineering team closed a record number of tickets.",
            cta: {
              title: "Weekly Report",
              icon: "assessment",
              primary: "View report",
              secondary: "Share",
            },
          },
          block: {
            id: "weekly-digest-tool",
            type: "report-generation",
            status: "active",
            title: "Weekly Operations Digest",
            subtitle: "Efficiency is up 14% across the board.",
            content: "/mini-apps/weekly-digest.html",
          },
        },
        {
          id: "flight-delay",
          type: "travel-update",
          status: "active",
          digest: {
            title: "Your flight to NYC is delayed",
            content:
              "Flight AA123 is delayed by 45 minutes. I've updated your calendar and notified the hotel. Your ground transportation has also been rescheduled.",
            cta: {
              title: "Flight AA123 Status",
              icon: "flight",
              primary: "View itinerary",
            },
          },
          block: {
            id: "flight-delay-tool",
            type: "travel-update",
            status: "active",
            title: "Flight AA123 Delayed",
            subtitle: "Your flight to NYC is delayed by 45 minutes.",
            content: "/mini-apps/flight-status.html",
          },
        },
        {
          id: "system-maintenance",
          type: "system-update",
          status: "active",
          digest: {
            title: "Scheduled system maintenance",
            content:
              "Folio will be undergoing scheduled maintenance tonight at 2 AM. Expect brief interruptions to the sync service.",
          },
          block: {
            id: "system-maintenance-tool",
            type: "system-update",
            status: "active",
            title: "System Maintenance",
            subtitle: "Folio will be undergoing scheduled maintenance.",
            content: "/mini-apps/system-maintenance.html",
          },
        },
      ],
    },
    {
      id: "agent-3",
      name: "Support Agent",
      bgColor: "var(--opal-color-pastel-3)",
      fgColor: "var(--opal-color-on-pastel-3)",

      tasks: [
        {
          id: "customer-issue",
          type: "ticket-management",
          status: "active",
          digest: {
            title: "High priority ticket assigned",
            content:
              "A new high-priority ticket was assigned to you regarding API access issues. The customer is unable to authenticate since the last deployment.",
            cta: {
              title: "Ticket #4521",
              icon: "bug_report",
              primary: "View ticket",
              secondary: "Delegate",
            },
          },
          block: {
            id: "customer-issue-tool",
            type: "ticket-management",
            status: "active",
            title: "Ticket #4521",
            subtitle: "API access issues since last deployment.",
            content: "/mini-apps/ticket-manager.html",
          },
        },
      ],
    },
    {
      id: "creative-agent",
      name: "Creative Agent",
      bgColor: "var(--opal-color-pastel-4)",
      fgColor: "var(--opal-color-on-pastel-4)",

      tasks: [],
    },
  ];

  /**
   * Whether the current agent page's cards are ready to be revealed.
   * The agent page reads this to trigger the staggered fade-in.
   */
  @field()
  accessor revealReady = false;

  #expectedCount = 0;
  #readyCount = 0;
  #revealTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Start the reveal race for a new agent page. Cards stay invisible
   * until either all mini-apps report ready or the timeout elapses.
   */
  prepareReveal(agentId: string | undefined) {
    this.revealReady = false;
    this.#readyCount = 0;

    if (this.#revealTimeout) {
      clearTimeout(this.#revealTimeout);
    }

    const agent = this.agents.find((a) => a.id === agentId);
    this.#expectedCount =
      agent?.tasks.filter((t) => t.block && typeof t.block.content === "string")
        .length ?? 0;

    if (this.#expectedCount === 0) {
      this.revealReady = true;
      return;
    }

    this.#revealTimeout = setTimeout(() => {
      this.#reveal();
    }, 500);
  }

  /**
   * Called when a mini-app has measured its content and is ready.
   */
  markMiniAppReady() {
    this.#readyCount++;
    if (this.#readyCount >= this.#expectedCount) {
      this.#reveal();
    }
  }

  #reveal() {
    if (this.revealReady) return;

    if (this.#revealTimeout) {
      clearTimeout(this.#revealTimeout);
      this.#revealTimeout = null;
    }

    this.revealReady = true;
  }

  constructor() {
    super("Agent", "AgentController");
  }
}

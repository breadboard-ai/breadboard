/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";

const parts: DataPart[] = [
  {
    text: `# The setup
You are creating a "Comparison Table" (Pricing Page).

It contains:
  - A level 1 Heading ("Choose your plan").
  - A Row containing 3 distinct Card components (Basic, Pro, Enterprise):
    - Each Card should have a weight of 1.
    - Inside each Card:
      - Heading level 2 (Plan Name).
      - Heading level 3 (Price).
      - Divider (Horizontal).
      - A Text (Included Components) for the Plan as a markdown list. Heading (level 4) at the top of the list.
      - A Text (Data & Integrations) for the Plan as a markdown list. Heading (level 4) at the top of the list.
      - A Text (Security & Control) for the Plan as a markdown list. Heading (level 4) at the top of the list.
      - A Text (Customization) for the Plan as a markdown list. Heading (level 4) at the top of the list.
      - Divider (Horizontal).
      - Button (Subscribe).

# Plan info
Use this plan info to populate the Cards.

## Basic ($5 per month)
### Included Components
  * Up to 5 users
  * Standard Project Boards
  * Email Support
  * 5 GB Storage Limit
## Data & Integrations
  * Basic Reporting
  * 2 Standard Integrations
## Security & Control
  * SSL Security
  * Basic Password Protection
## Customization
  * Standard Templates Only

## Pro ($25 per month)
### Included Components
  * Unlimited Users
  * Advanced Project Boards
  * Priority Chat Support
  * 100 GB Storage Limit
## Data & Integrations
  * Advanced Reporting & Dashboards
  * Unlimited Standard Integrations
  * Export to CSV/PDF
## Security & Control
  * Two-Factor Authentication (2FA)
  * Custom User Roles & Permissions
  * Data Backup Retention (30 Days)
## Customization
  * Custom Templates
  * Team Branding Options

## Enterprise ($150 per month)
### Included Components
  * Unlimited Users & Teams
  * Custom Project Workspaces
  * Dedicated Account Manager
  * Unlimited Storage
## Data & Integrations
  * Custom Analytics API Access
  * Custom Integrations & Webhooks
  * Real-Time Data Auditing
## Security & Control
  * Single Sign-On (SSO)
  * Audit Logs & Compliance Reports
  * Data Backup Retention (Unlimited)
## Customization
  * Custom API Access
  * Dedicated Training Portal`,
  },
];

export const content: LLMContent = { role: "user", parts };

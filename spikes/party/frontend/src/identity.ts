// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Identity management — who is this user?
 *
 * On first visit, shows an overlay asking for a name. Stores the identity
 * in localStorage and publishes it to Yjs awareness.
 */

import { awareness } from "./sync.js";

export { getIdentity, setIdentity, onIdentityChange, type Identity };

interface Identity {
  name: string;
  color: string;
}

const STORAGE_KEY = "party-identity";

/** A curated palette so users get distinct, attractive colors. */
const COLORS = [
  "#7c6cff", // purple
  "#ff6b9d", // pink
  "#34d399", // green
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#ef4444", // red
  "#06b6d4", // cyan
  "#a855f7", // violet
];

let currentIdentity: Identity | null = null;
const listeners: Array<(id: Identity) => void> = [];

function getIdentity(): Identity | null {
  if (currentIdentity) return currentIdentity;

  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      currentIdentity = JSON.parse(stored);
      publishToAwareness(currentIdentity!);
      return currentIdentity;
    } catch {
      // Corrupted storage, clear and re-prompt.
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }
  return null;
}

function setIdentity(name: string): Identity {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  currentIdentity = { name, color };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentIdentity));
  publishToAwareness(currentIdentity);
  for (const fn of listeners) fn(currentIdentity);
  return currentIdentity;
}

function onIdentityChange(fn: (id: Identity) => void) {
  listeners.push(fn);
}

function publishToAwareness(id: Identity) {
  awareness.setLocalStateField("user", {
    name: id.name,
    color: id.color,
  });
}

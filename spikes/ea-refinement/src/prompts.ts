/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Skill loaders.
 */

export {
  loadUiSkill,
  loadPropertySkill,
  loadPersona,
  loadRefinementSkill,
  loadChatSkill,
  loadEditorialSkill,
};

async function loadUiSkill(): Promise<string> {
  const res = await fetch("/skills/ui-skill.md");
  if (!res.ok) throw new Error(`Failed to load UI skill: ${res.status}`);
  return res.text();
}

async function loadPropertySkill(): Promise<string> {
  const res = await fetch("/skills/property-skill.md");
  if (!res.ok) {
    throw new Error(`Failed to load property skill: ${res.status}`);
  }
  return res.text();
}

async function loadPersona(): Promise<string> {
  const res = await fetch("/skills/persona.md");
  if (!res.ok) throw new Error(`Failed to load persona: ${res.status}`);
  return res.text();
}

async function loadRefinementSkill(): Promise<string> {
  const res = await fetch("/skills/refinement-skill.md");
  if (!res.ok) {
    throw new Error(`Failed to load refinement skill: ${res.status}`);
  }
  return res.text();
}

async function loadChatSkill(): Promise<string> {
  const res = await fetch("/skills/chat-skill.md");
  if (!res.ok) throw new Error(`Failed to load chat skill: ${res.status}`);
  return res.text();
}

async function loadEditorialSkill(): Promise<string> {
  const res = await fetch("/skills/editorial-skill.md");
  if (!res.ok) {
    throw new Error(`Failed to load editorial skill: ${res.status}`);
  }
  return res.text();
}

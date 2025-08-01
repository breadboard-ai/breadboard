/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalMap } from "signal-utils/map";
import {
  GroupParticle,
  Particle,
  ParticleIdentifier,
  ParticleOperation,
  ParticleTree,
  SerializedParticle,
} from "./types.js";
import { toParticle } from "./utils.js";

export { ParticleTreeImpl };

export type ParticleFactory = {
  create(particle: SerializedParticle): Particle;
};

class ParticleTreeImpl implements ParticleTree {
  public readonly root: GroupParticle;

  constructor() {
    this.root = toParticle({ group: [] }) as GroupParticle;
  }

  apply(op: ParticleOperation) {
    if (op.method === "suip/ops/upsert") {
      const { path, particle, id: newId, before } = op.params;
      if (!newId) {
        throw new Error(`Path is empty, unable to apply.`);
      }
      let destination: GroupParticle = this.root;
      // Navigate down the tree using path.
      while (path.length > 0) {
        const id = path.at(0)!;
        const next = destination.group.get(id);
        if (!next) {
          break;
        }
        if (!("group" in next)) {
          throw new Error(`Destination particle is not a group`);
        }
        destination = next;
        path.shift();
      }
      // Create missing parts of the path.
      while (path.length > 0) {
        const id = path.at(0)!;
        const next = toParticle({ group: [] }) as GroupParticle;
        destination.group.set(id, next);
        destination = next;
        path.shift();
      }
      if (!before) {
        // Append the particle
        destination.group.set(newId, toParticle(particle));
      } else {
        // Insert the particle. Need to rebuild the map to do this.
        const group = new SignalMap<ParticleIdentifier, Particle>();
        let inserted = false;
        for (const [oldId, oldParticle] of destination.group.entries()) {
          if (oldId === before) {
            group.set(newId, toParticle(particle));
            inserted = true;
          }
          if (inserted && oldId === newId) continue;
          group.set(oldId, oldParticle);
        }
        if (!inserted) {
          throw new Error(`Particle "${before}" does not exist.`);
        }
        destination.group = group;
      }
    } else {
      throw new Error(`Operation "${op.method}" is not supported`);
    }
  }
}

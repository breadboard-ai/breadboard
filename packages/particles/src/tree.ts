/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GroupParticle,
  Particle,
  ParticleOperation,
  SerializedParticle,
} from "./types.js";

export { ParticleTree };

export type ParticleFactory = {
  create(particle: SerializedParticle): Particle;
};

class ParticleTree {
  public readonly root: GroupParticle;

  constructor(private readonly factory: ParticleFactory) {
    this.root = factory.create({ group: [] }) as GroupParticle;
  }

  apply(op: ParticleOperation) {
    if (op.method === "suip/ops/upsert") {
      const { path, particle, id: newId } = op.params;
      if (!newId) {
        throw new Error(`Path is empty, unable to apply.`);
      }
      let destination: GroupParticle = this.root;
      // Navigate down the tree using path.
      while (path.length > 0) {
        const id = path.shift()!;
        const next = destination.group.get(id);
        if (!next) {
          break;
        }
        if (!("group" in next)) {
          throw new Error(`Destination particle is not a group`);
        }
        destination = next;
      }
      // Create missing parts of the path.
      while (path.length > 0) {
        const id = path.shift()!;
        const next = this.factory.create({ group: [] }) as GroupParticle;
        destination.group.set(id, next);
        destination = next;
      }
      // Append the particle
      destination.group.set(newId, this.factory.create(particle));
    } else {
      throw new Error(`Operation "${op.method}" is not supported`);
    }
  }
}

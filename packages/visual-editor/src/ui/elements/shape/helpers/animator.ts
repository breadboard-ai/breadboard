/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Ease } from "./ease.js";
import { clamp, runWhenIdle } from "./utils.js";
import * as flubber from "flubber";

/**
 * The base configuration for any animation.
 */
export interface AnimatorAnimationBase {
  /** Easing function to apply to the animation curve. */
  ease: Ease;
  /** Total duration of the animation in milliseconds. */
  duration: number;
  /** Optional delay in milliseconds before the animation starts. */
  delay?: number;
  /** Optional rotation animation properties (in degrees). */
  rotation?: { from: number; to: number };
  /** Optional scale animation properties. */
  scale?: { from: number; to: number };
  /** Optional CSS transform-origin property. */
  transformOrigin?: string;
}

/**
 * Defines an animation that targets a standard HTMLElement or SVGElement.
 */
type AnimatorElementAnimation = {
  type: "element";
  target: HTMLElement | SVGPathElement;
};

/**
 * Defines a specialized animation for morphing an SVGPathElement's `d`
 * attribute.
 */
type AnimatorSVGElementAnimation = {
  type: "svg";
  target: SVGPathElement;
  /** Path data for morphing, from one shape to another. */
  path: {
    from: [id: string, path: string];
    to: [id: string, path: string];
    /** Optional max segment length for interpolation. */
    maxSegments?: number;
  };
};

/** A unique identifier for an animation instance. */
export type AnimatorAnimationId = ReturnType<
  typeof globalThis.crypto.randomUUID
>;

/** A union type representing any possible animation configuration. */
export type AnimatorAnimation = AnimatorAnimationBase &
  (AnimatorElementAnimation | AnimatorSVGElementAnimation);

/**
 * An internal type that pairs an animation with its runtime state,
 * including its elapsed time and a pre-calculated interpolator for SVG
 * morphing.
 */
type TimedAnimatorAnimation = {
  /** The elapsed time of the animation, accounting for delays. */
  elapsedTime: number;
  /** The animation configuration object. */
  animation: AnimatorAnimation;
  /** The interpolator function for SVG path morphing, if applicable. */
  interpolator?: flubber.Interpolator;
};

/**
 * Manages and runs a queue of animations using `requestAnimationFrame`.
 * It supports standard CSS transforms (scale, rotate) and SVG path morphing.
 * The animator instance itself is "thenable," allowing us to `await` its
 * completion.
 */
export class Animator {
  /** A unique identifier for the animator instance. */
  readonly #id: string | null = null;
  /** A Promise that resolves when preloading tasks are complete. */
  #ready: Promise<void> = Promise.resolve();
  /** A Promise that resolves when the entire animation queue is empty. */
  #complete: Promise<void> | null = null;
  /** The resolver function for the `#complete` promise. */
  #resolver: (() => void) | null = null;
  /** A cache for pre-calculated SVG path interpolators. */
  #interpolators = new Map<string, flubber.Interpolator>();
  /** The active queue of animations being processed. */
  #animations = new Map<AnimatorAnimationId, TimedAnimatorAnimation>();
  /** The overall state of the animation */
  #state: "paused" | "running" = "running";

  // Animation loop state.
  #nextTick = -1;
  #lastTickTime: DOMHighResTimeStamp = 0;

  constructor(opts: { id: string }) {
    this.#id = opts.id;
  }

  /** The unique ID of the animator. */
  get id() {
    return this.#id;
  }

  /**
   * A promise that resolves when the animator is ready,
   * primarily after any `preload` operations have finished.
   */
  get ready() {
    return this.#ready;
  }

  /**
   * Schedules the next animation frame.
   * Ensures that only one frame is scheduled at a time.
   */
  #scheduleTick(): void {
    if (this.#nextTick !== -1 || this.#state === "paused") {
      return; // A tick is already scheduled.
    }

    this.#nextTick = window.requestAnimationFrame(() => {
      // On the first tick, initialize lastTickTime.
      const now = window.performance.now();
      if (this.#lastTickTime === 0) {
        this.#lastTickTime = now;
      }

      const tickDelta = now - this.#lastTickTime;
      this.#lastTickTime = now;
      this.#tick(tickDelta);
    });
  }

  /**
   * Cancels the currently scheduled animation frame.
   */
  #cancelTick(): void {
    if (this.#nextTick === -1) {
      return;
    }

    window.cancelAnimationFrame(this.#nextTick);
    this.#nextTick = -1;
  }

  /**
   * The main animation loop logic, executed on each animation frame.
   * @param tickDelta The time elapsed since the last frame in milliseconds.
   */
  #tick(tickDelta: number): void {
    this.#cancelTick();

    const expiredAnimationIds = new Set<AnimatorAnimationId>();
    for (const [id, timedAnimation] of this.#animations) {
      // Increment the elapsed time for the animation.
      timedAnimation.elapsedTime += tickDelta;

      // Skip updates if the animation's delay period is not yet over.
      if (timedAnimation.elapsedTime < 0) {
        continue;
      }

      // If the animation has completed its duration, mark it for removal.
      if (timedAnimation.elapsedTime >= timedAnimation.animation.duration) {
        expiredAnimationIds.add(id);
      }

      // Update the target element's properties for the current frame.
      this.#updateAnimationTarget(timedAnimation);
    }

    // Clean up completed animations from the queue.
    for (const expiredId of expiredAnimationIds) {
      this.#animations.delete(expiredId);
    }

    // If the queue is now empty, resolve the completion promise.
    this.#maybeNotifyAnimationFinished();

    // If there are still active animations, schedule the next tick.
    if (this.#animations.size > 0) {
      this.#scheduleTick();
    }
  }

  /**
   * Updates the visual properties of an animation's target element.
   * @param timedAnimation The animation and its current time state.
   */
  #updateAnimationTarget(timedAnimation: TimedAnimatorAnimation): void {
    const { animation, elapsedTime } = timedAnimation;
    const { target, duration, ease } = animation;

    // Calculate the progress of the animation, clamped between 0 and 1.
    const progress = clamp(elapsedTime / duration, 0, 1);
    const easedProgress = ease(progress);

    // Apply transform-origin once if specified.
    if (animation.transformOrigin) {
      target.style.transformOrigin = animation.transformOrigin;
    }

    // Apply SVG path morphing if an interpolator exists.
    if (timedAnimation.interpolator) {
      target.setAttribute("d", timedAnimation.interpolator(easedProgress));
    }

    // Rotation animation.
    if (animation.rotation) {
      const { from, to } = animation.rotation;
      const rotation = from + (to - from) * easedProgress;
      target.style.rotate = `${rotation}deg`;
    }

    // Scale animation.
    if (animation.scale) {
      const { from, to } = animation.scale;
      const scale = from + (to - from) * easedProgress;
      target.style.scale = `${scale} ${scale}`;
    }
  }

  /**
   * Checks if all animations are complete and resolves the `Complete` Promise
   * if so.
   */
  #maybeNotifyAnimationFinished(): void {
    if (this.#animations.size === 0 && this.#resolver) {
      // Since we're done we no longer want to know the tick time.
      this.#lastTickTime = 0;

      this.#resolver.call(null);
      this.#resolver = null; // Ensure it's only called once.
      this.#complete = null;
    }
  }

  /**
   * Pre-calculates and caches interpolators for a set of SVG path shapes.
   * This is an optimization to avoid doing this work when an animation starts.
   * It creates a circular set of interpolators (e.g., A->B, B->C, C->A) since
   * the primary use-case for this is animating between SVG shapes in the
   * thinking animation.
   *
   * @param shapesForInterpolation A map of shape IDs to their SVG path strings.
   * @param maxSegments The `maxSegmentLength` parameter for flubber.
   */
  preload(shapesForInterpolation: Map<string, string>, maxSegments = 5): void {
    this.#ready = new Promise((resolve) => {
      const shapes = [...shapesForInterpolation.entries()];
      if (shapes.length < 2) {
        resolve();
        return;
      }

      for (let i = 0; i < shapes.length; i++) {
        const [id1, shape1] = shapes[i];
        const [id2, shape2] = shapes[(i + 1) % shapes.length];
        const cacheKey = `${id1}_${id2}`;

        if (this.#interpolators.has(cacheKey)) {
          continue;
        }

        runWhenIdle(() => {
          const interpolator = flubber.interpolate(shape1, shape2, {
            maxSegmentLength: maxSegments,
          });

          // Store the interpolator and when all the interpolators have been
          // created resolve the ready Promise.
          this.#interpolators.set(cacheKey, interpolator);
          if (this.#interpolators.size !== shapes.length) {
            return;
          }

          resolve();
        });
      }
    });
  }

  /**
   * Adds a new animation to the queue.
   *
   * @param animation The animation configuration object.
   * @returns The Animator instance for chaining.
   */
  enqueue(animation: AnimatorAnimation): this {
    // If this is the first animation in an empty queue, create a new
    // completion promise.
    if (this.#animations.size === 0) {
      this.#complete = new Promise((resolve) => {
        this.#resolver = resolve;
      });
    }

    // Delay is represented as a negative start time.
    const delay = (animation.delay ?? 0) * -1;
    const timedAnimation: TimedAnimatorAnimation = {
      elapsedTime: delay,
      animation,
    };

    // For SVG animations, get or create the path interpolator.
    if (animation.type === "svg") {
      const [fromId, fromPath] = animation.path.from;
      const [toId, toPath] = animation.path.to;
      const cacheKey = `${fromId}_${toId}`;

      let interpolator = this.#interpolators.get(cacheKey);
      if (!interpolator) {
        interpolator = flubber.interpolate(fromPath, toPath, {
          maxSegmentLength: animation.path.maxSegments ?? 5,
        });

        // Cache for future use.
        this.#interpolators.set(cacheKey, interpolator);
      }
      timedAnimation.interpolator = interpolator;
    }

    this.#animations.set(globalThis.crypto.randomUUID(), timedAnimation);
    this.#scheduleTick();

    return this;
  }

  /**
   * Pauses the animation loop.
   */
  pause(): void {
    this.#cancelTick();
    this.#state = "paused";
  }

  /**
   * Resumes the animation loop.
   */
  resume(): void {
    if (this.#animations.size === 0) {
      this.#maybeNotifyAnimationFinished();
      return;
    }

    // Reset the last tick time to avoid a large jump after a long pause.
    this.#lastTickTime = 0;
    this.#state = "running";
    this.#scheduleTick();
  }

  /**
   * Clears all animations from the queue immediately.
   */
  reset(): void {
    this.#animations.clear();
    this.#lastTickTime = 0;
    this.#cancelTick();
    this.#maybeNotifyAnimationFinished();
  }

  /**
   * Allows the Animator instance to be `await`ed. The Promise resolves when
   * all enqueued animations are complete.
   */
  then<TResult1 = void, TResult2 = never>(
    resolve: (value: void) => TResult1 | PromiseLike<TResult1>,
    reject?: (reason: unknown) => TResult2 | PromiseLike<TResult2>
  ): Promise<TResult1 | TResult2> {
    const promise = this.#complete ?? Promise.resolve();
    return promise.then(resolve, reject);
  }
}

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactiveController, ReactiveControllerHost } from "lit";

type ScrollControllerState =
  | { status: "disconnected" }
  | { status: "free" }
  | {
      status: "follow-smooth";
      pollIntervalId: number;
    }
  | {
      status: "follow-fast";
      pollIntervalId: number;
    };

export class ScrollController implements ReactiveController {
  static readonly #followSmoothPollMs = 500;
  static readonly #followFastPollMs = 100;
  static readonly #initialFastFollowPeriodMs = 1000;
  readonly #host: ReactiveControllerHost;
  readonly #target: HTMLElement;
  #state: ScrollControllerState = { status: "disconnected" };
  #previousScrollTop = 0;

  constructor(host: ReactiveControllerHost, target: HTMLElement) {
    this.#host = host;
    this.#target = target;
    host.addController(this);
  }

  get status() {
    return this.#state.status;
  }

  hostConnected() {
    this.#target.addEventListener("scroll", this.#onScrollEvent);
    // We have an initial period where we check frequently and scroll instantly,
    // because we assume that during this time we might be loading some saved
    // earlier content, and we want to jump to the end of that quickly.
    this.#enableFollowFast();
    setTimeout(() => {
      if (this.#state.status === "follow-fast") {
        this.#enableFollowSmooth();
      }
    }, ScrollController.#initialFastFollowPeriodMs);
  }

  hostDisconnected() {
    this.#target.removeEventListener("scroll", this.#onScrollEvent);
    if (
      this.#state.status === "follow-smooth" ||
      this.#state.status === "follow-fast"
    ) {
      clearInterval(this.#state.pollIntervalId);
    } else {
      this.#state.status satisfies "free" | "disconnected";
    }
    this.#state = { status: "disconnected" };
    this.#host.requestUpdate();
  }

  #onScrollEvent = () => {
    if (
      this.#state.status === "follow-smooth" ||
      this.#state.status === "follow-fast"
    ) {
      const scrolledUp = this.#target.scrollTop < this.#previousScrollTop;
      if (scrolledUp) {
        this.#enableFreeScroll();
      }
    } else if (this.#state.status === "free") {
      if (this.#isAtBottom()) {
        this.#enableFollowSmooth();
      }
    } else {
      this.#state.status satisfies "disconnected";
    }
    this.#previousScrollTop = this.#target.scrollTop;
  };

  #enableFollowSmooth() {
    if (this.#state.status === "follow-smooth") {
      return;
    } else if (this.#state.status === "follow-fast") {
      clearInterval(this.#state.pollIntervalId);
    } else {
      this.#state.status satisfies "free" | "disconnected";
    }
    this.#state = {
      status: "follow-smooth",
      pollIntervalId: window.setInterval(
        this.#onFollowSmoothPoll,
        ScrollController.#followSmoothPollMs
      ),
    };
    this.#host.requestUpdate();
  }

  #enableFollowFast() {
    if (this.#state.status === "follow-fast") {
      return;
    } else if (this.#state.status === "follow-smooth") {
      clearInterval(this.#state.pollIntervalId);
    } else {
      this.#state.status satisfies "free" | "disconnected";
    }
    this.#state = {
      status: "follow-fast",
      pollIntervalId: window.setInterval(
        this.#onFollowFastPoll,
        ScrollController.#followFastPollMs
      ),
    };
    this.#host.requestUpdate();
  }

  #enableFreeScroll() {
    if (this.#state.status === "free") {
      return;
    } else if (
      this.#state.status === "follow-smooth" ||
      this.#state.status === "follow-fast"
    ) {
      clearInterval(this.#state.pollIntervalId);
    } else {
      this.#state.status satisfies "disconnected";
    }
    this.#state = { status: "free" };
    this.#host.requestUpdate();
  }

  #onFollowSmoothPoll = () => {
    if (this.#state.status !== "follow-smooth") {
      return;
    }
    if (!this.#isAtBottom()) {
      this.#target.scrollTo({
        top: this.#target.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  #onFollowFastPoll = () => {
    if (this.#state.status !== "follow-fast") {
      return;
    }
    if (!this.#isAtBottom()) {
      this.#target.scrollTo({
        top: this.#target.scrollHeight,
        behavior: "instant",
      });
    }
  };

  #isAtBottom() {
    return (
      Math.abs(
        this.#target.scrollTop +
          this.#target.clientHeight -
          this.#target.scrollHeight
      ) < 2
    );
  }
}

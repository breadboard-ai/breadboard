/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactiveController, ReactiveControllerHost } from "lit";

type ScrollControllerState =
  | { status: "disconnected" }
  | { status: "free" }
  | { status: "following"; pollIntervalId: number };

export class ScrollController implements ReactiveController {
  static readonly #followPollMs = 500;
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
    this.#enableFollowing();
  }

  hostDisconnected() {
    this.#target.removeEventListener("scroll", this.#onScrollEvent);
    if (this.#state.status === "following") {
      clearInterval(this.#state.pollIntervalId);
    } else {
      this.#state.status satisfies "free" | "disconnected";
    }
    this.#state = { status: "disconnected" };
    this.#host.requestUpdate();
  }

  #onScrollEvent = () => {
    if (this.#state.status === "following") {
      const scrolledUp = this.#target.scrollTop < this.#previousScrollTop;
      if (scrolledUp) {
        this.#enableFreeScroll();
      }
    } else if (this.#state.status === "free" && this.#isAtBottom()) {
      this.#enableFollowing();
    }
    this.#previousScrollTop = this.#target.scrollTop;
  };

  #enableFollowing() {
    if (this.#state.status === "following") {
      return;
    }
    this.#state.status satisfies "free" | "disconnected";
    this.#state = {
      status: "following",
      pollIntervalId: window.setInterval(
        this.#onFollowPoll,
        ScrollController.#followPollMs
      ),
    };
    this.#host.requestUpdate();
  }

  #enableFreeScroll() {
    if (this.#state.status === "free") {
      return;
    }
    if (this.#state.status === "following") {
      clearInterval(this.#state.pollIntervalId);
    } else {
      this.#state.status satisfies "disconnected";
    }
    this.#state = { status: "free" };
    this.#host.requestUpdate();
  }

  #onFollowPoll = () => {
    if (this.#state.status === "following" && !this.#isAtBottom()) {
      this.#target.scrollTo({
        top: this.#target.scrollHeight,
        behavior: "smooth",
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

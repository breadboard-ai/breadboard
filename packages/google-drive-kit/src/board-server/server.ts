/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BoardServer,
  BoardServerCapabilities,
  BoardServerExtension,
  BoardServerProject,
  ChangeNotificationCallback,
  GraphDescriptor,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  GraphProviderStore,
  Kit,
  Permission,
  Secrets,
  User,
} from "@google-labs/breadboard";

export { GoogleDriveBoardServer };

// This whole package should probably be called
// "@breadboard-ai/google-drive-board-server".
// But it's good that we have both components and the board server here:
// Good use case.
class GoogleDriveBoardServer implements BoardServer {
  static PROTOCOL = "drive:";

  static async connect() {
    // TODO: Implement connecting to Google Drive.
    return null;
  }

  get name(): string {
    throw new Error("Method not implemented.");
  }

  get user(): User {
    throw new Error("Method not implemented.");
  }

  get url(): URL {
    throw new Error("Method not implemented.");
  }

  get projects(): Promise<BoardServerProject[]> {
    throw new Error("Method not implemented.");
  }

  get kits(): Kit[] {
    throw new Error("Method not implemented.");
  }

  get users(): User[] {
    throw new Error("Method not implemented.");
  }

  get secrets(): Secrets {
    throw new Error("Method not implemented.");
  }

  get extensions(): BoardServerExtension[] {
    throw new Error("Method not implemented.");
  }

  get capabilities(): BoardServerCapabilities {
    throw new Error("Method not implemented.");
  }

  getAccess(url: URL, user: User): Promise<Permission> {
    throw new Error("Method not implemented.");
  }

  ready(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  isSupported(): boolean {
    throw new Error("Method not implemented.");
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    throw new Error("Method not implemented.");
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    throw new Error("Method not implemented.");
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    throw new Error("Method not implemented.");
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not implemented.");
  }

  createBlank(url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not implemented.");
  }

  async create(
    url: URL,
    graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not implemented.");
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not implemented.");
  }

  async connect(location?: string, auth?: unknown): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  async disconnect(location: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  async refresh(location: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  async createURL(location: string, fileName: string): Promise<string | null> {
    throw new Error("Method not implemented.");
  }

  parseURL(url: URL): { location: string; fileName: string } {
    throw new Error("Method not implemented.");
  }

  async restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  items(): Map<string, GraphProviderStore> {
    throw new Error("Method not implemented.");
  }

  startingURL(): URL | null {
    throw new Error("Method not implemented.");
  }

  async canProxy(url: URL): Promise<string | false> {
    throw new Error("Method not implemented.");
  }

  watch(callback: ChangeNotificationCallback) {}

  async preview(url: URL): Promise<URL> {
    throw new Error("Method not implemented.");
  }
}

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { FilteredIntegrations, IntegrationState, Tool } from "./types";

export { FilteredIntegrationsImpl };

class FilteredIntegrationsImpl implements FilteredIntegrations {
  @signal
  accessor filter: string = "";

  @signal
  get results(): ReadonlyMap<string, IntegrationState> {
    if (!this.filter) return this.integrations;
    const filter = new RegExp(this.filter, "gim");
    const filtered = new Map<string, IntegrationState>();
    this.integrations.forEach((integration, url) => {
      const tools = new Map<string, Tool>();
      if (integration.status !== "complete") return;
      integration.tools.forEach((tool, key) => {
        const { title } = tool;
        if (!title || filter.test(title)) {
          tools.set(key, tool);
        }
      });
      if (tools.size === 0) return;
      filtered.set(url, {
        title: integration.title,
        url: integration.url,
        status: integration.status,
        message: integration.message,
        tools,
      });
    });
    return filtered;
  }

  constructor(
    private readonly integrations: ReadonlyMap<string, IntegrationState>
  ) {}
}

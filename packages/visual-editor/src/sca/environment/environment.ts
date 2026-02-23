/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ClientDeploymentConfiguration,
  GoogleDrivePermission,
} from "@breadboard-ai/types/deployment-configuration.js";
import type {
  GuestConfiguration,
  OpalShellHostProtocol,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import type { RuntimeFlags } from "@breadboard-ai/types";
import { EnvironmentFlags } from "./environment-flags.js";
import { RuntimeConfig } from "../../utils/graph-types.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../ui/config/client-deployment-configuration.js";
import type { BuildInfo } from "../types.js";

export { createEnvironment, type AppEnvironment };

/**
 * The Environment is the foundational layer of SCA — created first and
 * injected into both Controllers and Services.
 *
 * It holds:
 * - **Feature flags** (reactive, overridable, IDB-persisted)
 * - **Deployment config** (immutable values from the server template)
 * - **Host capabilities** (shell protocol, guest configuration)
 *
 * ```
 *   UI   ←→   Controllers   ←→   Actions   ←→   Services
 *                  ↕                                ↕
 *            ╔═════════════════════════════════════════╗
 *            ║               ENVIRONMENT               ║
 *            ╚═════════════════════════════════════════╝
 * ```
 */
interface AppEnvironment {
  /**
   * Reactive feature flags with IDB-persisted user overrides.
   *
   * Read a flag: `env.flags.get("flagName")`
   * Override:    `env.flags.override("flagName", true)`
   * All flags:   `await env.flags.flags()`
   */
  readonly flags: EnvironmentFlags;

  /** The origin URL of the host server (e.g. `https://opal.dev`). */
  readonly hostOrigin: URL;
  /** The environment name (e.g. "prod", "staging"), or undefined for local dev. */
  readonly environmentName: string | undefined;
  /** Build metadata: version, commit hash, build date. */
  readonly buildInfo: BuildInfo;
  /** Google Drive configuration for the deployment. */
  readonly googleDrive: {
    readonly apiEndpoint: string | undefined;
    readonly publishPermissions: GoogleDrivePermission[];
  };
  /** Domain configuration from the client deployment config. */
  readonly domains: ClientDeploymentConfiguration["domains"];

  /** The full client deployment configuration (immutable, from server template). */
  readonly deploymentConfig: Readonly<ClientDeploymentConfiguration>;

  /** Shell host protocol for communication with the embedding shell. */
  readonly shellHost: OpalShellHostProtocol;
  /** Guest configuration provided by the shell at embed time. */
  readonly guestConfig: GuestConfiguration;

  /**
   * Resolves when all persisted fields (currently flag overrides) have been
   * loaded from IndexedDB. UI should gate on this before rendering flag-
   * dependent content.
   */
  readonly isHydrated: Promise<number>;
}

/**
 * Create the Environment from the runtime config and client deployment
 * configuration. This is called once during `sca()` bootstrap, before
 * both Controllers and Services are created.
 */
function createEnvironment(
  config: RuntimeConfig,
  flags: RuntimeFlags
): Readonly<AppEnvironment> {
  const envFlags = new EnvironmentFlags(flags);

  return {
    flags: envFlags,

    // Deployment config
    hostOrigin: config.globalConfig.hostOrigin,
    environmentName: config.globalConfig.environmentName,
    buildInfo: config.globalConfig.buildInfo,
    googleDrive: {
      apiEndpoint: CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_API_ENDPOINT,
      publishPermissions:
        config.globalConfig.googleDrive?.publishPermissions ?? [],
    },
    domains: CLIENT_DEPLOYMENT_CONFIG.domains,
    deploymentConfig: CLIENT_DEPLOYMENT_CONFIG,

    // Host capabilities
    shellHost: config.shellHost,
    guestConfig: config.guestConfig,

    // Hydration
    get isHydrated() {
      return envFlags.isHydrated;
    },
  };
}

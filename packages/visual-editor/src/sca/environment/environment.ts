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

export { createEnvironment, type Environment };

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
 *                   ↕                                ↕
 *                        ╔═══════════════╗
 *                        ║  ENVIRONMENT  ║
 *                        ╚═══════════════╝
 * ```
 */
interface Environment {
  // ── Feature flags (reactive, overridable) ─────────────────────
  readonly flags: EnvironmentFlags;

  // ── Immutable deployment config (from server template) ────────
  readonly hostOrigin: URL;
  readonly environmentName: string | undefined;
  readonly buildInfo: BuildInfo;
  readonly googleDrive: {
    readonly apiEndpoint: string | undefined;
    readonly publishPermissions: GoogleDrivePermission[];
  };
  readonly domains: ClientDeploymentConfiguration["domains"];

  // ── Deployment feature switches (from server template) ────────
  readonly deploymentConfig: Readonly<ClientDeploymentConfiguration>;

  // ── Host capabilities (from shell protocol) ───────────────────
  readonly shellHost: OpalShellHostProtocol;
  readonly guestConfig: GuestConfiguration;

  // ── Hydration ─────────────────────────────────────────────────
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
): Environment {
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

# Project Deflagration: Runtime Flag Cleanup

> Removing runtime flags that are always-on or always-off across all
> environments. A flag that never varies is not a flag — it's dead code
> masquerading as configurability.

## Motivation

The TF configuration defines per-environment flag values. When a boolean flag is
`true` (or `false` in some cases) in every environment, the flag serves no
purpose. The conditional branches it guards are never taken. Removing these
flags:

- **Reduces cognitive load** — fewer flags to understand and reason about.
- **Eliminates dead code** — the "off" branches of always-on flags are
  unreachable; the "on" branches of always-off flags are unreachable.
- **Shrinks the configuration surface** — less TF, fewer env vars, simpler
  deployment config types.

## Scope

### Always-On Flags (remove flag, hardcode `true`)

| TF Variable                               | Env Var                                   | `RuntimeFlags` key             | Location         |
| ----------------------------------------- | ----------------------------------------- | ------------------------------ | ---------------- |
| `enable_agent_mode`                       | `ENABLE_AGENT_MODE`                       | `agentMode`                    | flags block      |
| `enable_context_caching`                  | `ENABLE_CONTEXT_CACHING`                  | `enableContextCaching`         | flags block      |
| `enable_drive_picker_in_lite_mode`        | `ENABLE_DRIVE_PICKER_IN_LITE_MODE`        | `enableDrivePickerInLiteMode`  | flags block      |
| `enable_email_opt_in`                     | `ENABLE_EMAIL_OPT_IN`                     | —                              | top-level config |
| `enable_gemini_backend`                   | `ENABLE_GEMINI_BACKEND`                   | `enableGeminiBackend`          | flags block      |
| `enable_new_url_scheme`                   | `ENABLE_NEW_URL_SCHEME`                   | —                              | top-level config |
| `enable_require_consent_for_get_webpage`  | `ENABLE_REQUIRE_CONSENT_FOR_GET_WEBPAGE`  | `requireConsentForGetWebpage`  | flags block      |
| `enable_require_consent_for_open_webpage` | `ENABLE_REQUIRE_CONSENT_FOR_OPEN_WEBPAGE` | `requireConsentForOpenWebpage` | flags block      |
| `enable_sharing_2`                        | `ENABLE_SHARING_2`                        | —                              | top-level config |
| `enable_stream_gen_webpage`               | `ENABLE_STREAM_GEN_WEBPAGE`               | `streamGenWebpage`             | flags block      |
| `enable_stream_planner`                   | `ENABLE_STREAM_PLANNER`                   | `streamPlanner`                | flags block      |

### Always-Off Flags (remove flag, delete dead code)

| TF Variable         | Env Var             | `RuntimeFlags` key | Location    |
| ------------------- | ------------------- | ------------------ | ----------- |
| `enable_google_one` | `ENABLE_GOOGLE_ONE` | `googleOne`        | flags block |
| `enable_opal_adk`   | `ENABLE_OPAL_ADK`   | `opalAdk`          | flags block |

## Anatomy of a Flag Removal

Each phase follows the same pattern:

1. **Trace every consumer** — grep for the flag name across all packages.
2. **Remove the conditional** — for always-on: inline the `true` branch, delete
   the `false` branch. For always-off: delete the `true` branch, inline the
   `false` branch (often just removing the entire feature).
3. **Remove the flag definition** — delete from `RuntimeFlags` type
   (`packages/types/src/flags.ts`), `RUNTIME_FLAG_META`, server flags
   (`packages/unified-server/src/flags.ts`), config wiring
   (`packages/unified-server/src/config.ts`), and
   `ClientDeploymentConfiguration` type if applicable.
4. **Remove from TF** — delete the `locals` variable. (External to this repo,
   tracked but not executed here.)
5. **Verify** — build compiles, tests pass.

## Phases

### How Objectives Work

Objectives (🎯) are the **real** milestones — concrete, executable tests that
prove the system works. They go at the top of each phase. Everything below them
is in service of reaching them.

### Phase 1: `agentMode`

> 🎯 **Objective:** `agentMode` does not appear anywhere in the codebase.
> `git grep agentMode` returns nothing. Build and tests pass.

- [x] Trace all consumers of `agentMode` / `ENABLE_AGENT_MODE`
- [x] Inline true-branch, delete false-branch at each call site
- [x] Remove from `RuntimeFlags`, `RUNTIME_FLAG_META`, server flags, config
- [x] Verify: `npm run build && npm run test`

### Phase 2: `enableContextCaching`

> 🎯 **Objective:** `enableContextCaching` / `ENABLE_CONTEXT_CACHING` does not
> appear anywhere. Build and tests pass.

- [x] Trace all consumers
- [x] Inline true-branch at each call site
- [x] Remove from flag definitions and config wiring
- [x] Verify

### Phase 3: `enableDrivePickerInLiteMode`

> 🎯 **Objective:** `enableDrivePickerInLiteMode` /
> `ENABLE_DRIVE_PICKER_IN_LITE_MODE` does not appear anywhere. Build and tests
> pass.

- [x] Trace all consumers
- [x] Inline true-branch at each call site
- [x] Remove from flag definitions and config wiring
- [x] Verify

### Phase 4: `ENABLE_EMAIL_OPT_IN`

> 🎯 **Objective:** `ENABLE_EMAIL_OPT_IN` does not appear anywhere. Build and
> tests pass.
>
> This is a top-level `ClientDeploymentConfiguration` property, not a
> `RuntimeFlags` entry — the removal pattern differs slightly.

- [ ] Trace all consumers of `ENABLE_EMAIL_OPT_IN`
- [ ] Inline true-branch at each call site
- [ ] Remove from server flags, config wiring, and
      `ClientDeploymentConfiguration` type
- [ ] Verify

### Phase 5: `enableGeminiBackend`

> 🎯 **Objective:** `enableGeminiBackend` / `ENABLE_GEMINI_BACKEND` does not
> appear anywhere. Build and tests pass.

- [ ] Trace all consumers
- [ ] Inline true-branch at each call site
- [ ] Remove from flag definitions and config wiring
- [ ] Verify

### Phase 6: `ENABLE_NEW_URL_SCHEME`

> 🎯 **Objective:** `ENABLE_NEW_URL_SCHEME` does not appear anywhere. Build and
> tests pass.
>
> Top-level `ClientDeploymentConfiguration` property.

- [ ] Trace all consumers
- [ ] Inline true-branch at each call site
- [ ] Remove from server flags, config wiring, and
      `ClientDeploymentConfiguration` type
- [ ] Verify

### Phase 7: `requireConsentForGetWebpage`

> 🎯 **Objective:** `requireConsentForGetWebpage` /
> `ENABLE_REQUIRE_CONSENT_FOR_GET_WEBPAGE` does not appear anywhere. Build and
> tests pass.

- [ ] Trace all consumers
- [ ] Inline true-branch at each call site
- [ ] Remove from flag definitions and config wiring
- [ ] Verify

### Phase 8: `requireConsentForOpenWebpage`

> 🎯 **Objective:** `requireConsentForOpenWebpage` /
> `ENABLE_REQUIRE_CONSENT_FOR_OPEN_WEBPAGE` does not appear anywhere. Build and
> tests pass.

- [ ] Trace all consumers
- [ ] Inline true-branch at each call site
- [ ] Remove from flag definitions and config wiring
- [ ] Verify

### Phase 9: `ENABLE_SHARING_2`

> 🎯 **Objective:** `ENABLE_SHARING_2` does not appear anywhere. Build and tests
> pass.
>
> Top-level `ClientDeploymentConfiguration` property.

- [ ] Trace all consumers
- [ ] Inline true-branch at each call site
- [ ] Remove from server flags, config wiring, and
      `ClientDeploymentConfiguration` type
- [ ] Verify

### Phase 10: `streamGenWebpage`

> 🎯 **Objective:** `streamGenWebpage` / `ENABLE_STREAM_GEN_WEBPAGE` does not
> appear anywhere. Build and tests pass.

- [ ] Trace all consumers
- [ ] Inline true-branch at each call site
- [ ] Remove from flag definitions and config wiring
- [ ] Verify

### Phase 11: `streamPlanner`

> 🎯 **Objective:** `streamPlanner` / `ENABLE_STREAM_PLANNER` does not appear
> anywhere. Build and tests pass.

- [ ] Trace all consumers
- [ ] Inline true-branch at each call site
- [ ] Remove from flag definitions and config wiring
- [ ] Verify

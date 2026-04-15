# System Configuration

The file `hive/config/SYSTEM.yaml` is the global configuration for a hive
instance. It controls the hive's identity, startup behavior, and external tool
integrations.

## Schema

```yaml
# Required. Display name for this hive.
title: My Hive

# Optional. Short summary shown in the UI.
description: A personal assistant hive

# Required. Template name to auto-boot at startup. The scheduler creates a
# task from this template if none with a matching playbook_id exists yet.
root: opie

# Optional. List of MCP server registrations (see below).
mcp:
  - name: weather
    description: Weather data and forecasts
    command: npx -y @example/weather-mcp
```

### Fields

| Field         | Type     | Required | Description |
| ------------- | -------- | -------- | ----------- |
| `title`       | string   | yes      | Human-readable hive name. |
| `description` | string   | no       | Short summary for the UI. |
| `root`        | string   | yes      | Template name for the root agent. |
| `mcp`         | list     | no       | MCP server registrations. |

---

## MCP servers

The `mcp` section registers external tool providers using the
[Model Context Protocol](https://modelcontextprotocol.io).
Each entry becomes a **function group** that agents can access via the
template `functions` filter — for example, a template with
`functions: [weather.*]` gets all tools from the `weather` server.

### Transport modes

MCP servers connect via one of two transports. Each server entry must include
exactly one of `command` or `url`.

#### Local (stdio)

The scheduler spawns the server as a child process and communicates over
stdin/stdout.

```yaml
mcp:
  - name: weather
    description: Weather data and forecasts
    command: npx -y @example/weather-mcp
    env:
      API_KEY: "${WEATHER_API_KEY}"
```

#### HTTP (Streamable HTTP)

The scheduler connects to a remote server over HTTP.

```yaml
mcp:
  - name: composio
    description: Composio MCP Server
    url: https://connect.composio.dev/mcp
    headers:
      x-consumer-api-key: "${COMPOSIO_API_KEY}"
```

### Server entry fields

| Field         | Type              | Required | Description |
| ------------- | ----------------- | -------- | ----------- |
| `name`        | string            | yes      | Identifier. Becomes the function group name and the prefix for all tools (e.g., `weather_get_forecast`). Must not collide with built-in group names (`system`, `chat`, `sandbox`, etc.). |
| `description` | string            | no       | Shown in system instructions when the group is active. |
| `command`     | string            | one of   | Shell command for stdio transport. The first token is the executable; the rest are arguments. |
| `url`         | string            | one of   | URL for Streamable HTTP transport. |
| `headers`     | map\<str, str\>   | no       | HTTP headers sent with every request (HTTP only). |
| `env`         | map\<str, str\>   | no       | Environment variables set on the child process (stdio only). |

### Environment variable references

Values in `headers` and `env` support `${VAR}` expansion from the host
process environment. This keeps secrets out of the YAML file:

```yaml
headers:
  Authorization: "Bearer ${MY_API_KEY}"
```

If `MY_API_KEY` is not set, it expands to an empty string and a warning is
logged at startup.

> **Tip.** Store secrets in a `.env` file at the hive root or in your shell
> profile. The scheduler reads `os.environ` at connection time.

### How it works at runtime

1. **Startup.** The scheduler reads the `mcp` list and connects to each
   server (stdio subprocess or HTTP). Connections are validated and opened
   before the first scheduling cycle. If any connection fails, the
   scheduler raises and refuses to start.

2. **Tool discovery.** After connecting, the scheduler calls `list_tools()`
   on each server. Each tool's MCP `inputSchema` is translated to a Gemini
   `parametersJsonSchema` and its name is prefixed with the server name
   (e.g., `get_forecast` → `weather_get_forecast`).

3. **Session injection.** The resulting function groups are passed to every
   agent session. The template's `functions` filter gates which groups each
   agent can see. The filter supports three tiers:

   | Pattern | Matches | Example |
   |---|---|---|
   | `zapier.*` | All tools in the group | every Zapier tool |
   | `zapier.slack.*` | Tools prefixed `zapier_slack_` | `zapier_slack_send_message`, `zapier_slack_list_channels` |
   | `zapier.slack.send_message` | Exact tool `zapier_slack_send_message` | just that one |

   The dot in the pattern maps to an underscore in the actual tool name.
   Sub-namespace wildcards are especially useful for large MCP servers
   (e.g., Zapier exposes 70+ tools) where pulling in everything would
   exceed the Gemini API's tool limit:

   ```yaml
   # Only give this agent Slack and Google Calendar tools:
   functions:
     - system.*
     - chat.*
     - zapier.slack.*
     - zapier.google_calendar.*
   ```

4. **Proxied calls.** When an agent calls an MCP tool, the proxy handler
   strips the server prefix, forwards the call via the MCP SDK's
   `call_tool()`, and flattens the JSON-RPC response back into the agent's
   context.

5. **Shutdown.** On server shutdown (`^C` or API signal), all MCP
   connections are cleanly closed via `AsyncExitStack`.

### Limitations

- **Stateless only.** All agent sessions share a single connection per
  server. Servers that maintain per-session state (e.g., browser
  automation) will not work correctly. A future `stateful: true` flag will
  create per-agent connections.

- **Text content only.** Binary/image content from MCP tool responses is
  not yet supported — only `text` content items are forwarded.

- **No resource or prompt support.** Only the MCP `tools` capability is
  used; `resources` and `prompts` are not surfaced.

### Editing in HiveTool

The HiveTool workbench (System tab) provides a visual editor for MCP server
entries. The transport chooser (HTTP / Local) toggles which fields are shown,
and the key-value editors handle headers and environment variables inline.

---

## Full example

```yaml
title: Opal
description: Personal assistant
root: opie

mcp:
  - name: composio
    description: Composio MCP Server
    url: https://connect.composio.dev/mcp
    headers:
      x-consumer-api-key: "${COMPOSIO_API_KEY}"

  - name: filesystem
    description: Local filesystem tools
    command: npx -y @modelcontextprotocol/server-filesystem /tmp/workspace
```

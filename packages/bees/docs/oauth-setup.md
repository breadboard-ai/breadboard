# Setting Up OAuth for MCP Servers

This guide walks you through configuring OAuth 2.0 for remote MCP servers that
require it — most notably the
[Google Workspace MCP servers](https://developers.google.com/workspace/guides/configure-mcp-servers)
(Gmail, Drive, Calendar, Chat, People).

## Prerequisites

- A hive directory with a working `SYSTEM.yaml`
- [Hivetool](hivetool.md) running, pointing at the hive directory.
- Access to the [Google Cloud Console](https://console.cloud.google.com/)

---

## Step 1 — Create an OAuth Client

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project.
3. Navigate to **APIs & Services → Credentials**.
4. Click **+ Create Credentials → OAuth client ID**.
5. For **Application type**, choose **Desktop app**.
6. Give it a name (e.g., "Bees MCP OAuth") and click **Create**.
7. Copy the **Client ID** and **Client secret** values.

> [!NOTE] Desktop app is the correct type. It allows `http://localhost` redirect
> URIs with any port, which is how hivetool receives the authorization code.

### Enable the APIs

For each Google Workspace MCP server you want to use, enable the corresponding
API:

| MCP Server      | API to Enable       |
| --------------- | ------------------- |
| Gmail           | Gmail API           |
| Google Drive    | Google Drive API    |
| Google Calendar | Google Calendar API |
| Google Chat     | Google Chat API     |
| Google Contacts | People API          |

Navigate to **APIs & Services → Library**, search for each API, and click
**Enable**.

---

## Step 2 — Store Credentials in `.env`

Create or edit the `.env` file at the **root of your hive directory**:

```env
GOOGLE_OAUTH_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-abcdef123456
```

> [!IMPORTANT] Never commit `.env` files to version control. Add `.env` to your
> `.gitignore`.

The variable names are up to you — they just need to match the `${VAR}`
references you'll use in `SYSTEM.yaml`.

---

## Step 3 — Configure MCP Servers in SYSTEM.yaml

Add an MCP server entry with an `oauth` block for each Google Workspace service
you want. Here's a full example with Gmail and Drive:

```yaml
mcp:
  - name: gmail
    description: Gmail MCP Server
    url: https://gmailmcp.googleapis.com/mcp/v1
    oauth:
      client_id: "${GOOGLE_OAUTH_CLIENT_ID}"
      client_secret: "${GOOGLE_OAUTH_CLIENT_SECRET}"
      scopes:
        - https://www.googleapis.com/auth/gmail.readonly
        - https://www.googleapis.com/auth/gmail.compose

  - name: drive
    description: Google Drive MCP Server
    url: https://drivemcp.googleapis.com/mcp/v1
    oauth:
      client_id: "${GOOGLE_OAUTH_CLIENT_ID}"
      client_secret: "${GOOGLE_OAUTH_CLIENT_SECRET}"
      scopes:
        - https://www.googleapis.com/auth/drive.readonly
```

### Configuration rules

- **`oauth` and `headers` are mutually exclusive.** A server uses one or the
  other, not both.
- **`oauth` requires `url`.** Only HTTP transport supports OAuth (not
  stdio/local servers).
- **Credentials must be `${ENV_VAR}` references**, not inline values.

You can also configure this visually in hivetool's System tab — use the **HTTP**
transport toggle, then switch the authentication mode from **Headers** to
**OAuth**.

### Scopes reference

See Google's documentation for available scopes:

- [Gmail scopes](https://developers.google.com/gmail/api/auth/scopes)
- [Drive scopes](https://developers.google.com/drive/api/guides/api-specific-auth)
- [Calendar scopes](https://developers.google.com/calendar/api/auth)

Request only the scopes your agents actually need.

---

## Step 4 — Authenticate in Hivetool

1. Open hivetool and go to the **System** tab.
2. Each OAuth-configured MCP server shows an **Authenticate** button and a
   status indicator:
   - 🟡 **Not Authenticated** — no token file exists yet.
   - 🟢 **Connected** — valid tokens are stored.
   - 🔵 **Pending** — authentication is in progress.
3. Click **Authenticate**. A popup opens to Google's consent page.
4. Sign in with the Google account you want the agents to act on behalf of.
5. Review and approve the requested permissions.
6. The popup closes automatically. The status updates to **Connected**.

> [!TIP] If the popup is blocked, your browser will show a notification. Allow
> popups for `localhost` and try again.

---

## Step 5 — Start the Box

Start (or restart) the box:

```bash
python -m bees.box path/to/hive
```

The box reads the token file from `hive/.mcp-tokens/<name>.json` and connects to
the OAuth-protected MCP server automatically. You should see the server's tools
listed during startup.

If tokens are missing, the box logs a warning and skips that server:

```
WARNING — gmail: no OAuth tokens found. Authenticate via hivetool.
```

---

## Token Storage

Tokens are stored as JSON files in the hive directory:

```
hive/
  .mcp-tokens/
    gmail.json       ← tokens + client info for the "gmail" server
    drive.json       ← tokens + client info for the "drive" server
  config/
    SYSTEM.yaml
```

Each file contains both the OAuth tokens (`access_token`, `refresh_token`, etc.)
and the client credentials used to obtain them.

> [!NOTE] The `.mcp-tokens/` directory is intentionally outside `config/` so
> that writing tokens does not trigger box restarts (the box watches `config/`
> for changes).

---

## Re-authenticating

To refresh or replace tokens (e.g., after revoking access or changing scopes):

1. Go to the System tab in hivetool.
2. Click **Re-authenticate** on the server card.
3. Complete the consent flow again.

The new tokens overwrite the existing file.

---

## Multiple Servers, Shared Client

Multiple MCP servers can share the same OAuth client credentials (same
`${ENV_VAR}` references) with different scopes. Each server gets its own token
file. The user is prompted once per server.

---

## Troubleshooting

| Problem                              | Solution                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| "Could not resolve client_id"        | Check that your `.env` file exists at the hive root and the variable names match the `${VAR}` references in SYSTEM.yaml. |
| Popup blocked                        | Allow popups for `localhost` in your browser settings.                                                                   |
| "Token exchange failed (400)"        | Verify the client ID/secret are correct and the OAuth client type is "Desktop app."                                      |
| Box says "authenticate via hivetool" | Open hivetool and click Authenticate on the server card.                                                                 |
| "State mismatch"                     | Try again — this is a safety check. If it persists, clear browser storage and retry.                                     |
| Need to change scopes                | Update scopes in SYSTEM.yaml, then re-authenticate to request the new permissions.                                       |

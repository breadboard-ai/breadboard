import type { ConnectionConfig } from "../config.js";

export function createConnection(
  connectionId: string,
  clientId: string,
  clientSecret: string,
  scopes: string[]
): ConnectionConfig {
  return {
    id: connectionId,
    oauth: {
      client_id: clientId,
      client_secret: clientSecret,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      scopes,
    },
  };
}

---
trigger: always_on
---

[EXPERIMENTAL]

If the user asks, you can access Opal with a live browser at `http://localhost:3100`.

The user must be running the fake server with `npm run dev:fake -w packages/unified-server`
for this to work. You cannot start the fake server yourself. If you can't see that the user
is running the fake server, run a curl command to verify, and ask the user if it fails.

In the fake server:

- OAuth is skipped. You will be automatically signed-in with a fake. You can sign-out and
  back in again.

- Google Drive is faked with an in-memory store. Its memory will be wiped every time the
  server reloads. Creating, editing, and sharing Opals is supported.

- Most other services are not yet faked, so most Opals cannot currently be executed, and
  various other features may not currently work.

- Opal makes heavy use of Shadow DOM, so you will need to actively walk through Shadow
  DOM boundaries when searching for elements.
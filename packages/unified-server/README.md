# Breadboard Unified Server

The Breadboard Unified Server is a server that hosts the Breadboard Visual Editor along with necessary backend services. It provides a single endpoint for running Breadboard applications with full feature support.

## Components

- **Visual Editor**: Serves the static assets for the Breadboard Visual Editor. Uses `vite-express` to seamlessly serve the frontend in both development (HMR) and production.
- **Connection Server**: Handles OAuth flows and API connection management.
- **Google Drive Integration**: Provides proxy access to Google Drive files and a caching gallery for featured boards.
- **Blobs Storage**: Manages temporary storage for binary data (blobs) generated during board execution.

## Project Structure

- `src/main.ts`: The entry point that configures the Express server and mounts middleware.
- `src/connection/`: Implements the Connection Server for handling authentication.
- `src/gallery.ts` & `src/drive-proxy.ts`: Implements Google Drive integration and caching.
- `src/blobs/`: Implements blob storage handling.
- `src/config.ts` & `src/flags.ts`: Configuration and feature flag management.

## Development

To run the server in development mode with hot module replacement (HMR):

```bash
npm run dev
```


## Configuration

The server is configured via environment variables and flags. See `src/config.ts` and `src/flags.ts` for details.

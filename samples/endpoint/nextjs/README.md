# Calling board server from a NextJS app

This example calls board server [run](https://breadboard-ai.github.io/breadboard/docs/reference/board-run-api-endpoint/#run-api-endpoint) endpoint from NextJS app.

In this particular case, streaming is used to progressively update the UI.

Overall, this is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

To use this sample as a starting point, run [degit](https://github.com/Rich-Harris/degit) in a new directory:

```bash
npx degit breadboard-ai/breadboard/samples/endpoint/nextjs
```

To try it, first install dependencies:

```bash
npm i
```

Then run NextJS local server:

```bash
npm run dev
```

To keep the dependencies light, the sample uses local file system as the storage of the artifacts. To make it production-ready, you will need to replace the `app/utils/store.ts` implementation with something more robust.


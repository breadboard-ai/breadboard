import path from 'path';
import esbuild from 'esbuild';
import { Plugin } from 'rollup';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

const GraphPlugin = (kits: []): Plugin => {
  return {
    name: 'vite-plugin-kits',
    async buildStart() {
      for (const kit of kits) {
        console.log("Emitting kit", kit);
        this.emitFile(
          {
            type: 'chunk',
            id: kit,
            fileName: `${kit}.js`,
            name: kit,
          });
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        for (const kit of kits) {
          if (req.url.endsWith(`/${kit}.js`)) {
            try {
              const buildOutput = await esbuild.build({
                entryPoints: [kit],
                bundle: true,
                format: 'esm',
                platform: 'browser',
                write: false,
                plugins: [NodeModulesPolyfillPlugin(), NodeGlobalsPolyfillPlugin({ process: false, })], // So it's not 
              });

              const finalOutput = buildOutput.outputFiles[0].text;

              res.setHeader('Content-Type', 'text/javascript');
              return res.end(finalOutput);

            }
            catch (e) {
              console.error(e);
            }

          }
        }

        next();
      });
    }
  }
};

export default GraphPlugin;
import { SandboxedModule } from "@breadboard-ai/jsandbox";
import { GraphDescriptor, MutableGraph, Outcome } from "@breadboard-ai/types";
import {
  CapabilitiesManager,
  RunnableModule,
  RunnableModuleFactory,
  Sandbox,
} from "@breadboard-ai/types/sandbox.js";
import { err } from "@breadboard-ai/utils";

export class SandboxedRunnableModuleFactory implements RunnableModuleFactory {
  constructor(private readonly sandbox: Sandbox) {}

  async createRunnableModule(
    mutable: MutableGraph,
    graph: GraphDescriptor,
    capabilities?: CapabilitiesManager
  ): Promise<Outcome<RunnableModule>> {
    const declarations = graph.modules;
    if (!declarations) {
      return err(`Unable to create runnable module: no declarations`);
    }
    const modules = Object.fromEntries(
      Object.entries(declarations).map(([name, spec]) => [name, spec.code])
    );
    await addImportedModules(modules, mutable);
    const module = new SandboxedModule(
      this.sandbox,
      capabilities?.createSpec() || {},
      modules
    );
    return module;
  }
}

async function addImportedModules(
  modules: Record<string, string>,
  mutable: MutableGraph
): Promise<void> {
  const inspectable = mutable.graphs.get("");
  if (!inspectable) return;

  const imports = await inspectable.imports();
  imports.forEach((imported, importName) => {
    if ("$error" in imported) return;

    for (const [moduleName, spec] of Object.entries(imported.modules())) {
      const modulePath = `${importName}/${moduleName}`;
      modules[modulePath] = spec.code();
    }
  });
}

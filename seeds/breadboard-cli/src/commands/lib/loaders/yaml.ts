import { Board, BoardRunner, GraphDescriptor } from "@google-labs/breadboard";
import { readFile } from "fs/promises";
import yaml from "yaml";

export class YAMLLoader {
  async load(filePath: string): Promise<BoardRunner> {
    const fileContents = await readFile(filePath, "utf-8");

    const yamlInstance = yaml.parse(fileContents);

    if (yamlInstance == undefined) {
      throw new Error(`There is an error with your YAML file`);
    }

    if (yamlInstance.edges == undefined) {
      throw new Error(`There is no edges property in your YAML file`);
    }

    if (yamlInstance.nodes == undefined) {
      throw new Error(`There is no nodes property in your YAML file`);
    }

    const edges = yamlInstance.edges.map((edgeYaml: string) => {
      // Parse the edge syntax
      const edgeSyntax = edgeYaml.match(/(.+)\.(.+){0,1}->(.+)\.(.+){0,1}/);

      if (edgeSyntax == null || edgeSyntax.length == 0) {
        return null;
      }

      const edge = {
        from: edgeSyntax[1],
        out: edgeSyntax[2],
        to: edgeSyntax[3],
        in: edgeSyntax[4],
      };

      return {
        ...edge,
      };
    });

    const nodeCounter: Record<string, number> = {};
    const nodes = yamlInstance.nodes.map(
      (nodeYaml: Record<string, unknown>) => {
        if (nodeYaml.type == undefined) {
          throw new Error(
            `'type' is missing from a node definition in YAML file`
          );
        }

        const type: string = nodeYaml.type as string;
        let id = nodeYaml.id;

        // If the id is not defined then we need to generate one. we can only have one node of each type without an id
        if (id == undefined) {
          if (type in nodeCounter) {
            throw new Error(
              `There is more than one node of type ${type} without an id. Please add an id to one of them.`
            );
          }

          nodeCounter[type] = nodeCounter[type]++ ?? 0;
          id = `${type}`;
        }

        return {
          ...nodeYaml,
          type,
          id,
        };
      }
    );

    const board: GraphDescriptor = {
      ...yamlInstance,
      edges,
      nodes,
    };

    return Board.fromGraphDescriptor(board);
  }
}

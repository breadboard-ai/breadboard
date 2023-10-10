from javascript import require, AsyncTask

import sys
import asyncio
import json
from traversal.traversal_types import Edge, NodeDescriptor
import breadboard as breadboard1



graph_path = sys.argv[1]
with open(graph_path) as f:
  graph = json.load(f)
print(graph)
print(type(graph))
edges = []
for edge in graph['edges']:
  if 'from' in edge:
    edge['previous'] = edge['from']
    edge.pop('from')
  if 'to' in edge:
    edge['next'] = edge['to']
    edge.pop('to')
  if 'in' in edge:
    edge['input'] = edge['in']
    edge.pop('in')
  edges.append(Edge(**edge))
edges = edges
nodes = [NodeDescriptor(**node) for node in graph['nodes']]




async def main():

  breadboard = breadboard1.Board(edges=edges, nodes=nodes)
  print(graph['kits'])
  for kit in graph['kits']:
    print(kit['url'][4:])
    kit_constructor = require(kit['url'][4:])
    breadboard.addKit(kit_constructor)

  print("Running")
  running = True
  try:
    print("Running after try")
    async for next_step in breadboard.run(None):
      print("stepping!")
      if not running:
          return
      res = next_step
      if res:
        if res.type == "input":
          message = res.inputArguments['message'] if res.inputArguments and res.inputArguments.get('message') else "Enter some text."
          res.inputs = {"text": input(message+ "\n")}
        elif res.type == "output":
          if res.outputs and res.outputs['text']:
            print(str(res.outputs['text']) + "\n")
      else:
        print(f"All done! {next_step}")
        running = False
    print("Awesome work! Let's do this again sometime.")
  except Exception as e:
    print("Oh no! Something went wrong.")
    raise e

if __name__ == "__main__":
    asyncio.run(main())

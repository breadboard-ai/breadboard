
import asyncio
from javascript import require, AsyncTask
import json
import sys
import os
project_path = os.path.dirname(__file__)
sys.path.append(project_path)

from breadboard import Board

class LogProbe():
  def dispatchEvent(self, probe_event):
    print(f"Probe Event: {probe_event.__dict__}")

async def main(graph_path: str):
  breadboard = await Board.load(graph_path)

  print("Let's traverse a graph!")
  running = True
  try:
    async for next_step in breadboard.run(None):
      if not running:
          return
      res = next_step
      if res:
        if res.type == "input":
          # Message can be found in any(inputArgument["schema"]["properties"])["description"]
          message = "Enter some text."
          if res.inputArguments and res.inputArguments.get("schema", {}).get("properties"):
            props = res.inputArguments["schema"]["properties"]
            if len(props) > 0:
              first_prop = next(iter(props.values()))
              message = first_prop.get("description", message)
          user_input = input(message+ "\n")
          res.inputs = {"text": user_input} if user_input else {"exit": True}
        elif res.type == "output":
          if res.outputs and res.outputs['text']:
            for key in res.outputs:
              if key == "schema":
                continue
              title = "" if key == "text" else f"{key}: "
              if type(res.outputs[key]) == str:
                print(f"{title}{res.outputs[key]}")
              else:
                print(f"{title}{json.dumps(res.outputs[key])}")
      else:
        print(f"All done! {next_step}")
        running = False
    print("Awesome work! Let's do this again sometime.")
  except Exception as e:
    print("Oh no! Something went wrong.")
    raise e

if __name__ == "__main__":
    graph_path = sys.argv[1]
    asyncio.run(main(graph_path))

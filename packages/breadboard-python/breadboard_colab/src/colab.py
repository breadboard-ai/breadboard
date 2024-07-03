from io import StringIO
import json
import sys

import logging
from google.colab import output
from IPython import display



def run_python(data):
  try:
    # Extract code input
    code = data["$code"]
    data.pop("$code")

    old_stdout = sys.stdout
    redirected_output = sys.stdout = StringIO()

    previous_globals = dict(globals() | data)
    globals().update(data)
    exec_result = exec(code, globals(), globals())

    sys.stdout = old_stdout

    current_globals = dict(previous_globals | globals())
    changed_globals = {}
    for k in current_globals:
      if (
          k not in previous_globals
          or current_globals[k] != previous_globals[k]
          or k in data
      ):
        try:
          json.dumps(current_globals[k])
          changed_globals[k] = current_globals[k]
        except TypeError:
          logging.debug(
              "Skipping output variable that's not json serializable:"
              f" {current_globals[k]}"
          )

    res = changed_globals | {
        "result": exec_result,
        "stdout": redirected_output.getvalue(),
    }
    logging.debug("Exec result: %s", res)
    return json.dumps(res)
  except Exception as e:
    return json.dumps([{"error": f"Python Failure: {e}"}])



def start_breadboard_iframe(
    breadboard_url: str = "https://breadboard-ai.web.app",
):
  output.register_callback('breadboard_run_python', run_python)
  output.eval_js("""
function parse_python_output(python_output) {
  let parsed_output = python_output.replace(/\\\\\\\\|\\\\'|\\\\"/g,function(match) {
    if (match=="\\\\\\\\") return "\\\\";
    if (match=="\\\\'") return "\";
    if (match=='\\\\"') return '"';
  })
  return parsed_output;
}
const channel = new MessageChannel();
    const out = channel.port2;

    const processMessage = (type, data) => {
      if (type === "proxy" && data.node.type === "runPython") {

        google.colab.kernel.invokeFunction('breadboard_run_python', [data.inputs], {}).then(resp => {
            const resp_body = JSON.parse(parse_python_output(resp.data["text/plain"].slice(1, -1)));
            out.postMessage(["proxy", {outputs: {...{ context: data.inputs }, ...resp_body }}]); 
        });
      } else {
        out.postMessage([
          "error", { error: "unknown node, not sure what to do" }
        ])
      }
    }

    out.addEventListener("message", (evt) => {
      processMessage(... evt.data);
    });
    out.start();

    window.addEventListener("message", (evt) => {
      if (evt.data !== "letsgo") {
        return;
      }
      const iframe = document.getElementById("breadboard_iframe").contentWindow;
      iframe.postMessage(evt.data, evt.origin, [ channel.port1 ]);
    });
  """)
  target_url = breadboard_url
  display.display_html(
      f'<iframe id=breadboard_iframe src={target_url} allow="clipboard-write'
      ' self *" height=700 width="100%"></iframe>', raw=True
  )

import sys
import httpx
from typing import Any

from opal_backend.function_definition import (
    FunctionDefinition,
    FunctionGroup,
    map_definitions,
)

def get_sandbox_tool_group(http: httpx.AsyncClient, tool_files: dict[str, str]) -> FunctionGroup:
    """Create tool group with sandbox execution utilities."""

    async def system_run_sandboxed_script(
        args: dict[str, Any],
        status_cb: Any | None = None
    ) -> dict[str, Any]:
        script_path = args.get("script_path")
        files = args.get("files")
        
        if not script_path:
             return {"success": False, "error": "script_path is required"}

        if status_cb:
              status_cb(f"Executing sandboxed script {script_path}...")

        # Clean script path of agent VFS mounts prefix wrappers if present
        cleaned_path = script_path
        if cleaned_path.startswith("/mnt/"):
             cleaned_path = cleaned_path[5:]
        if cleaned_path.startswith("system/tools/"):
             cleaned_path = cleaned_path[13:]

        # Load driver content from the mounted tool files bundle
        vfs_path = f"system/tools/{cleaned_path}"
        script_content = tool_files.get(vfs_path)
        
        if not script_content:
             return {"success": False, "error": f"Tool script driver {script_path} not found in VFS mounts."}

        # Setup standard execution command
        if cleaned_path.endswith(".mjs") or cleaned_path.endswith(".js"):
             command = ["node", cleaned_path]
        elif cleaned_path.endswith(".py"):
             command = ["python3", cleaned_path]
        else:
             return {"success": False, "error": "Unsupported script driver extension format"}

        # Merge user files with the driver script file
        exec_files = dict(files) if files else {}
        exec_files[cleaned_path] = script_content

        try:
            resp = await http.post(
                "http://127.0.0.1:3500/run_script",
                json={
                    "command": command,
                    "files": exec_files
                },
                timeout=30.0
            )
            if resp.status_code != 200:
                 return {
                     "success": False, 
                     "error": f"Execute failed: {resp.text[:500]}"
                 }
            
            data = resp.json()
            return {
                "success": data.get("exit_code") == 0,
                "exit_code": data.get("exit_code"),
                "stdout": data.get("stdout"),
                "stderr": data.get("stderr"),
                "files_created": list(data.get("output_files", {}).keys())
            }
            
        except Exception as e:
             return {
                 "success": False, 
                 "error": f"Connection to sandbox service failed: {e}"
             }

    run_script_def = FunctionDefinition(
        name="system_run_sandboxed_script",
        description="Executes an isolated script driver artifact inside standard isolate boundaries natively triggers benchmark formats accurately speed correctly benchmarks. Supports .js, .mjs, and .py file slug inclusions formats.",
        handler=system_run_sandboxed_script,
        parameters_json_schema={
            "type": "OBJECT",
            "properties": {
                "script_path": {
                    "type": "STRING",
                    "description": "Relative slug path to the tool runner (e.g. 'ui-generator/bundler.mjs')"
                },
                "files": {
                    "type": "OBJECT",
                    "description": "Optional map of relative filenames to file contents (e.g. {'input.json': '...'}) to write into the sandbox before execution load triggers accurate setups.",
                    "additionalProperties": { "type": "STRING" }
                }
            },
            "required": ["script_path"]
        }
    )

    mapped = map_definitions([run_script_def])
    
    return FunctionGroup(
        definitions=mapped.definitions,
        declarations=mapped.declarations,
        instruction="Use `system_run_sandboxed_script` to execute driver scripts loaded relative triggers bounds correctly benchmark speed formats triggers trigger. Requires script_path relative trigger speeds accurately fixes safely safeguards layouts trig."
    )

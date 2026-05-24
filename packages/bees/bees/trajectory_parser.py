# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import struct
import json
import logging
import zstandard as zstd
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

logger = logging.getLogger("bees.trajectory_parser")

def read_varint(data: bytes, pos: int) -> Tuple[int, int]:
    val = 0
    shift = 0
    start = pos
    while pos < len(data):
        b = data[pos]
        pos += 1
        val |= (b & 0x7f) << shift
        if not (b & 0x80):
            return val, pos
        shift += 7
        if shift >= 64:
            break
    return 0, start

def is_readable_string(data: bytes) -> bool:
    try:
        s = data.decode('utf-8')
        if not s:
            return False
        for c in s:
            o = ord(c)
            if (o < 32 and c not in '\n\r\t') or o == 127 or (128 <= o <= 159):
                return False
        return True
    except Exception:
        return False

def is_valid_protobuf(data: bytes) -> bool:
    if not data:
        return False
    pos = 0
    length = len(data)
    fields_found = 0
    while pos < length:
        tag, new_pos = read_varint(data, pos)
        if new_pos == pos or tag == 0:
            return False
        pos = new_pos
        field_number = tag >> 3
        wire_type = tag & 0x07
        
        if field_number == 0 or field_number > 20000:
            return False
        
        if wire_type == 0:
            val, new_pos = read_varint(data, pos)
            if new_pos == pos:
                return False
            pos = new_pos
        elif wire_type == 1:
            if pos + 8 > length:
                return False
            pos += 8
        elif wire_type == 2:
            val_len, new_pos = read_varint(data, pos)
            if new_pos == pos or pos + val_len > length:
                return False
            pos = new_pos + val_len
        elif wire_type == 5:
            if pos + 4 > length:
                return False
            pos += 4
        else:
            return False
        fields_found += 1
    return pos == length and fields_found > 0

def parse_proto(data: bytes) -> List[Tuple[int, Any]]:
    fields = []
    pos = 0
    length = len(data)
    while pos < length:
        tag, new_pos = read_varint(data, pos)
        if new_pos == pos:
            break
        pos = new_pos
        field_number = tag >> 3
        wire_type = tag & 0x07
        
        if wire_type == 0:
            val, pos = read_varint(data, pos)
            fields.append((field_number, val))
        elif wire_type == 1:
            if pos + 8 <= length:
                val = struct.unpack("<Q", data[pos:pos+8])[0]
                pos += 8
                fields.append((field_number, val))
            else:
                break
        elif wire_type == 2:
            val_len, pos = read_varint(data, pos)
            if pos + val_len <= length:
                val_data = data[pos:pos+val_len]
                pos += val_len
                
                is_str = is_readable_string(val_data)
                    
                if is_str:
                    fields.append((field_number, val_data.decode('utf-8')))
                elif is_valid_protobuf(val_data):
                    fields.append((field_number, parse_proto(val_data)))
                else:
                    fields.append((field_number, val_data))
            else:
                break
        elif wire_type == 5:
            if pos + 4 <= length:
                val = struct.unpack("<I", data[pos:pos+4])[0]
                pos += 4
                fields.append((field_number, val))
            else:
                break
        else:
            break
    return fields

def get_field(fields: List[Tuple[int, Any]], num: int) -> Any:
    for f, v in fields:
        if f == num:
            return v
    return None

def get_fields(fields: List[Tuple[int, Any]], num: int) -> List[Any]:
    return [v for f, v in fields if f == num]

def format_timestamp(step_fields: List[Tuple[int, Any]]) -> str:
    field5 = get_field(step_fields, 5)
    if not isinstance(field5, list):
        return "Unknown Time"
    field1 = get_field(field5, 1)
    if not isinstance(field1, list):
        return "Unknown Time"
    seconds = get_field(field1, 1)
    if seconds is None:
        return "Unknown Time"
    try:
        dt = datetime.fromtimestamp(seconds)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return "Unknown Time"

def trajectory_to_dict(decompressed_data: bytes, session_id: str | None = None) -> Dict[str, Any]:
    parsed = parse_proto(decompressed_data)
    trajectory_id = get_field(parsed, 1)
    steps = get_fields(parsed, 2)
    
    steps_list = []
    for i, step in enumerate(steps):
        step_type_val = get_field(step, 1)
        time_str = format_timestamp(step)
        
        step_dict: Dict[str, Any] = {
            "step_index": i + 1,
            "timestamp": time_str,
        }
        
        if step_type_val == 14:
            step_dict["type"] = "user_input"
            input_msg = get_field(step, 19)
            if isinstance(input_msg, list):
                prompt = get_field(input_msg, 2) or get_field(input_msg, 3)
                if isinstance(prompt, list):
                    prompt = get_field(prompt, 1)
                step_dict["content"] = prompt if isinstance(prompt, str) else ""
            else:
                step_dict["content"] = ""
                
        elif step_type_val == 15:
            step_dict["type"] = "model_output"
            output_msg = get_field(step, 20)
            if isinstance(output_msg, list):
                thought = get_field(output_msg, 3)
                if thought:
                    step_dict["thought"] = thought.strip()
                
                content = get_field(output_msg, 8) or get_field(output_msg, 1)
                if isinstance(content, str):
                    step_dict["content"] = content.strip()
                
                tool_calls = get_fields(output_msg, 7)
                tcs_list = []
                for tc in tool_calls:
                    if isinstance(tc, list):
                        name = get_field(tc, 2)
                        args = get_field(tc, 3)
                        tc_dict = {"name": name}
                        if args:
                            try:
                                tc_dict["arguments"] = json.loads(args)
                            except Exception:
                                tc_dict["arguments"] = args
                        tcs_list.append(tc_dict)
                if tcs_list:
                    step_dict["tool_calls"] = tcs_list
                    
        elif step_type_val == 17:
            step_dict["type"] = "error"
            error_msg = get_field(step, 24)
            if isinstance(error_msg, list):
                f3 = get_field(error_msg, 3)
                if isinstance(f3, list):
                    err_txt = get_field(f3, 2) or get_field(f3, 9) or get_field(f3, 1)
                    if isinstance(err_txt, str):
                        step_dict["error"] = err_txt
                else:
                    err_txt = get_field(error_msg, 9) or get_field(error_msg, 1)
                    if isinstance(err_txt, str):
                        step_dict["error"] = err_txt
        elif step_type_val == 2:
            step_dict["type"] = "complete"
            complete_msg = get_field(step, 12)
            if isinstance(complete_msg, list):
                outcome_json = get_field(complete_msg, 2)
                if outcome_json:
                    try:
                        step_dict["outcome"] = json.loads(outcome_json)
                    except Exception:
                        step_dict["outcome"] = outcome_json
                    
        elif step_type_val == 103:
            step_dict["type"] = "tool_response"
            tool_resp_msg = get_field(step, 116)
            if isinstance(tool_resp_msg, list):
                name = get_field(tool_resp_msg, 2)
                field4 = get_field(tool_resp_msg, 4)
                resp_json = None
                if isinstance(field4, list):
                    field2 = get_field(field4, 2)
                    if isinstance(field2, list):
                        resp_json = get_field(field2, 2)
                
                step_dict["tool_name"] = name
                if resp_json:
                    try:
                        step_dict["response"] = json.loads(resp_json)
                    except Exception:
                        step_dict["response"] = resp_json
            else:
                step_dict["tool_name"] = "unknown"
        else:
            step_dict["type"] = f"unknown_{step_type_val}"
            
        steps_list.append(step_dict)
        
    result = {
        "trajectory_id": trajectory_id if isinstance(trajectory_id, str) else str(trajectory_id),
        "steps": steps_list,
    }
    if session_id:
        result["session_id"] = session_id
    return result

def convert_trajectory_to_json(filepath: Path, destpath: Path) -> bool:
    try:
        compressed_data = filepath.read_bytes()
        dctx = zstd.ZstdDecompressor()
        decompressed_data = dctx.decompress(compressed_data)
        
        session_id = None
        if filepath.parent.name == "antigravity_state" and filepath.parent.parent.parent.name == "sessions":
            session_id = filepath.parent.parent.name
            
        traj_dict = trajectory_to_dict(decompressed_data, session_id=session_id)
        
        destpath.write_text(json.dumps(traj_dict, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        logger.error("Failed to convert trajectory file %s to JSON: %s", filepath, e, exc_info=True)
        return False

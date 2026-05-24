# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import json
import zstandard as zstd
from pathlib import Path
from bees.trajectory_parser import convert_trajectory_to_json, trajectory_to_dict

def test_trajectory_parsing(tmp_path: Path):
    # Construct a simple mock trajectory protobuf byte stream.
    # Outer Message:
    #   Field 1 (trajectory_id): "mock_traj" (tag 1, wire type 2)
    #   Field 2 (Step, repeated):
    #     Step 1:
    #       Field 1 (type): 14 (User Input, tag 1, wire type 0)
    #       Field 19 (User message, tag 19, wire type 2) -> contains Field 2 (prompt): "Objective text" (tag 2, wire type 2)
    #     Step 2:
    #       Field 1 (type): 15 (Model Output, tag 1, wire type 0)
    #       Field 20 (Model response, tag 20, wire type 2) -> contains Field 3 (thought): "Thinking..." (tag 3, wire type 2)
    
    # 1. Build Step 1 (User Input)
    # Field 2 (prompt) of Field 19: "Objective text" (tag 2, wire type 2 -> 0x12, length 14 -> 0x0e)
    prompt_payload = b"\x12\x0eObjective text"
    # Field 19: tag 19, wire type 2 -> (19 << 3) | 2 = 154 -> 0x9a 0x01, length 16 -> 0x10
    step1_field19 = b"\x9a\x01\x10" + prompt_payload
    # Step 1 outer: Field 1 = 14 (tag 1, wire type 0 -> 0x08, value 14 -> 0x0e) + Field 19
    step1_payload = b"\x08\x0e" + step1_field19
    # Step 1 wrapped: tag 2, wire type 2 -> 0x12, length 21 -> 0x15
    step1_wrapped = b"\x12\x15" + step1_payload

    # 2. Build Step 2 (Model Output)
    # Field 3 (thought) of Field 20: "Thinking..." (tag 3, wire type 2 -> 0x1a, length 11 -> 0x0b)
    thought_payload = b"\x1a\x0bThinking..."
    # Field 20: tag 20, wire type 2 -> (20 << 3) | 2 = 162 -> 0xa2 0x01, length 13 -> 0x0d
    step2_field20 = b"\xa2\x01\x0d" + thought_payload
    # Step 2 outer: Field 1 = 15 (tag 1, wire type 0 -> 0x08, value 15 -> 0x0f) + Field 20
    step2_payload = b"\x08\x0f" + step2_field20
    # Step 2 wrapped: tag 2, wire type 2 -> 0x12, length 18 -> 0x12
    step2_wrapped = b"\x12\x12" + step2_payload

    # 3. Build Outer Trajectory Message
    # Field 1 (trajectory_id): "mock_traj" (tag 1, wire type 2 -> 0x0a, length 9 -> 0x09)
    traj_id_payload = b"\x0a\x09mock_traj"
    
    # Combine everything
    outer_protobuf = traj_id_payload + step1_wrapped + step2_wrapped
    
    # Compress using zstd
    cctx = zstd.ZstdCompressor()
    compressed = cctx.compress(outer_protobuf)
    
    # Write to a temporary file
    traj_file = tmp_path / "traj-mock"
    traj_file.write_bytes(compressed)
    
    # Convert to JSON
    dest_json = tmp_path / "antigravity_traj.json"
    success = convert_trajectory_to_json(traj_file, dest_json)
    
    assert success is True
    assert dest_json.is_file()
    
    # Verify the JSON contents
    data = json.loads(dest_json.read_text(encoding="utf-8"))
    assert data["trajectory_id"] == "mock_traj"
    assert len(data["steps"]) == 2
    
    step1 = data["steps"][0]
    assert step1["step_index"] == 1
    assert step1["type"] == "user_input"
    assert step1["content"] == "Objective text"
    
    step2 = data["steps"][1]
    assert step2["step_index"] == 2
    assert step2["type"] == "model_output"
    assert step2["thought"] == "Thinking..."

def test_enhanced_trajectory_parsing(tmp_path: Path):
    # 1. Build Step 1 (User Input with non-ASCII weather string)
    prompt_payload = b"\x12\x13Temperature: 60 \xc2\xb0F"
    step1_field19 = b"\x9a\x01\x15" + prompt_payload
    step1_payload = b"\x08\x0e" + step1_field19
    step1_wrapped = b"\x12\x1a" + step1_payload

    # 2. Build Step 2 (Model Output with Field 8 '[ack]')
    ack_payload = b"\x42\x05[ack]"
    step2_field20 = b"\xa2\x01\x07" + ack_payload
    step2_payload = b"\x08\x0f" + step2_field20
    step2_wrapped = b"\x12\x0c" + step2_payload

    # 3. Build Step 3 (Error step type 17)
    err_text_payload = b"\x12\x07timeout"
    step3_field3 = b"\x1a\x09" + err_text_payload
    step3_field24 = b"\xc2\x01\x0b" + step3_field3
    step3_payload = b"\x08\x11" + step3_field24
    step3_wrapped = b"\x12\x10" + step3_payload

    # 4. Build Step 4 (Complete step type 2)
    outcome_payload = b'{"objective_outcome":"success"}'
    step4_field12 = b"\x62\x21\x12\x1f" + outcome_payload
    step4_payload = b"\x08\x02" + step4_field12
    step4_wrapped = b"\x12\x25" + step4_payload

    # Outer message
    traj_id_payload = b"\x0a\x0dmock_enhanced"
    outer_protobuf = traj_id_payload + step1_wrapped + step2_wrapped + step3_wrapped + step4_wrapped

    cctx = zstd.ZstdCompressor()
    compressed = cctx.compress(outer_protobuf)

    traj_file = tmp_path / "traj-mock-enhanced"
    traj_file.write_bytes(compressed)

    dest_json = tmp_path / "antigravity_traj.json"
    success = convert_trajectory_to_json(traj_file, dest_json)

    assert success is True
    assert dest_json.is_file()

    data = json.loads(dest_json.read_text(encoding="utf-8"))
    assert data["trajectory_id"] == "mock_enhanced"
    assert len(data["steps"]) == 4

    s1 = data["steps"][0]
    assert s1["step_index"] == 1
    assert s1["type"] == "user_input"
    assert s1["content"] == "Temperature: 60 °F"

    s2 = data["steps"][1]
    assert s2["step_index"] == 2
    assert s2["type"] == "model_output"
    assert s2["content"] == "[ack]"

    s3 = data["steps"][2]
    assert s3["step_index"] == 3
    assert s3["type"] == "error"
    assert s3["error"] == "timeout"

    s4 = data["steps"][3]
    assert s4["step_index"] == 4
    assert s4["type"] == "complete"
    assert s4["outcome"] == {"objective_outcome": "success"}


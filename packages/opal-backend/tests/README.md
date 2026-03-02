# Tests

pytest test suite for `opal-backend`. 20 test files, 300+ tests.

## Running Tests

```bash
# All tests (via wireit)
npm run test -w packages/opal-backend

# All tests (direct)
.venv/bin/python -m pytest tests/ -v

# Single file
.venv/bin/python -m pytest tests/test_loop.py -v

# Single test
.venv/bin/python -m pytest tests/test_loop.py::test_loop_basic_flow -v

# Type checking
npm run typecheck -w packages/opal-backend
```

## Test Configuration

- **Framework**: pytest + pytest-asyncio
- **Async mode**: `auto` (all async tests run automatically, no decorator
  needed)
- **Config**: `pyproject.toml` → `[tool.pytest.ini_options]`

## Mock Patterns

Tests inject mock implementations of the three transport protocols. Here are the
minimal shapes:

### `HttpClient`

```python
class MockHttpClient:
    access_token = "test-token"

    @contextlib.asynccontextmanager
    async def stream_post(self, url, *, json, headers):
        yield MockStreamResponse(lines=["data: {...}"])
```

### `BackendClient`

```python
class MockBackendClient:
    async def execute_step(self, body):
        return {"output": {"chunks": [{"mimetype": "image/png", "data": "..."}]}}

    async def upload_gemini_file(self, request):
        return {"fileUrl": "files/abc123", "mimeType": "image/png"}

    async def upload_blob_file(self, drive_file_id):
        return "/board/blobs/uuid-here"
```

### `InteractionStore`

Use `InMemoryInteractionStore` from `opal_backend.local.interaction_store_impl`
directly in tests — it's already suitable for testing.

## Common Test Pattern

Function group tests typically:

1. Create mock `HttpClient` / `BackendClient` with canned responses
2. Create `AgentFileSystem` and `TaskTreeManager`
3. Build the function group via its factory
4. Call the handler directly with test args
5. Assert the returned dict matches expectations

```python
async def test_generate_text_basic():
    client = MockHttpClient(responses=[mock_gemini_response("Hello!")])
    backend = MockBackendClient()
    fs = AgentFileSystem()

    group = get_generate_function_group(
        file_system=fs, client=client, backend=backend
    )

    handler = dict(group.definitions)["generate_text"].handler
    result = await handler({"prompt": "Say hi"}, lambda s: None)

    assert "Hello!" in result["text"]
```

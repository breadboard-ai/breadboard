# JSandbox

WebAssembly-based JavaScript sandbox using QuickJS.

## Building

Install CMAKE:

```bash
brew install cmake
```

Install Rust toolchain:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Add `wasm32-wasi` target

```bash
rustup target add wasm32-wasi
```

```bash
cargo run -p buildscript -- -r
```

## Running the demo

```bash
npx http-server -c-1
```

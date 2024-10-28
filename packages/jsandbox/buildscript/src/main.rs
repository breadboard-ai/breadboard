/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
use std::{
    fmt::Display,
    path::{Path, PathBuf},
};

use anyhow::{anyhow, Context, Result};

use clap::Parser;
use tokio::{io::AsyncReadExt, process::Command};

#[derive(Parser, Debug, Clone)]
#[command(version)]
struct CliArgs {
    /// Build release build
    #[arg(short, long, default_value_t = false)]
    release: bool,
    #[arg(short, long, default_value = "./build/")]
    output: PathBuf,

    #[arg(long, default_value_t = false)]
    asyncify: bool,

    #[arg(long, default_value_t = false)]
    skip_brotli: bool,

    #[arg(long)]
    workspace_root: Option<PathBuf>,

    #[arg(skip)]
    cargo_manifest: Option<cargo_toml::Manifest>,
}

impl CliArgs {
    fn workspace(&self) -> Result<PathBuf> {
        if let Some(root) = self.workspace_root.as_ref() {
            return Ok(root.clone());
        }
        Ok(std::env::current_dir()?)
    }

    fn cargo_toml_path(&self) -> Result<PathBuf> {
        Ok(self.workspace()?.join("Cargo.toml"))
    }

    fn target_path(&self) -> Result<PathBuf> {
        Ok(self.workspace()?.join("target"))
    }

    fn read_metadata(&mut self) -> Result<()> {
        let manifest = cargo_toml::Manifest::from_path(self.cargo_toml_path()?)?;
        self.cargo_manifest = Some(manifest);
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut args = CliArgs::parse();
    args.read_metadata()?;
    build_jsandbox(&args).await.context("jsandbox")?;

    Ok(())
}

async fn build_jsandbox(args: &CliArgs) -> Result<()> {
    build_crate(args, "jsandbox")
        .await
        .context("Building crate")?;

    run_bindgen(args, "jsandbox.wasm")
        .await
        .context("Running bindgen")?;
    tokio::try_join!(
        async {
            fix_bindgen_js(args, "jsandbox_bg.js")
                .await
                .context("Fixing bindgen JS")
        },
        async {
            run_wasm_opt(
                args,
                args.target_path()?
                    .join("wasm-bindgen")
                    .join("jsandbox_bg.wasm"),
            )
            .await
            .context("Processing bindgen wasm")
        }
    )?;
    Ok(())
}

async fn build_crate(args: &CliArgs, name: impl AsRef<str>) -> Result<(), anyhow::Error> {
    let mut build_args: Vec<_> = vec!["build", "--target", "wasm32-wasi", "-p", name.as_ref()];
    if args.release {
        build_args.push("--release");
    }
    let mut build_command = Command::new("cargo").args(build_args).spawn()?;
    build_command.wait().await?;
    Ok(())
}

async fn run_bindgen(args: &CliArgs, name: impl AsRef<str>) -> Result<()> {
    let build_mode = if args.release { "release" } else { "debug" };
    let input_path = PathBuf::from("./target/wasm32-wasi/")
        .join(build_mode)
        .join(name.as_ref());
    let mut bindgen = wasm_bindgen_cli_support::Bindgen::new();
    bindgen
        .input_path(input_path)
        .keep_debug(args.release)
        .bundler(true)?
        .emit_start(true)
        .reference_types(true)
        .omit_default_module_path(false);
    let output = args.target_path()?.join("wasm-bindgen");
    tokio::fs::create_dir_all(&output).await?;
    bindgen.generate(&output)?;
    Ok(())
}

// FIXME: Brittle AF
async fn fix_bindgen_js(args: &CliArgs, name: impl AsRef<str>) -> Result<()> {
    let file_path = args.target_path()?.join("wasm-bindgen").join(name.as_ref());

    let raw_src = tokio::fs::read_to_string(&file_path)
        .await
        .context("Reading bindgen js")?;
    let lines: Vec<_> = raw_src.lines().collect();
    let methods = collect_exported_names(&lines)?;
    let mut lines: Vec<_> = lines
        .into_iter()
        .map(|line| line.trim().trim_start_matches("export"))
        .collect();

    let insert_position = lines
        .iter()
        .position(|line| !line.trim().starts_with("import"))
        .unwrap_or(0);

    lines.insert(
        insert_position,
        r#"
        export const RAW_WASM = Symbol();
        export default function() {"#,
    );
    lines.push(r#"return { [RAW_WASM]: wasm, "#);
    for method in methods {
        lines.push(method);
        lines.push(",");
    }
    lines.push(r#"};}"#);

    let new_src = lines.join("\n");
    tokio::fs::write(&file_path, new_src)
        .await
        .context("Writing new bindgen js")?;
    Ok(())
}

fn collect_exported_names<'a>(lines: &[&'a str]) -> Result<Vec<&'a str>> {
    let export_lines: Vec<_> = lines
        .iter()
        .filter(|line| line.trim().starts_with("export"))
        .collect();

    Result::from_iter(export_lines.into_iter().map(|line| {
        if line.trim().starts_with("export async function")
            || line.trim().starts_with("export function")
        {
            return Ok(line
                .split_whitespace()
                .find(|l| l.contains('('))
                .ok_or(anyhow!(
                    "Function export without parenthesis in the same line"
                ))?
                .split_once('(')
                .expect("parenthesis is guaranteed")
                .0);
        }
        if line.contains("const") {
            return Ok(line
                .split_once('=')
                .ok_or(anyhow!("Exported const without assignment operator"))?
                .0
                .trim()
                .split(' ')
                .last()
                .expect("Valid js must have identifier before assignment")
                .trim());
        }
        anyhow::bail!("Unsupported export line: {}", line)
    }))
}

async fn run_wasm_opt(args: &CliArgs, path: impl AsRef<Path>) -> Result<()> {
    let mut buffer: Vec<u8> = vec![];
    tokio::fs::File::open(path.as_ref())
        .await
        .context("Open Wasm")?
        .read_to_end(&mut buffer)
        .await
        .context("Read wasm")?;
    println!("unoptimizied: {}", FileSize(buffer.len()));
    let buffer = wasm_opt(buffer, args)?;
    println!("optimizied: {}", FileSize(buffer.len()));
    println!("brotlid: {}", FileSize(brotli_compress(&buffer)?));
    tokio::fs::write(path.as_ref(), &buffer)
        .await
        .context("Write wasm")?;
    Ok(())
}

fn wasm_opt(mut content: Vec<u8>, args: &CliArgs) -> Result<Vec<u8>> {
    use binaryen::binaryen_sys;

    let mut module = unsafe {
        let m = binaryen_sys::BinaryenModuleReadWithFeatures(
            content.as_mut_ptr() as *mut i8,
            content.len(),
            binaryen_sys::BinaryenFeatureMVP() | binaryen_sys::BinaryenFeatureReferenceTypes(),
        );
        binaryen::Module::from_raw(m)
    };
    let mut optimization_level = if args.release { 3 } else { 0 };
    let mut passes = vec![];
    if args.asyncify {
        passes.push("asyncify");
        // Asyncify really needs -O1
        optimization_level = optimization_level.max(1);
    }
    if args.release {
        passes.push("strip-debug");
    }
    let config = binaryen::CodegenConfig {
        shrink_level: 0,
        optimization_level,
        debug_info: !args.release,
    };
    module
        .run_optimization_passes(passes, &config)
        .map_err(|_| anyhow!("Binaryen optimization failed"))?;
    let binary_module = module.write();
    Ok(binary_module)
}

struct FileSize(usize);

impl Display for FileSize {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.0 > 1024 * 1024 {
            write!(f, "{:3.2}MB", self.0 as f64 / (1024.0 * 1024.0))
        } else if self.0 > 1024 {
            write!(f, "{:3.2}KB", self.0 as f64 / 1024.0)
        } else {
            write!(f, "{:3.2}B", self.0)
        }
    }
}

fn brotli_compress(data: impl AsRef<[u8]>) -> Result<usize> {
    use brotli::enc::{backward_references::BrotliEncoderParams, BrotliCompress};
    let mut data = std::io::Cursor::new(data.as_ref());
    let mut buf: Vec<u8> = Vec::with_capacity(data.get_ref().len());

    BrotliCompress(
        &mut data,
        &mut buf,
        &BrotliEncoderParams {
            quality: 9,
            ..Default::default()
        },
    )?;
    Ok(buf.len())
}

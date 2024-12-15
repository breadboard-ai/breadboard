use std::future::Future;

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
use rquickjs::{module::ModuleDef, prelude::Async, Ctx, Function, Result, Value};
use wasm_bindgen::prelude::*;

pub struct CapabilitiesModule;

impl ModuleDef for CapabilitiesModule {
    fn declare(decl: &rquickjs::module::Declarations) -> Result<()> {
        decl.declare("fetch")?;
        decl.declare("secrets")?;
        decl.declare("invoke")?;
        decl.declare("output")?;
        decl.declare("describe")?;
        Ok(())
    }

    fn evaluate<'js>(ctx: &Ctx<'js>, exports: &rquickjs::module::Exports<'js>) -> Result<()> {
        let ctx = ctx.clone();
        exports.export(
            "fetch",
            Function::new(ctx.clone(), Async(fetch_value))?.with_name("fetch")?,
        )?;
        exports.export(
            "secrets",
            Function::new(ctx.clone(), Async(secrets_value))?.with_name("secrets")?,
        )?;
        exports.export(
            "invoke",
            Function::new(ctx.clone(), Async(invoke_value))?.with_name("invoke")?,
        )?;
        exports.export(
            "output",
            Function::new(ctx.clone(), Async(output_value))?.with_name("output")?,
        )?;
        exports.export(
            "describe",
            Function::new(ctx.clone(), Async(describe_value))?.with_name("describe")?,
        )?;
        Ok(())
    }
}

async fn call_capability<'js, F, Fut>(
    invocation_id: String,
    inputs: Value<'js>,
    capability: F,
) -> rquickjs::Result<Value<'js>>
where
    F: FnOnce(String, String) -> Fut,
    Fut: Future<Output = JsValue>,
{
    let ctx: Ctx<'js> = inputs.ctx().clone();
    let input_str = ctx.json_stringify(inputs)?.unwrap();
    let result_str = capability(invocation_id, input_str.to_string()?)
        .await
        .as_string()
        .unwrap_or_default();
    while ctx.execute_pending_job() {}

    ctx.json_parse(result_str)
}

async fn fetch_value<'js>(
    invocation_id: String,
    inputs: Value<'js>,
) -> rquickjs::Result<Value<'js>> {
    call_capability(invocation_id, inputs, fetch).await
}

async fn secrets_value<'js>(
    invocation_id: String,
    inputs: Value<'js>,
) -> rquickjs::Result<Value<'js>> {
    call_capability(invocation_id, inputs, secrets).await
}

async fn invoke_value<'js>(
    invocation_id: String,
    inputs: Value<'js>,
) -> rquickjs::Result<Value<'js>> {
    call_capability(invocation_id, inputs, invoke).await
}

async fn output_value<'js>(
    invocation_id: String,
    inputs: Value<'js>,
) -> rquickjs::Result<Value<'js>> {
    call_capability(invocation_id, inputs, output).await
}

async fn describe_value<'js>(
    invocation_id: String,
    inputs: Value<'js>,
) -> rquickjs::Result<Value<'js>> {
    call_capability(invocation_id, inputs, describe).await
}

#[wasm_bindgen(raw_module = "./capabilities.js")]
extern "C" {
    async fn fetch(invocation_id: String, inputs: String) -> JsValue;
    async fn secrets(invocation_id: String, inputs: String) -> JsValue;
    async fn invoke(invocation_id: String, inputs: String) -> JsValue;
    async fn output(invocation_id: String, inputs: String) -> JsValue;
    async fn describe(invocation_id: String, inputs: String) -> JsValue;
}

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
        decl.declare("input")?;
        decl.declare("output")?;
        decl.declare("describe")?;
        decl.declare("query")?;
        decl.declare("read")?;
        decl.declare("write")?;
        decl.declare("blob")?;

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
            "input",
            Function::new(ctx.clone(), Async(input_value))?.with_name("input")?,
        )?;
        exports.export(
            "output",
            Function::new(ctx.clone(), Async(output_value))?.with_name("output")?,
        )?;
        exports.export(
            "describe",
            Function::new(ctx.clone(), Async(describe_value))?.with_name("describe")?,
        )?;
        exports.export(
            "query",
            Function::new(ctx.clone(), Async(query_value))?.with_name("query")?,
        )?;
        exports.export(
            "read",
            Function::new(ctx.clone(), Async(read_value))?.with_name("read")?,
        )?;
        exports.export(
            "write",
            Function::new(ctx.clone(), Async(write_value))?.with_name("write")?,
        )?;
        exports.export(
            "blob",
            Function::new(ctx.clone(), Async(blob_value))?.with_name("blob")?,
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

macro_rules! create_value_function {
    ($func_name:ident, $capability:ident) => {
        async fn $func_name<'js>(
            invocation_id: String,
            inputs: Value<'js>,
        ) -> rquickjs::Result<Value<'js>> {
            call_capability(invocation_id, inputs, $capability).await
        }
    };
}

create_value_function!(fetch_value, fetch);
create_value_function!(secrets_value, secrets);
create_value_function!(invoke_value, invoke);
create_value_function!(input_value, input);
create_value_function!(output_value, output);
create_value_function!(describe_value, describe);
create_value_function!(query_value, query);
create_value_function!(read_value, read);
create_value_function!(write_value, write);
create_value_function!(blob_value, blob);

#[wasm_bindgen(raw_module = "./capabilities.js")]
extern "C" {
    async fn fetch(invocation_id: String, inputs: String) -> JsValue;
    async fn secrets(invocation_id: String, inputs: String) -> JsValue;
    async fn invoke(invocation_id: String, inputs: String) -> JsValue;
    async fn input(invocation_id: String, inputs: String) -> JsValue;
    async fn output(invocation_id: String, inputs: String) -> JsValue;
    async fn describe(invocation_id: String, inputs: String) -> JsValue;
    async fn query(invocation_id: String, inputs: String) -> JsValue;
    async fn read(invocation_id: String, inputs: String) -> JsValue;
    async fn write(invocation_id: String, inputs: String) -> JsValue;
    async fn blob(invocation_id: String, inputs: String) -> JsValue;
}

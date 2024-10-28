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
        Ok(())
    }

    fn evaluate<'js>(ctx: &Ctx<'js>, exports: &rquickjs::module::Exports<'js>) -> Result<()> {
        let ctx = ctx.clone();
        exports.export(
            "fetch",
            Function::new(ctx.clone(), Async(fetch_value))?.with_name("fetch")?,
        )?;
        Ok(())
    }
}

async fn call_capability<'js, F, Fut>(
    inputs: Value<'js>,
    capability: F,
) -> rquickjs::Result<Value<'js>>
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = JsValue>,
{
    let ctx: Ctx<'js> = inputs.ctx().clone();
    let input_str = ctx.json_stringify(inputs)?.unwrap();
    let result_str = capability(input_str.to_string()?)
        .await
        .as_string()
        .unwrap_or_default();
    ctx.json_parse(result_str)
}

async fn fetch_value<'js>(inputs: Value<'js>) -> rquickjs::Result<Value<'js>> {
    call_capability(inputs, fetch).await
}

#[wasm_bindgen(raw_module = "./capabilities.js")]
extern "C" {
    async fn fetch(inputs: String) -> JsValue;
}

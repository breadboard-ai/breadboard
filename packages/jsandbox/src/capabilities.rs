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
            Function::new(ctx.clone(), Async(fetch_wrapped))?.with_name("fetch")?,
        )?;
        Ok(())
    }
}

async fn fetch_wrapped<'js>(inputs: Value<'js>) -> rquickjs::Value<'js> {
    // let ctx = inputs.ctx().clone();
    fetch_result(inputs).await.unwrap()
}

async fn fetch_result<'js>(inputs: Value<'js>) -> rquickjs::Result<Value<'js>> {
    let ctx: Ctx<'js> = inputs.ctx().clone();
    // let Some(input_str) = ctx.json_stringify(inputs)? else {
    //     return Err(rquickjs::Error::new_loading("test"));
    // };
    let input_str = ctx.json_stringify(inputs).unwrap().unwrap();
    let result_str = fetch(input_str.to_string()?)
        .await
        .as_string()
        .unwrap_or_default();
    ctx.json_parse(result_str)
}

#[wasm_bindgen(raw_module = "./capabilities.js")]
extern "C" {
    async fn fetch(inputs: String) -> JsValue;
}

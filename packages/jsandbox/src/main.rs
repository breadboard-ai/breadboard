/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
use rquickjs::{function::Args, prelude::IntoArg, CatchResultExt, Object};
use thiserror::Error;
use wasm_bindgen::prelude::*;

#[derive(Debug, Error)]
enum Error {
    #[error("Value could not be stringified to JSON")]
    NotStringifiable,
    #[error("A QuickJS error occured: {0}")]
    QuickJS(#[from] rquickjs::Error),
}

type Result<T> = std::result::Result<T, Error>;

#[wasm_bindgen]
pub fn eval_code(code: String) -> std::result::Result<String, JsError> {
    let rt = rquickjs::Runtime::new()?;
    let ctx = rquickjs::Context::full(&rt)?;
    let result: Result<String> = ctx.with(|ctx| {
        let result_obj: rquickjs::Value = ctx.eval(code.as_str())?;
        let Some(result_str) = ctx.json_stringify(result_obj)? else {
            return Err(Error::NotStringifiable);
        };
        Ok(result_str.to_string()?)
    });
    Ok(result?)
}

#[wasm_bindgen]
pub fn run_module(code: String, json: String) -> std::result::Result<String, JsError> {
    let rt = rquickjs::Runtime::new()?;
    let ctx = rquickjs::Context::full(&rt)?;
    let result: Result<String> = ctx.with(|ctx| {
        let name = "m";
        let (module, _) = rquickjs::Module::declare(ctx.clone(), name, code)
            .catch(&ctx)
            .unwrap()
            .eval()
            .catch(&ctx)
            .unwrap();
        while ctx.execute_pending_job() {}
        let default = module
            .namespace()
            .unwrap()
            .get::<_, rquickjs::Function>("default")
            .unwrap();
        let inputs = ctx.json_parse(json)?;
        let result_obj: rquickjs::Value = default.call((inputs,)).catch(&ctx).unwrap();
        let Some(result_str) = ctx.json_stringify(result_obj)? else {
            return Err(Error::NotStringifiable);
        };
        Ok(result_str.to_string()?)
    });
    Ok(result?)
}

#[wasm_bindgen(main)]
pub fn main() {}

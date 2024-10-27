/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
use rquickjs::{CatchResultExt, Object};
use thiserror::Error;
use wasm_bindgen::prelude::*;

#[derive(Debug, Error)]
enum Error {
    #[error("Value could not be stringified to JSON")]
    NotStringifiable,
    #[error("No Value when trying to convert from promise")]
    NoValue,
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

fn maybe_promise(result_obj: rquickjs::Value) -> Result<rquickjs::Value> {
    let resolved_obj: rquickjs::Value = if result_obj.is_promise() {
        let Some(promise) = result_obj.as_promise() else {
            return Err(Error::NoValue);
        };
        let result = promise.finish::<rquickjs::Value>()?;
        result
    } else {
        result_obj.clone()
    };
    Ok(resolved_obj)
}

#[wasm_bindgen]
pub fn run_module(code: String, json: String) -> std::result::Result<String, JsError> {
    let rt = rquickjs::Runtime::new()?;
    let ctx = rquickjs::Context::full(&rt)?;
    let result: Result<String> = ctx.with(|ctx| {
        // Construct the Console object.
        let global = ctx.globals();
        let console = Object::new(ctx.clone())?;
        let _ = console.set("log", rquickjs::Function::new(ctx.clone(), log)?);
        let _ = global.set("console", console);
        // Load the module.
        let (module, _) = rquickjs::Module::declare(ctx.clone(), "m", code)
            .catch(&ctx)
            .unwrap()
            .eval()
            .catch(&ctx)
            .unwrap();
        while ctx.execute_pending_job() {}
        // Get the default export.
        let default = module
            .namespace()
            .unwrap()
            .get::<_, rquickjs::Function>("default")
            .unwrap();
        let inputs = ctx.json_parse(json)?;
        // Call it and return value.
        let result_obj: rquickjs::Value =
            maybe_promise(default.call((inputs,)).catch(&ctx).unwrap())?;
        let Some(result_str) = ctx.json_stringify(result_obj)? else {
            return Err(Error::NotStringifiable);
        };
        Ok(result_str.to_string()?)
    });
    Ok(result?)
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(message: String);
}

#[wasm_bindgen(main)]
pub fn main() {}

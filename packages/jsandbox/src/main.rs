/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
use rquickjs::{
    loader::{BuiltinResolver, ModuleLoader},
    CatchResultExt,
};
use thiserror::Error;
use wasm_bindgen::prelude::*;

mod capabilities;
mod plugins;

use capabilities::CapabilitiesModule;

#[derive(Debug, Error)]
enum Error {
    #[error("Value could not be stringified to JSON")]
    NotStringifiable,

    #[error("No Value when trying to convert from promise")]
    NoValue,

    #[error("A QuickJS error occured: {0}")]
    QuickJS(#[from] rquickjs::Error),

    #[error("Error loading module: {0}")]
    Loading(String),

    #[error("Error evaluating module: {0}")]
    Evaluating(String),

    #[error("Error getting default export: {0}")]
    GettingDefaultExport(String),

    #[error("Error getting `default` function: {0}")]
    GettintDefaultFunction(String),

    #[error("Error parsing input values: {0}")]
    ParsingInputValues(String),

    #[error("Error calling module function: {0}")]
    CallingModuleFunction(String),
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
    let resolver = BuiltinResolver::default().with_module("breadboard:capabilities");
    let loader = ModuleLoader::default().with_module("breadboard:capabilities", CapabilitiesModule);

    let rt = rquickjs::Runtime::new()?;
    let ctx = rquickjs::Context::full(&rt)?;

    ctx.with(|ctx| plugins::console::init(&ctx))?;

    rt.set_loader(resolver, loader);

    let result: Result<String> = ctx.with(|ctx| {
        // Load the module.
        let module = rquickjs::Module::declare(ctx.clone(), "m", code)
            .catch(&ctx)
            .map_err(|e| Error::Loading(e.to_string()))?;

        // Evaluate module.
        let (evaluated, _) = module
            .eval()
            .catch(&ctx)
            .map_err(|e| Error::Evaluating(e.to_string()))?;
        while ctx.execute_pending_job() {}

        // Get the default export.
        let namespace = evaluated
            .namespace()
            .catch(&ctx)
            .map_err(|e| Error::GettingDefaultExport(e.to_string()))?;

        let default = namespace
            .get::<_, rquickjs::Function>("default")
            .catch(&ctx)
            .map_err(|e| Error::GettintDefaultFunction(e.to_string()))?;

        let inputs = ctx
            .json_parse(json)
            .catch(&ctx)
            .map_err(|e| Error::ParsingInputValues(e.to_string()))?;

        // Call it and return value.
        let result_obj: rquickjs::Value = maybe_promise(
            default
                .call((inputs,))
                .catch(&ctx)
                .map_err(|e| Error::CallingModuleFunction(e.to_string()))?,
        )?;

        let Some(result_str) = ctx.json_stringify(result_obj)? else {
            return Err(Error::NotStringifiable);
        };
        Ok(result_str.to_string()?)
    });
    Ok(result?)
}

#[wasm_bindgen(main)]
pub fn main() {}

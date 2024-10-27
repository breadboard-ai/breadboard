/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
use rquickjs::{module::ModuleDef, CatchResultExt, Ctx, Function, Result, Value};
use thiserror::Error;

#[derive(Debug, Error)]
enum CapabilitiesError {
    #[error("Value could not be stringified to JSON")]
    NotStringifiable,
    #[error("A QuickJS error occured: {0}")]
    QuickJS(#[from] rquickjs::Error),
    #[error("JSON Parsing error: {0}")]
    ParseError(String),
}

type CapabilitiesResult<T> = std::result::Result<T, CapabilitiesError>;

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
            Function::new(ctx.clone(), |inputs: Value<'js>| fetch_wrapped(inputs))?
                .with_name("fetch")?,
        )?;
        Ok(())
    }
}

fn fetch_wrapped<'js>(inputs: Value<'js>) -> rquickjs::Value<'js> {
    let ctx = inputs.ctx().clone();
    let result = match fetch_result(inputs) {
        Ok(v) => v,
        Err(_) => Value::new_undefined(ctx),
    };
    result
}

fn fetch_result<'js>(inputs: Value<'js>) -> CapabilitiesResult<Value<'js>> {
    let ctx: Ctx<'js> = inputs.ctx().clone();
    let Some(input_str) = ctx.json_stringify(inputs)? else {
        return Err(CapabilitiesError::NotStringifiable);
    };
    let result_str = fetch(input_str.to_string()?);
    let result = ctx
        .json_parse(result_str)
        .catch(&ctx)
        .map_err(|e| CapabilitiesError::ParseError(e.to_string()))?;
    Ok(result)
}

fn fetch(inputs: String) -> String {
    return inputs;
}

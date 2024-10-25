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
pub fn eval(code: String) -> std::result::Result<String, JsError> {
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

#[wasm_bindgen(main)]
pub fn main() {}

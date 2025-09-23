/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
use rquickjs::{
    async_with,
    loader::{BuiltinLoader, BuiltinResolver},
    prelude::Async,
    CatchResultExt, Function,
};
use thiserror::Error;
use wasm_bindgen::prelude::*;

mod plugins;

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

async fn call_capability<F, Fut>(invocation_id: String, inputs: String, capability: F) -> String
where
    F: FnOnce(String, String) -> Fut,
    Fut: std::future::Future<Output = JsValue>,
{
    let result = capability(invocation_id, inputs).await;
    result.as_string().unwrap_or_default()
}

macro_rules! define_capability {
    ($name:ident) => {
        paste::paste! {
            #[wasm_bindgen]
            pub async fn [<$name _capability>](invocation_id: String, inputs: String) -> String {
                call_capability(invocation_id, inputs, $name).await
            }
        }
    };
}

define_capability!(fetch);
define_capability!(secrets);
define_capability!(invoke);
define_capability!(input);
define_capability!(output);
define_capability!(describe);
define_capability!(query);
define_capability!(read);
define_capability!(write);
define_capability!(blob);

async fn create_capabilities_object<'js>(
    ctx: &rquickjs::Ctx<'js>,
    invocation_id: &str,
) -> rquickjs::Result<rquickjs::Value<'js>> {
    let obj = rquickjs::Object::new(ctx.clone())?;

    // Helper macro to create capability functions
    macro_rules! add_capability {
        ($name:literal, $func:ident) => {{
            let invocation_id = invocation_id.to_string();
            let capability_func = Function::new(
                ctx.clone(),
                Async(move |inputs: rquickjs::Value<'js>| {
                    let invocation_id = invocation_id.clone();
                    let ctx = inputs.ctx().clone();
                    async move {
                        let input_str = ctx.json_stringify(inputs)?.unwrap().to_string()?;
                        let result_str = $func(invocation_id, input_str).await;
                        ctx.json_parse(result_str)
                    }
                }),
            )?;
            obj.set($name, capability_func)?;
        }};
    }

    add_capability!("fetch", fetch_capability);
    add_capability!("secrets", secrets_capability);
    add_capability!("invoke", invoke_capability);
    add_capability!("input", input_capability);
    add_capability!("output", output_capability);
    add_capability!("describe", describe_capability);
    add_capability!("query", query_capability);
    add_capability!("read", read_capability);
    add_capability!("write", write_capability);
    add_capability!("blob", blob_capability);

    Ok(obj.into())
}

#[derive(Debug, Error)]
enum Error {
    #[error("Value could not be stringified to JSON")]
    NotStringifiable,

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

    #[error("{0}")]
    CallingModuleFunction(String),
}

async fn maybe_promise<'js>(
    result_obj: rquickjs::Value<'js>,
) -> rquickjs::Result<rquickjs::Value<'js>> {
    let resolved_obj: rquickjs::Value = if result_obj.is_promise() {
        let promise = result_obj.as_promise().unwrap().clone();
        let ctx = result_obj.ctx();
        while ctx.execute_pending_job() {}
        let result = promise.into_future::<rquickjs::Value<'js>>().await?;
        result
    } else {
        result_obj.clone()
    };
    Ok(resolved_obj)
}

#[wasm_bindgen]
pub async fn run_module(
    invocation_id: String,
    method: String,
    name: String,
    modules: JsValue,
    code: String,
    json: String,
) -> std::result::Result<String, JsError> {
    let mut resolver = BuiltinResolver::default();

    let mut peer_loader = BuiltinLoader::default();
    let object = js_sys::Object::from(modules);
    let entries = js_sys::Object::entries(&object);
    for i in 0..entries.length() {
        let entry = js_sys::Array::from(&entries.get(i));
        let peer = entry.get(0).as_string().unwrap_or_default();
        let code = entry.get(1).as_string().unwrap_or_default();
        if !peer.is_empty() && !code.is_empty() && name != peer {
            let peer_js = format!("{}.js", peer);
            peer_loader.add_module(&peer, code.as_str());
            resolver.add_module(&peer);
            peer_loader.add_module(&peer_js, code.as_str());
            resolver.add_module(&peer_js);
        }
    }
    let loader = (peer_loader,);

    let rt = rquickjs::AsyncRuntime::new()?;
    let ctx = rquickjs::AsyncContext::full(&rt).await?;

    ctx.with(|ctx| plugins::console::init(&ctx)).await?;
    ctx.with(|ctx| plugins::atob::init(&ctx)).await?;

    rt.set_loader(resolver, loader).await;

    let result = async_with!(ctx => |ctx| {
        // Load the module.
        let module = rquickjs::Module::declare(ctx.clone(), name, code)
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

        let func = namespace
            .get::<_, rquickjs::Function>(method)
            .catch(&ctx)
            .map_err(|e| Error::GettintDefaultFunction(e.to_string()))?;

        let inputs = ctx
            .json_parse(json)
            .catch(&ctx)
            .map_err(|e| Error::ParsingInputValues(e.to_string()))?;

        // Create capabilities object
        let capabilities = create_capabilities_object(&ctx, &invocation_id)
            .await
            .catch(&ctx)
            .map_err(|e| Error::CallingModuleFunction(format!("Error creating capabilities object: {}", e.to_string())))?;

        // Call it and return value.
        let result_obj: rquickjs::Value = maybe_promise(
            func.call((inputs, capabilities)).catch(&ctx)
            .map_err(|e| Error::CallingModuleFunction(e.to_string()))?
        ).await.catch(&ctx)
        .map_err(|e| Error::CallingModuleFunction(e.to_string()))?;

        let Some(result_str) = ctx.json_stringify(result_obj)? else {
            return Err(Error::NotStringifiable);
        };
        Ok(result_str.to_string()?)
    })
    .await;

    rt.idle().await;

    Ok(result?)
}

#[wasm_bindgen(main)]
pub fn main() {}

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
use rquickjs::{module::ModuleDef, Ctx, Function, Result};

pub struct CapabilitiesModule;

impl ModuleDef for CapabilitiesModule {
    fn declare(decl: &rquickjs::module::Declarations) -> Result<()> {
        decl.declare("fetch")?;
        Ok(())
    }

    fn evaluate<'js>(ctx: &Ctx<'js>, exports: &rquickjs::module::Exports<'js>) -> Result<()> {
        exports.export(
            "fetch",
            Function::new(ctx.clone(), |inputs: String| fetch(inputs))?.with_name("fetch")?,
        )?;
        Ok(())
    }
}

fn fetch(inputs: String) -> String {
    format!("INPUTS: {}", inputs)
}

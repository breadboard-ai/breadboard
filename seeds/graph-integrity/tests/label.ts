/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { SafetyLabel, SafetyLabelValue } from "../src/label.js";

test("SafetyLabel: constructor", (t) => {
  const trusted = new SafetyLabel(SafetyLabelValue.TRUSTED);
  t.is(trusted.value, SafetyLabelValue.TRUSTED);

  const untrusted = new SafetyLabel(SafetyLabelValue.UNTRUSTED);
  t.is(untrusted.value, SafetyLabelValue.UNTRUSTED);

  const undetermined = new SafetyLabel(undefined);
  t.is(undetermined.value, undefined);

  const trustedCopy = new SafetyLabel(trusted);
  t.is(trustedCopy.value, SafetyLabelValue.TRUSTED);

  const untrustedCopy = new SafetyLabel(untrusted);
  t.is(untrustedCopy.value, SafetyLabelValue.UNTRUSTED);

  const undeterminedCopy = new SafetyLabel(undetermined);
  t.is(undeterminedCopy.value, undefined);
});

test("SafetyLabel: equalsTo", (t) => {
  const trusted = new SafetyLabel(SafetyLabelValue.TRUSTED);
  const untrusted = new SafetyLabel(SafetyLabelValue.UNTRUSTED);
  const undetermined = new SafetyLabel(undefined);

  t.true(trusted.equalsTo(trusted));
  t.true(untrusted.equalsTo(untrusted));
  t.true(undetermined.equalsTo(undetermined));

  t.false(trusted.equalsTo(untrusted));
  t.false(trusted.equalsTo(undetermined));
  t.false(untrusted.equalsTo(trusted));
  t.false(untrusted.equalsTo(undetermined));
  t.false(undetermined.equalsTo(trusted));
  t.false(undetermined.equalsTo(untrusted));
});

test("SafetyLabel: meet and join", (t) => {
  const trusted = new SafetyLabel(SafetyLabelValue.TRUSTED);
  const untrusted = new SafetyLabel(SafetyLabelValue.UNTRUSTED);
  const undetermined = new SafetyLabel(undefined);

  t.true(SafetyLabel.computeMeetOfLabels([trusted]).equalsTo(trusted));
  t.true(SafetyLabel.computeMeetOfLabels([trusted, trusted]).equalsTo(trusted));
  t.true(
    SafetyLabel.computeMeetOfLabels([untrusted, untrusted]).equalsTo(untrusted)
  );
  t.true(
    SafetyLabel.computeMeetOfLabels([trusted, untrusted]).equalsTo(untrusted)
  );

  t.true(
    SafetyLabel.computeMeetOfLabels([undetermined]).equalsTo(undetermined)
  );
  t.true(
    SafetyLabel.computeMeetOfLabels([undetermined, trusted]).equalsTo(trusted)
  );
  t.true(
    SafetyLabel.computeMeetOfLabels([undetermined, trusted, trusted]).equalsTo(
      trusted
    )
  );
  t.true(
    SafetyLabel.computeMeetOfLabels([
      undetermined,
      untrusted,
      untrusted,
    ]).equalsTo(untrusted)
  );
  t.true(
    SafetyLabel.computeMeetOfLabels([
      undetermined,
      trusted,
      untrusted,
    ]).equalsTo(untrusted)
  );

  t.true(SafetyLabel.computeMeetOfLabels([]).equalsTo(undetermined));
  t.true(SafetyLabel.computeMeetOfLabels([undefined]).equalsTo(undetermined));
  t.true(
    SafetyLabel.computeMeetOfLabels([undetermined, undefined]).equalsTo(
      undetermined
    )
  );
  t.true(
    SafetyLabel.computeMeetOfLabels([
      undetermined,
      undefined,
      trusted,
    ]).equalsTo(trusted)
  );
  t.true(
    SafetyLabel.computeMeetOfLabels([
      undetermined,
      undefined,
      trusted,
      trusted,
    ]).equalsTo(trusted)
  );
  t.true(
    SafetyLabel.computeMeetOfLabels([
      undetermined,
      undefined,
      untrusted,
      untrusted,
    ]).equalsTo(untrusted)
  );
  t.true(
    SafetyLabel.computeMeetOfLabels([
      undetermined,
      undefined,
      trusted,
      untrusted,
    ]).equalsTo(untrusted)
  );

  t.true(SafetyLabel.computeJoinOfLabels([trusted]).equalsTo(trusted));
  t.true(SafetyLabel.computeJoinOfLabels([trusted, trusted]).equalsTo(trusted));
  t.true(
    SafetyLabel.computeJoinOfLabels([untrusted, untrusted]).equalsTo(untrusted)
  );
  t.true(
    SafetyLabel.computeJoinOfLabels([trusted, untrusted]).equalsTo(trusted)
  );

  t.true(
    SafetyLabel.computeJoinOfLabels([undetermined]).equalsTo(undetermined)
  );
  t.true(
    SafetyLabel.computeJoinOfLabels([undetermined, trusted]).equalsTo(trusted)
  );
  t.true(
    SafetyLabel.computeJoinOfLabels([undetermined, trusted, trusted]).equalsTo(
      trusted
    )
  );
  t.true(
    SafetyLabel.computeJoinOfLabels([
      undetermined,
      untrusted,
      untrusted,
    ]).equalsTo(untrusted)
  );
  t.true(
    SafetyLabel.computeJoinOfLabels([
      undetermined,
      trusted,
      untrusted,
    ]).equalsTo(trusted)
  );

  t.true(SafetyLabel.computeJoinOfLabels([]).equalsTo(undetermined));
  t.true(SafetyLabel.computeJoinOfLabels([undefined]).equalsTo(undetermined));
  t.true(
    SafetyLabel.computeJoinOfLabels([undetermined, undefined]).equalsTo(
      undetermined
    )
  );
  t.true(
    SafetyLabel.computeJoinOfLabels([
      undetermined,
      undefined,
      trusted,
    ]).equalsTo(trusted)
  );
  t.true(
    SafetyLabel.computeJoinOfLabels([
      undetermined,
      undefined,
      trusted,
      trusted,
    ]).equalsTo(trusted)
  );
  t.true(
    SafetyLabel.computeJoinOfLabels([
      undetermined,
      undefined,
      untrusted,
      untrusted,
    ]).equalsTo(untrusted)
  );
  t.true(
    SafetyLabel.computeJoinOfLabels([
      undetermined,
      undefined,
      trusted,
      untrusted,
    ]).equalsTo(trusted)
  );
});

test("SafetyLabel: canFlowTo", (t) => {
  const trusted = new SafetyLabel(SafetyLabelValue.TRUSTED);
  const untrusted = new SafetyLabel(SafetyLabelValue.UNTRUSTED);
  const undetermined = new SafetyLabel(undefined);

  t.true(trusted.canFlowTo(trusted));
  t.true(trusted.canFlowTo(untrusted));
  t.true(trusted.canFlowTo(undetermined));

  t.true(untrusted.canFlowTo(untrusted));
  t.true(untrusted.canFlowTo(undetermined));
  t.false(untrusted.canFlowTo(trusted));

  t.true(undetermined.canFlowTo(undetermined));
  t.true(undetermined.canFlowTo(trusted));
  t.true(undetermined.canFlowTo(untrusted));
});

test("SafetyLabel: toString", (t) => {
  const trusted = new SafetyLabel(SafetyLabelValue.TRUSTED);
  const untrusted = new SafetyLabel(SafetyLabelValue.UNTRUSTED);
  const undetermined = new SafetyLabel(undefined);

  t.is(trusted.toString(), "TRUSTED");
  t.is(untrusted.toString(), "UNTRUSTED");
  t.is(undetermined.toString(), "UNDETERMINED");
});

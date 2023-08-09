/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { SafetyLabel, SafetyLabelValue } from "../src/label.js";

test("SafetyLabel: constructor", (t) => {
  const combined = new SafetyLabel({
    confidentiality: SafetyLabelValue.TRUSTED,
    integrity: SafetyLabelValue.UNTRUSTED,
  });
  t.is(combined.confidentiality, SafetyLabelValue.TRUSTED);
  t.is(combined.integrity, SafetyLabelValue.UNTRUSTED);

  const combinedCopy = new SafetyLabel(combined);
  t.is(combinedCopy.confidentiality, SafetyLabelValue.TRUSTED);
  t.is(combinedCopy.integrity, SafetyLabelValue.UNTRUSTED);

  const untrustedAndUndetermined = new SafetyLabel({
    confidentiality: SafetyLabelValue.UNTRUSTED,
  });
  t.is(untrustedAndUndetermined.confidentiality, SafetyLabelValue.UNTRUSTED);
  t.is(untrustedAndUndetermined.integrity, undefined);

  const untrustedAndUndeterminedCopy = new SafetyLabel(
    untrustedAndUndetermined
  );
  t.is(
    untrustedAndUndeterminedCopy.confidentiality,
    SafetyLabelValue.UNTRUSTED
  );
  t.is(untrustedAndUndeterminedCopy.integrity, undefined);

  const undetermined = new SafetyLabel(undefined);
  t.is(undetermined.confidentiality, undefined);
  t.is(undetermined.integrity, undefined);

  const undetermined2 = new SafetyLabel({});
  t.is(undetermined2.confidentiality, undefined);
  t.is(undetermined2.integrity, undefined);

  const undeterminedCopy = new SafetyLabel(undetermined);
  t.is(undeterminedCopy.confidentiality, undefined);
  t.is(undeterminedCopy.integrity, undefined);
});

test("SafetyLabel: equalsTo", (t) => {
  const trusted = new SafetyLabel({ integrity: SafetyLabelValue.TRUSTED });
  const untrusted = new SafetyLabel({ integrity: SafetyLabelValue.UNTRUSTED });
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
  const trusted = new SafetyLabel({ integrity: SafetyLabelValue.TRUSTED });
  const untrusted = new SafetyLabel({ integrity: SafetyLabelValue.UNTRUSTED });
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
  const trusted = new SafetyLabel({ integrity: SafetyLabelValue.TRUSTED });
  const untrusted = new SafetyLabel({ integrity: SafetyLabelValue.UNTRUSTED });
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
  const combined = new SafetyLabel({
    confidentiality: SafetyLabelValue.UNTRUSTED,
    integrity: SafetyLabelValue.TRUSTED,
  });
  const partUndetermined = new SafetyLabel({
    integrity: SafetyLabelValue.UNTRUSTED,
  });
  const undetermined = new SafetyLabel(undefined);

  t.is(combined.toString(), "[UNTRUSTED, TRUSTED]");
  t.is(partUndetermined.toString(), "[UNDETERMINED, UNTRUSTED]");
  t.is(undetermined.toString(), "[UNDETERMINED, UNDETERMINED]");
});

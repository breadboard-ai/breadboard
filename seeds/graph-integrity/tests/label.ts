/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { Label, LabelValue } from "../src/label.js";

test("LabelValue: Empty lattice", (t) => {
  t.is(LabelValue.TOP.name, "⊤");
  t.is(LabelValue.BOTTOM.name, "⊥");

  t.true(LabelValue.TOP.isAbove(LabelValue.BOTTOM));
  t.true(LabelValue.BOTTOM.isBelow(LabelValue.TOP));
});

test("LabelValue: Single label", (t) => {
  const label = new LabelValue("test");
  t.is(label.name, "test");
  t.is(label.below.length, 0);
  t.is(label.above.length, 0);

  // Default is to insert between TOP and BOTTOM
  label.insert();

  t.true(label.isAbove(LabelValue.BOTTOM));
  t.true(label.isBelow(LabelValue.TOP));

  // Inserting didn't mess up relationship between TOP and BOTTOM
  t.true(LabelValue.TOP.isAbove(LabelValue.BOTTOM));
  t.true(LabelValue.BOTTOM.isBelow(LabelValue.TOP));

  // But they no longer directly reference each other
  t.false(LabelValue.TOP.above.includes(LabelValue.BOTTOM));
  t.false(LabelValue.BOTTOM.below.includes(LabelValue.TOP));
});

test("LabelValue: Diamond shape", (t) => {
  const leftBottom = new LabelValue("left");
  const rightBottom = new LabelValue("right");

  leftBottom.insert();
  rightBottom.insert();

  t.true(leftBottom.isAbove(LabelValue.BOTTOM));
  t.true(leftBottom.isBelow(LabelValue.TOP));
  t.true(rightBottom.isAbove(LabelValue.BOTTOM));
  t.true(rightBottom.isBelow(LabelValue.TOP));

  // Now add more labels
  const leftTop = new LabelValue("leftTop");
  const rightTop = new LabelValue("rightTop");

  // Insert above the existing labels
  leftTop.insert(leftBottom);
  rightTop.insert(rightBottom);

  const leftMiddle = new LabelValue("leftMiddle");
  const rightMiddle = new LabelValue("rightMiddle");

  // Insert between the existing labels
  leftMiddle.insert(leftBottom, leftTop);
  rightMiddle.insert(rightBottom, rightTop);

  t.true(leftTop.isAbove(leftMiddle));
  t.true(leftMiddle.isAbove(leftBottom));
  t.true(leftTop.isAbove(leftBottom));

  t.false(leftBottom.isAbove(leftMiddle));
  t.false(leftBottom.isAbove(leftTop));

  // Comparing across branches is always false
  t.false(leftMiddle.isAbove(rightBottom));
  t.false(leftMiddle.isBelow(rightBottom));
});

test("Label: constructor", (t) => {
  const combined = new Label({
    confidentiality: LabelValue.TRUSTED,
    integrity: LabelValue.UNTRUSTED,
  });
  t.is(combined.confidentiality, LabelValue.TRUSTED);
  t.is(combined.integrity, LabelValue.UNTRUSTED);

  const combinedCopy = new Label(combined);
  t.is(combinedCopy.confidentiality, LabelValue.TRUSTED);
  t.is(combinedCopy.integrity, LabelValue.UNTRUSTED);

  const untrustedAndUndetermined = new Label({
    confidentiality: LabelValue.UNTRUSTED,
  });
  t.is(untrustedAndUndetermined.confidentiality, LabelValue.UNTRUSTED);
  t.is(untrustedAndUndetermined.integrity, undefined);

  const untrustedAndUndeterminedCopy = new Label(untrustedAndUndetermined);
  t.is(untrustedAndUndeterminedCopy.confidentiality, LabelValue.UNTRUSTED);
  t.is(untrustedAndUndeterminedCopy.integrity, undefined);

  const undetermined = new Label(undefined);
  t.is(undetermined.confidentiality, undefined);
  t.is(undetermined.integrity, undefined);

  const undetermined2 = new Label({});
  t.is(undetermined2.confidentiality, undefined);
  t.is(undetermined2.integrity, undefined);

  const undeterminedCopy = new Label(undetermined);
  t.is(undeterminedCopy.confidentiality, undefined);
  t.is(undeterminedCopy.integrity, undefined);
});

test("Label: equalsTo", (t) => {
  const trusted = new Label({ integrity: LabelValue.TRUSTED });
  const untrusted = new Label({ integrity: LabelValue.UNTRUSTED });
  const undetermined = new Label(undefined);

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

test("Label: meet and join (integrity only)", (t) => {
  const trusted = new Label({ integrity: LabelValue.TRUSTED });
  const untrusted = new Label({ integrity: LabelValue.UNTRUSTED });
  const undetermined = new Label(undefined);

  t.true(Label.computeMeetOfLabels([trusted]).equalsTo(trusted));
  t.true(Label.computeMeetOfLabels([trusted, trusted]).equalsTo(trusted));
  t.true(Label.computeMeetOfLabels([untrusted, untrusted]).equalsTo(untrusted));
  t.true(Label.computeMeetOfLabels([trusted, untrusted]).equalsTo(untrusted));

  t.true(Label.computeMeetOfLabels([undetermined]).equalsTo(undetermined));
  t.true(Label.computeMeetOfLabels([undetermined, trusted]).equalsTo(trusted));
  t.true(
    Label.computeMeetOfLabels([undetermined, trusted, trusted]).equalsTo(
      trusted
    )
  );
  t.true(
    Label.computeMeetOfLabels([undetermined, untrusted, untrusted]).equalsTo(
      untrusted
    )
  );
  t.true(
    Label.computeMeetOfLabels([undetermined, trusted, untrusted]).equalsTo(
      untrusted
    )
  );

  t.true(Label.computeMeetOfLabels([]).equalsTo(undetermined));
  t.true(Label.computeMeetOfLabels([undefined]).equalsTo(undetermined));
  t.true(
    Label.computeMeetOfLabels([undetermined, undefined]).equalsTo(undetermined)
  );
  t.true(
    Label.computeMeetOfLabels([undetermined, undefined, trusted]).equalsTo(
      trusted
    )
  );
  t.true(
    Label.computeMeetOfLabels([
      undetermined,
      undefined,
      trusted,
      trusted,
    ]).equalsTo(trusted)
  );
  t.true(
    Label.computeMeetOfLabels([
      undetermined,
      undefined,
      untrusted,
      untrusted,
    ]).equalsTo(untrusted)
  );
  t.true(
    Label.computeMeetOfLabels([
      undetermined,
      undefined,
      trusted,
      untrusted,
    ]).equalsTo(untrusted)
  );

  t.true(Label.computeJoinOfLabels([trusted]).equalsTo(trusted));
  t.true(Label.computeJoinOfLabels([trusted, trusted]).equalsTo(trusted));
  t.true(Label.computeJoinOfLabels([untrusted, untrusted]).equalsTo(untrusted));
  t.true(Label.computeJoinOfLabels([trusted, untrusted]).equalsTo(trusted));

  t.true(Label.computeJoinOfLabels([undetermined]).equalsTo(undetermined));
  t.true(Label.computeJoinOfLabels([undetermined, trusted]).equalsTo(trusted));
  t.true(
    Label.computeJoinOfLabels([undetermined, trusted, trusted]).equalsTo(
      trusted
    )
  );
  t.true(
    Label.computeJoinOfLabels([undetermined, untrusted, untrusted]).equalsTo(
      untrusted
    )
  );
  t.true(
    Label.computeJoinOfLabels([undetermined, trusted, untrusted]).equalsTo(
      trusted
    )
  );

  t.true(Label.computeJoinOfLabels([]).equalsTo(undetermined));
  t.true(Label.computeJoinOfLabels([undefined]).equalsTo(undetermined));
  t.true(
    Label.computeJoinOfLabels([undetermined, undefined]).equalsTo(undetermined)
  );
  t.true(
    Label.computeJoinOfLabels([undetermined, undefined, trusted]).equalsTo(
      trusted
    )
  );
  t.true(
    Label.computeJoinOfLabels([
      undetermined,
      undefined,
      trusted,
      trusted,
    ]).equalsTo(trusted)
  );
  t.true(
    Label.computeJoinOfLabels([
      undetermined,
      undefined,
      untrusted,
      untrusted,
    ]).equalsTo(untrusted)
  );
  t.true(
    Label.computeJoinOfLabels([
      undetermined,
      undefined,
      trusted,
      untrusted,
    ]).equalsTo(trusted)
  );
});

test("Label: meet and join with both confidentiality and integrity", (t) => {
  const low = new Label({
    confidentiality: LabelValue.UNTRUSTED,
    integrity: LabelValue.TRUSTED,
  });

  const high = new Label({
    confidentiality: LabelValue.TRUSTED,
    integrity: LabelValue.UNTRUSTED,
  });

  t.true(Label.computeJoinOfLabels([low, high]).equalsTo(low));
  t.true(Label.computeMeetOfLabels([low, high]).equalsTo(high));

  const lowHigh = new Label({
    confidentiality: LabelValue.UNTRUSTED,
    integrity: LabelValue.UNTRUSTED,
  });

  const highLow = new Label({
    confidentiality: LabelValue.TRUSTED,
    integrity: LabelValue.TRUSTED,
  });

  t.true(Label.computeJoinOfLabels([lowHigh, highLow]).equalsTo(low));
  t.true(Label.computeMeetOfLabels([lowHigh, highLow]).equalsTo(high));
});

test("Label: canFlowTo (integrity only)", (t) => {
  const trusted = new Label({ integrity: LabelValue.TRUSTED });
  const untrusted = new Label({ integrity: LabelValue.UNTRUSTED });
  const undetermined = new Label(undefined);

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

test("Label: canFlowTo with both confidentiality and integrity", (t) => {
  const low = new Label({
    confidentiality: LabelValue.UNTRUSTED,
    integrity: LabelValue.TRUSTED,
  });

  const high = new Label({
    confidentiality: LabelValue.TRUSTED,
    integrity: LabelValue.UNTRUSTED,
  });

  t.true(low.canFlowTo(high));
});

test("Label: toString", (t) => {
  const combined = new Label({
    confidentiality: LabelValue.UNTRUSTED,
    integrity: LabelValue.TRUSTED,
  });
  const partUndetermined = new Label({
    integrity: LabelValue.UNTRUSTED,
  });
  const undetermined = new Label(undefined);

  t.is(combined.toString(), "[PRIVATE, TRUSTED]");
  t.is(partUndetermined.toString(), "[UNDETERMINED, UNTRUSTED]");
  t.is(undetermined.toString(), "[UNDETERMINED, UNDETERMINED]");
});

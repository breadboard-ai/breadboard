/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { Label, Principal, PrincipalLattice } from "../src/label.js";

test("Principals: Empty lattice", (t) => {
  const lattice = new PrincipalLattice();

  t.is(lattice.TOP.name, "⊤");
  t.is(lattice.BOTTOM.name, "⊥");

  t.true(lattice.TOP.isAbove(lattice.BOTTOM));
  t.true(lattice.BOTTOM.isBelow(lattice.TOP));

  t.is(Principal.leastUpperBound([]), undefined);
  t.is(Principal.leastUpperBound([lattice.TOP]), lattice.TOP);
  t.is(Principal.leastUpperBound([lattice.BOTTOM]), lattice.BOTTOM);
  t.is(Principal.leastUpperBound([lattice.TOP, lattice.BOTTOM]), lattice.TOP);

  t.is(Principal.greatestLowerBound([]), undefined);
  t.is(Principal.greatestLowerBound([lattice.TOP]), lattice.TOP);
  t.is(Principal.greatestLowerBound([lattice.BOTTOM]), lattice.BOTTOM);
  t.is(
    Principal.greatestLowerBound([lattice.TOP, lattice.BOTTOM]),
    lattice.BOTTOM
  );

  t.true(lattice.get("TOP") === lattice.TOP);
  t.true(lattice.get("UNDETERMINED") === undefined);
});

test("Principals: Single principal", (t) => {
  const lattice = new PrincipalLattice();

  const label = new Principal("test");
  t.is(label.name, "test");
  t.is(label.below.length, 0);
  t.is(label.above.length, 0);

  // Default is to insert between TOP and BOTTOM
  lattice.insert(label);

  t.true(lattice.get("test") === label);

  t.true(label.isAbove(lattice.BOTTOM));
  t.true(label.isBelow(lattice.TOP));

  t.is(Principal.leastUpperBound([label]), label);
  t.is(Principal.greatestLowerBound([label]), label);

  t.is(Principal.leastUpperBound([label, lattice.TOP]), lattice.TOP);
  t.is(Principal.greatestLowerBound([label, lattice.BOTTOM]), lattice.BOTTOM);

  t.is(Principal.leastUpperBound([label, lattice.BOTTOM]), label);
  t.is(Principal.greatestLowerBound([label, lattice.TOP]), label);

  // Inserting didn't mess up relationship between TOP and BOTTOM
  t.true(lattice.TOP.isAbove(lattice.BOTTOM));
  t.true(lattice.BOTTOM.isBelow(lattice.TOP));

  // But they no longer directly reference each other
  t.false(lattice.TOP.above.includes(lattice.BOTTOM));
  t.false(lattice.BOTTOM.below.includes(lattice.TOP));
});

test("Principals: Diamond shape", (t) => {
  const lattice = new PrincipalLattice();

  const leftBottom = new Principal("left");
  const rightBottom = new Principal("right");

  lattice.insert(leftBottom);
  lattice.insert(rightBottom);

  t.true(leftBottom.isAbove(lattice.BOTTOM));
  t.true(leftBottom.isBelow(lattice.TOP));
  t.true(rightBottom.isAbove(lattice.BOTTOM));
  t.true(rightBottom.isBelow(lattice.TOP));

  // Now add more labels
  const leftTop = new Principal("leftTop");
  const rightTop = new Principal("rightTop");

  // Insert above the existing labels
  lattice.insert(leftTop, leftBottom);
  lattice.insert(rightTop, rightBottom);

  const leftMiddle = new Principal("leftMiddle");
  const rightMiddle = new Principal("rightMiddle");

  // Insert between the existing labels
  lattice.insert(leftMiddle, leftBottom, leftTop);
  lattice.insert(rightMiddle, rightBottom, rightTop);

  t.true(leftTop.isAbove(leftMiddle));
  t.true(leftMiddle.isAbove(leftBottom));
  t.true(leftTop.isAbove(leftBottom));

  t.is(Principal.leastUpperBound([leftTop, leftMiddle]), leftTop);
  t.is(Principal.greatestLowerBound([leftTop, leftBottom]), leftBottom);

  t.false(leftBottom.isAbove(leftMiddle));
  t.false(leftBottom.isAbove(leftTop));

  // Comparing across branches is always false
  t.false(leftMiddle.isAbove(rightBottom));
  t.false(leftMiddle.isBelow(rightBottom));

  // Upper and lower bounds hence always TOP or BOTTOM
  t.is(Principal.leastUpperBound([leftMiddle, rightMiddle]), lattice.TOP);
  t.is(Principal.greatestLowerBound([leftMiddle, rightMiddle]), lattice.BOTTOM);
});

test("Label: constructor", (t) => {
  const lattice = new PrincipalLattice();

  const combined = new Label({
    confidentiality: lattice.TRUSTED,
    integrity: lattice.UNTRUSTED,
  });
  t.is(combined.confidentiality, lattice.TRUSTED);
  t.is(combined.integrity, lattice.UNTRUSTED);

  const combinedCopy = new Label(combined);
  t.is(combinedCopy.confidentiality, lattice.TRUSTED);
  t.is(combinedCopy.integrity, lattice.UNTRUSTED);

  const untrustedAndUndetermined = new Label({
    confidentiality: lattice.UNTRUSTED,
  });
  t.is(untrustedAndUndetermined.confidentiality, lattice.UNTRUSTED);
  t.is(untrustedAndUndetermined.integrity, undefined);

  const untrustedAndUndeterminedCopy = new Label(untrustedAndUndetermined);
  t.is(untrustedAndUndeterminedCopy.confidentiality, lattice.UNTRUSTED);
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
  const lattice = new PrincipalLattice();

  const trusted = new Label({ integrity: lattice.TRUSTED });
  const untrusted = new Label({ integrity: lattice.UNTRUSTED });
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
  const lattice = new PrincipalLattice();

  const trusted = new Label({ integrity: lattice.TRUSTED });
  const untrusted = new Label({ integrity: lattice.UNTRUSTED });
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
  const lattice = new PrincipalLattice();

  const low = new Label({
    confidentiality: lattice.PUBLIC,
    integrity: lattice.TRUSTED,
  });

  const high = new Label({
    confidentiality: lattice.PRIVATE,
    integrity: lattice.UNTRUSTED,
  });

  t.true(Label.computeJoinOfLabels([low, high]).equalsTo(low));
  t.true(Label.computeMeetOfLabels([low, high]).equalsTo(high));

  const lowHigh = new Label({
    confidentiality: lattice.PUBLIC,
    integrity: lattice.UNTRUSTED,
  });

  const highLow = new Label({
    confidentiality: lattice.PRIVATE,
    integrity: lattice.TRUSTED,
  });

  t.true(Label.computeJoinOfLabels([lowHigh, highLow]).equalsTo(low));
  t.true(Label.computeMeetOfLabels([lowHigh, highLow]).equalsTo(high));
});

test("Label: canFlowTo (integrity only)", (t) => {
  const lattice = new PrincipalLattice();

  const trusted = new Label({ integrity: lattice.TRUSTED });
  const untrusted = new Label({ integrity: lattice.UNTRUSTED });
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
  const lattice = new PrincipalLattice();

  const low = new Label({
    confidentiality: lattice.PUBLIC,
    integrity: lattice.TRUSTED,
  });

  const high = new Label({
    confidentiality: lattice.PRIVATE,
    integrity: lattice.UNTRUSTED,
  });

  t.true(low.canFlowTo(high));
});

test("Label: toString", (t) => {
  const lattice = new PrincipalLattice();

  const combined = new Label({
    confidentiality: lattice.UNTRUSTED,
    integrity: lattice.TRUSTED,
  });
  const partUndetermined = new Label({
    integrity: lattice.UNTRUSTED,
  });
  const undetermined = new Label(undefined);

  t.is(combined.toString(), "[PRIVATE, TRUSTED]");
  t.is(partUndetermined.toString(), "[UNDETERMINED, UNTRUSTED]");
  t.is(undetermined.toString(), "[UNDETERMINED, UNDETERMINED]");
});

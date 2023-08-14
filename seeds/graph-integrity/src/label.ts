/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Information flow control label values, i.e. levels of trust.
 * Defines a lattice, with TOP being the most restrictive and BOTTOM being the
 * least restrictive values.
 */
export class LabelValue {
  below: LabelValue[];
  above: LabelValue[];
  name: string;

  static readonly TOP = new LabelValue("⊤");
  static readonly BOTTOM = new LabelValue("⊥");

  static readonly PRIVATE = LabelValue.TOP;
  static readonly PUBLIC = LabelValue.BOTTOM;

  // Yes, that is correct: UNTRUSTED is more restrictive than TRUSTED
  static readonly UNTRUSTED = LabelValue.TOP;
  static readonly TRUSTED = LabelValue.BOTTOM;

  /**
   * Create new label. Must be @method {insert}ed into the semi-lattice.
   *
   * @param name {string} Name of the label value
   */
  constructor(name: string) {
    this.below = [];
    this.above = [];
    this.name = name;
  }

  /**
   * Insert a new label value between two existing label values.
   *
   * @param below {LabelValue} LabelValue below the new label value
   * @param above {LabelValue} LabelValue above the new label value
   */
  insert(
    below: LabelValue = LabelValue.BOTTOM,
    above: LabelValue = LabelValue.TOP
  ) {
    this.below.push(below);
    this.above.push(above);

    // Insert between the above and below nodes
    below.above = below.above.filter((n) => n !== above);
    below.above.push(this);
    above.below = above.below.filter((n) => n !== below);
    above.below.push(this);
  }

  /**
   * Test whether this label is below another in the semi-lattice.
   *
   * @param other {LabelValue} LabelValue to compare with
   * @returns {Boolean} true if this label is above the other
   */
  isBelow(other: LabelValue): boolean {
    let aboves = [this as LabelValue];
    let above: LabelValue | undefined;
    while ((above = aboves.pop()) !== undefined) {
      if (above.above.includes(other)) return true;
      aboves = [...aboves, ...above.above];
    }
    return false;
  }

  /**
   * Test whether this label is above another in the semi-lattice.
   *
   * @param other {LabelValue} LabelValue to compare with
   * @returns {Boolean} true if this label is above the other
   */
  isAbove(other: LabelValue): boolean {
    let belows = [this as LabelValue];
    let below: LabelValue | undefined;
    while ((below = belows.pop()) !== undefined) {
      if (below.below.includes(other)) return true;
      belows = [...belows, ...below.below];
    }
    return false;
  }

  /**
   * Upper bound of TRUSTED and UNTRUSTED is TRUSTED.
   * Only UNTRUSTED and UNTRUSTED is UNTRUSTED.
   *
   * Returns undefined for an empty list.
   */
  static leastUpperBound(values: LabelValue[]): LabelValue | undefined {
    if (values.length === 0) return undefined;

    // Map each value to itself and all values above it.
    // The order is partially sorted, with lowest first.
    const allAbove = values.map((value) => {
      const all: LabelValue[] = [];
      let aboves = [value];
      let above: LabelValue | undefined;
      while ((above = aboves.pop()) !== undefined) {
        all.push(above);
        aboves = [...aboves, ...above.above];
      }
      return all;
    });

    const intersection = allAbove.reduce((a, b) =>
      a.filter((value) => b.includes(value))
    );

    if (intersection.length === 0)
      throw Error("Lattice appears broken, ⊤ should always be the upper bound");

    // Return the lowest value in the intersection.
    return intersection[0];
  }

  /**
   * Lower bound of TRUSTED and UNTRUSTED is UNTRUSTED.
   * Only TRUSTED and TRUSTED is TRUSTED.
   *
   * Returns undefined for an empty list.
   */
  static greatestLowerBound(values: LabelValue[]): LabelValue | undefined {
    if (values.length === 0) return undefined;

    // Map each value to itself and all values below it.
    // The order is partially sorted, with highest first.
    const allBelow = values.map((value) => {
      const all: LabelValue[] = [];
      let belows = [value];
      let below: LabelValue | undefined;
      while ((below = belows.pop()) !== undefined) {
        all.push(below);
        belows = [...belows, ...below.below];
      }
      return all;
    });

    const intersection = allBelow.reduce((a, b) =>
      a.filter((value) => b.includes(value))
    );

    if (intersection.length === 0)
      throw Error("Lattice appears broken, ⊥ should always be the lower bound");

    // Return the first value in the intersection, which is the highest label
    return intersection[0];
  }
}

// Initialize empty lattice.
LabelValue.TOP.below = [LabelValue.BOTTOM];
LabelValue.BOTTOM.above = [LabelValue.TOP];

/**
 * Information flow control label.
 */
export class Label {
  public readonly confidentiality?: LabelValue;
  public readonly integrity?: LabelValue;

  /**
   * @param {{ confidentiality: LabelValue; integrity: LabelValue } | Label}
   *   label Label to copy or pair of LabelValues to create a new label from.
   */
  constructor(
    label:
      | Label
      | { confidentiality?: LabelValue; integrity?: LabelValue }
      | undefined = undefined
  ) {
    if (label) {
      this.confidentiality = label.confidentiality;
      this.integrity = label.integrity;
    }
  }

  /**
   * Meet (⊓): @returns {Label} that is equal or more restrictive than any of
   * the passed @param {[Label | undefined]} labels. Undefined labels are
   * ignored. If all labels are undefined, the result is also undefined.
   *
   * Flow from any of the input labels to the meet is allowed. Use this to
   * compute a label of a node based on its incoming edges. That is, if a node
   * reads from an UNTRUSTED node, it has to be UNTRUSTED.
   */
  static computeMeetOfLabels(labels: (Label | undefined)[]): Label {
    const { confidentialityLabels, integrityLabels } =
      Label.getLabelComponents(labels);

    const confidentiality = LabelValue.leastUpperBound(confidentialityLabels);
    const integrity = LabelValue.leastUpperBound(integrityLabels);

    return new Label({ confidentiality, integrity });
  }

  /**
   * Join (⊔): @returns {Label} that is equal or less restrictive than any of
   * the passed @param {[Label | undefined]} labels. Undefined labels are
   * ignored. If all labels are undefined, the result is also undefined.
   *
   * Flow to any of the input labels from the join is allowed. Use this to
   * compute a label of a node based on its outgoing edges. That is, if a node
   * writes to a TRUSTED node, it has to be TRUSTED.
   */
  static computeJoinOfLabels(labels: (Label | undefined)[]): Label {
    const { confidentialityLabels, integrityLabels } =
      Label.getLabelComponents(labels);

    const confidentiality = LabelValue.greatestLowerBound(
      confidentialityLabels
    );
    const integrity = LabelValue.greatestLowerBound(integrityLabels);

    return new Label({ confidentiality, integrity });
  }

  /**
   * Extract label components, throwing a away all undefined ones.
   * Might return empty lists if there are no defined label components.
   */
  private static getLabelComponents(labels: (Label | undefined)[]): {
    confidentialityLabels: LabelValue[];
    integrityLabels: LabelValue[];
  } {
    const confidentialityLabels = labels
      .filter(
        (label) => label !== undefined && label.confidentiality !== undefined
      )
      .map((label) => label?.confidentiality) as LabelValue[];
    const integrityLabels = labels
      .filter((label) => label !== undefined && label.integrity !== undefined)
      .map((label) => label?.integrity) as LabelValue[];
    return { confidentialityLabels, integrityLabels };
  }

  /**
   * Compare with other label.
   *
   * @param {Label} other label
   * @returns {Boolean} true if the labels are equal
   */
  equalsTo(other: Label): boolean {
    return (
      this.confidentiality === other.confidentiality &&
      this.integrity === other.integrity
    );
  }

  /**
   * Checks whether the label can flow to the destination label.
   * Flow between undetermined labels is always allowed.
   *
   * @param {Label} destinationLabel label to flow to
   * @returns {Boolean} true if the label can flow to the destination label
   */
  canFlowTo(destinationLabel: Label | undefined): boolean {
    const join = Label.computeJoinOfLabels([this, destinationLabel]);
    return (
      (this.confidentiality === undefined ||
        this.confidentiality === join.confidentiality) &&
      (this.integrity === undefined || this.integrity === join.integrity)
    );
  }

  /**
   * Convert label to human-readable string.
   *
   * @param {Label} label
   * @returns {String} human-readable string
   */
  toString(): string | undefined {
    return (
      "[" +
      (this.confidentiality === undefined
        ? "UNDETERMINED"
        : this.confidentiality === LabelValue.TOP
        ? "PRIVATE"
        : this.confidentiality === LabelValue.BOTTOM
        ? "PUBLIC"
        : this.confidentiality.name) +
      ", " +
      (this.integrity === undefined
        ? "UNDETERMINED"
        : this.integrity === LabelValue.TOP
        ? "UNTRUSTED"
        : this.integrity === LabelValue.BOTTOM
        ? "TRUSTED"
        : this.integrity.name) +
      "]"
    );
  }
}

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Information flow control label values, i.e. levels of trust.
 */
export class Principal {
  below: Principal[];
  above: Principal[];
  name: string;

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
   * Test whether this label is below another in the semi-lattice.
   *
   * @param other {Principal} Principal to compare with
   * @returns {Boolean} true if this label is above the other
   */
  isBelow(other: Principal): boolean {
    let aboves = [this as Principal];
    let above: Principal | undefined;
    while ((above = aboves.pop()) !== undefined) {
      if (above.above.includes(other)) return true;
      aboves = [...aboves, ...above.above];
    }
    return false;
  }

  /**
   * Test whether this label is above another in the semi-lattice.
   *
   * @param other {Principal} Principal to compare with
   * @returns {Boolean} true if this label is above the other
   */
  isAbove(other: Principal): boolean {
    let belows = [this as Principal];
    let below: Principal | undefined;
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
  static leastUpperBound(values: Principal[]): Principal | undefined {
    if (values.length === 0) return undefined;

    // Map each value to itself and all values above it.
    // The order is partially sorted, with lowest first.
    const allAbove = values.map((value) => {
      const all: Principal[] = [];
      let aboves = [value];
      let above: Principal | undefined;
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
  static greatestLowerBound(values: Principal[]): Principal | undefined {
    if (values.length === 0) return undefined;

    // Map each value to itself and all values below it.
    // The order is partially sorted, with highest first.
    const allBelow = values.map((value) => {
      const all: Principal[] = [];
      let belows = [value];
      let below: Principal | undefined;
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

/**
 * Information flow control principal lattice.
 *
 * Defines a lattice, with TOP being the most restrictive and BOTTOM being the
 * least restrictive values.
 */
export class PrincipalLattice {
  readonly TOP = new Principal("⊤");
  readonly BOTTOM = new Principal("⊥");

  readonly PRIVATE = this.TOP;
  readonly PUBLIC = this.BOTTOM;

  // Yes, that is correct: UNTRUSTED is more restrictive than TRUSTED
  readonly UNTRUSTED = this.TOP;
  readonly TRUSTED = this.BOTTOM;

  readonly labels = new Map<string, Principal | undefined>([
    ["⊤", this.TOP],
    ["⊥", this.BOTTOM],
    ["TOP", this.TOP],
    ["BOTTOM", this.BOTTOM],
    ["PRIVATE", this.TOP],
    ["PUBLIC", this.TOP],
    ["UNTRUSTED", this.TOP],
    ["TRUSTED", this.BOTTOM],
    ["UNDETERMINED", undefined],
  ]);

  constructor() {
    // Connect TOP and BOTTOM in anotherwise empty lattice.
    this.TOP.below = [this.BOTTOM];
    this.BOTTOM.above = [this.TOP];
  }

  /**
   * Insert a new principal between two existing label values.
   *
   * @param below {Principal} Principal below the new label value
   * @param above {Principal} Principal above the new label value
   */
  insert(
    label: Principal,
    below: Principal = this.BOTTOM,
    above: Principal = this.TOP
  ) {
    if (this.labels.has(label.name))
      throw Error(`Can't insert label named "${label.name}" twice.`);

    this.labels.set(label.name, label);

    label.below.push(below);
    label.above.push(above);

    // Insert between the above and below nodes
    below.above = below.above.filter((n) => n !== above);
    below.above.push(label);
    above.below = above.below.filter((n) => n !== below);
    above.below.push(label);
  }

  /**
   * Get principal by name.
   *
   * @param name Name of principal to find
   * @returns {Principal} principal or undefined
   */
  get(name: string): Principal | undefined {
    return this.labels.get(name);
  }
}

/**
 * Information flow control label.
 */
export class Label {
  public readonly confidentiality?: Principal;
  public readonly integrity?: Principal;

  /**
   * @param {{ confidentiality: Principal; integrity: Principal } | Label}
   *   label Label to copy or pair of Principals to create a new label from.
   */
  constructor(
    label:
      | Label
      | { confidentiality?: Principal; integrity?: Principal }
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

    const confidentiality = Principal.leastUpperBound(confidentialityLabels);
    const integrity = Principal.leastUpperBound(integrityLabels);

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

    const confidentiality = Principal.greatestLowerBound(confidentialityLabels);
    const integrity = Principal.greatestLowerBound(integrityLabels);

    return new Label({ confidentiality, integrity });
  }

  /**
   * Extract label components, throwing a away all undefined ones.
   * Might return empty lists if there are no defined label components.
   */
  private static getLabelComponents(labels: (Label | undefined)[]): {
    confidentialityLabels: Principal[];
    integrityLabels: Principal[];
  } {
    const confidentialityLabels = labels
      .filter(
        (label) => label !== undefined && label.confidentiality !== undefined
      )
      .map((label) => label?.confidentiality) as Principal[];
    const integrityLabels = labels
      .filter((label) => label !== undefined && label.integrity !== undefined)
      .map((label) => label?.integrity) as Principal[];
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
        : this.confidentiality.above.length === 0 // === TOP
        ? "PRIVATE"
        : this.confidentiality.below.length === 0 // === BOTTOM
        ? "PUBLIC"
        : this.confidentiality.name) +
      ", " +
      (this.integrity === undefined
        ? "UNDETERMINED"
        : this.integrity.above.length === 0 // === TOP
        ? "UNTRUSTED"
        : this.integrity.below.length === 0 // === BOTTOM
        ? "TRUSTED"
        : this.integrity.name) +
      "]"
    );
  }
}

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Information flow control label values, i.e. levels of trust.
 *
 * This will become more complex over time, but for now, just a simple enum.
 * Flow is allowed from TRUSTED to TRUSTED, from either to UNTRUSTED,
 * but not from UNTRUSTED to TRUSTED.
 */
export enum LabelValue {
  UNTRUSTED,
  TRUSTED,
}

const mapLabelToString = new Map<LabelValue, string>([
  [LabelValue.TRUSTED, "TRUSTED"],
  [LabelValue.UNTRUSTED, "UNTRUSTED"],
]);

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
   * For the confidentiality component, the meet is defined as the least higher
   * bound, e.g. taking the higher of the two confidentiality levels (since
   * higher levels are more restrictive).
   *
   * For the integrity component, the meet is defined as the greatest lower
   * bound, e.g. taking the lower of the two integrity levels (since lower
   * integrity levels are more restrictive).
   *
   * Flow from any of the input labels to the meet is allowed. Use this to
   * compute a label of a node based on its incoming edges. That is, if a node
   * reads from an UNTRUSTED node, it has to be UNTRUSTED.
   */
  static computeMeetOfLabels(labels: (Label | undefined)[]): Label {
    const { confidentialityLabels, integrityLabels } =
      Label.getLabelComponents(labels);

    const confidentiality = Label.leastUpperBound(confidentialityLabels);
    const integrity = Label.greatestLowerBound(integrityLabels);

    return new Label({ confidentiality, integrity });
  }

  /**
   * Join (⊔): @returns {Label} that is equal or less restrictive than any of
   * the passed @param {[Label | undefined]} labels. Undefined labels are
   * ignored. If all labels are undefined, the result is also undefined.
   *
   * For the confidentiality component, the join is defined as the greatest
   * lower bound, e.g. taking the lower of the two confidentiality levels (since
   * lower levels are less restrictive).
   *
   * For the integrity component, the join is defined as the least upper bound,
   * e.g. taking the higher of the two integrity levels (since higher integrity
   * levels are less restrictive).
   *
   * Flow to any of the input labels from the join is allowed. Use this to
   * compute a label of a node based on its outgoing edges. That is, if a node
   * writes to a TRUSTED node, it has to be TRUSTED.
   */
  static computeJoinOfLabels(labels: (Label | undefined)[]): Label {
    const { confidentialityLabels, integrityLabels } =
      Label.getLabelComponents(labels);

    const confidentiality = Label.greatestLowerBound(confidentialityLabels);
    const integrity = Label.leastUpperBound(integrityLabels);

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
   * Upper bound of TRUSTED and UNTRUSTED is TRUSTED.
   * Only UNTRUSTED and UNTRUSTED is UNTRUSTED.
   *
   * Returns undefined for an empty list.
   */
  private static leastUpperBound(values: LabelValue[]): LabelValue | undefined {
    if (values.length === 0) return undefined;
    return values.reduce((a, b) => {
      return a === LabelValue.TRUSTED || b === LabelValue.TRUSTED
        ? LabelValue.TRUSTED
        : LabelValue.UNTRUSTED;
    });
  }

  /**
   * Lower bound of TRUSTED and UNTRUSTED is UNTRUSTED.
   * Only TRUSTED and TRUSTED is TRUSTED.
   *
   * Returns undefined for an empty list.
   */
  private static greatestLowerBound(
    values: LabelValue[]
  ): LabelValue | undefined {
    if (values.length === 0) return undefined;
    return values.reduce((a, b) => {
      return a === LabelValue.TRUSTED && b === LabelValue.TRUSTED
        ? LabelValue.TRUSTED
        : LabelValue.UNTRUSTED;
    });
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
        : mapLabelToString.get(this.confidentiality)) +
      ", " +
      (this.integrity === undefined
        ? "UNDETERMINED"
        : mapLabelToString.get(this.integrity)) +
      "]"
    );
  }
}

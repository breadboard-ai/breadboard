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
export enum SafetyLabelValue {
  UNTRUSTED,
  TRUSTED,
}

const mapLabelToString = new Map<SafetyLabelValue, string>([
  [SafetyLabelValue.TRUSTED, "TRUSTED"],
  [SafetyLabelValue.UNTRUSTED, "UNTRUSTED"],
]);

/**
 * Information flow control label.
 */
export class SafetyLabel {
  public readonly confidentiality?: SafetyLabelValue;
  public readonly integrity?: SafetyLabelValue;

  /**
   * @param {{ confidentiality: SafetyLabelValue; integrity: SafetyLabelValue }
   *   | SafetyLabel} label SafetyLabel to copy or pair of SafetyLabelValues to
   *   create a new label from.
   */
  constructor(
    label:
      | SafetyLabel
      | { confidentiality?: SafetyLabelValue; integrity?: SafetyLabelValue }
      | undefined = undefined
  ) {
    if (label) {
      this.confidentiality = label.confidentiality;
      this.integrity = label.integrity;
    }
  }

  /**
   * Meet (⊓): @returns {SafetyLabel} that is equal or more restrictive than any
   * of the passed @param {[SafetyLabel | undefined]} labels. Undefined labels
   * are ignored. If all labels are undefined, the result is also undefined.
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
  static computeMeetOfLabels(labels: (SafetyLabel | undefined)[]): SafetyLabel {
    const { confidentialityLabels, integrityLabels } =
      SafetyLabel.getLabelComponents(labels);

    const confidentiality = SafetyLabel.leastUpperBound(confidentialityLabels);
    const integrity = SafetyLabel.greatestLowerBound(integrityLabels);

    return new SafetyLabel({ confidentiality, integrity });
  }

  /**
   * Join (⊔): @returns {SafetyLabel} that is equal or less restrictive than any
   * of the passed @param {[SafetyLabel | undefined]} labels. Undefined labels
   * are ignored. If all labels are undefined, the result is also undefined.
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
  static computeJoinOfLabels(labels: (SafetyLabel | undefined)[]): SafetyLabel {
    const { confidentialityLabels, integrityLabels } =
      SafetyLabel.getLabelComponents(labels);

    const confidentiality = SafetyLabel.greatestLowerBound(
      confidentialityLabels
    );
    const integrity = SafetyLabel.leastUpperBound(integrityLabels);

    return new SafetyLabel({ confidentiality, integrity });
  }

  /**
   * Extract label components, throwing a away all undefined ones.
   * Might return empty lists if there are no defined label components.
   */
  private static getLabelComponents(labels: (SafetyLabel | undefined)[]): {
    confidentialityLabels: SafetyLabelValue[];
    integrityLabels: SafetyLabelValue[];
  } {
    const confidentialityLabels = labels
      .filter(
        (label) => label !== undefined && label.confidentiality !== undefined
      )
      .map((label) => label?.confidentiality) as SafetyLabelValue[];
    const integrityLabels = labels
      .filter((label) => label !== undefined && label.integrity !== undefined)
      .map((label) => label?.integrity) as SafetyLabelValue[];
    return { confidentialityLabels, integrityLabels };
  }

  /**
   * Upper bound of TRUSTED and UNTRUSTED is TRUSTED.
   * Only UNTRUSTED and UNTRUSTED is UNTRUSTED.
   *
   * Returns undefined for an empty list.
   */
  private static leastUpperBound(
    values: SafetyLabelValue[]
  ): SafetyLabelValue | undefined {
    if (values.length === 0) return undefined;
    return values.reduce((a, b) => {
      return a === SafetyLabelValue.TRUSTED || b === SafetyLabelValue.TRUSTED
        ? SafetyLabelValue.TRUSTED
        : SafetyLabelValue.UNTRUSTED;
    });
  }

  /**
   * Lower bound of TRUSTED and UNTRUSTED is UNTRUSTED.
   * Only TRUSTED and TRUSTED is TRUSTED.
   *
   * Returns undefined for an empty list.
   */
  private static greatestLowerBound(
    values: SafetyLabelValue[]
  ): SafetyLabelValue | undefined {
    if (values.length === 0) return undefined;
    return values.reduce((a, b) => {
      return a === SafetyLabelValue.TRUSTED && b === SafetyLabelValue.TRUSTED
        ? SafetyLabelValue.TRUSTED
        : SafetyLabelValue.UNTRUSTED;
    });
  }

  /**
   * Compare with other label.
   *
   * @param {SafetyLabel} other label
   * @returns {Boolean} true if the labels are equal
   */
  equalsTo(other: SafetyLabel): boolean {
    return (
      this.confidentiality === other.confidentiality &&
      this.integrity === other.integrity
    );
  }

  /**
   * Checks whether the label can flow to the destination label.
   * Flow between undetermined labels is always allowed.
   *
   * @param {SafetyLabel} destinationLabel label to flow to
   * @returns {Boolean} true if the label can flow to the destination label
   */
  canFlowTo(destinationLabel: SafetyLabel | undefined): boolean {
    const join = SafetyLabel.computeJoinOfLabels([this, destinationLabel]);
    return (
      (this.confidentiality === undefined ||
        this.confidentiality === join.confidentiality) &&
      (this.integrity === undefined || this.integrity === join.integrity)
    );
  }

  /**
   * Convert label to human-readable string.
   *
   * @param {SafetyLabel} label
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

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
  public readonly value: SafetyLabelValue | undefined;

  /**
   * @param {SafetyLabelValues|SafetyLabel} value SafetyLabel to copy
   *   or SafetyLabelValues to create a new label
   */
  constructor(value: SafetyLabel | SafetyLabelValue | undefined = undefined) {
    this.value = value instanceof SafetyLabel ? value.value : value;
  }

  /**
   * Meet is the greatest lower bound of the @property {[SafetyLabel]} labels.
   * Flow from any of these labels to the meet is allowed.
   * Use this to compute a label of a node based on its incoming edges.
   * That is, if a node reads from an UNTRUSTED node, it has to be UNTRUSTED.
   */
  static computeMeetOfLabels(labels: (SafetyLabel | undefined)[]): SafetyLabel {
    const definedLabels = labels.filter(
      (label) => label !== undefined && label.value !== undefined
    ) as SafetyLabel[];
    if (definedLabels.length === 0) return new SafetyLabel(undefined);
    return definedLabels.reduce((a, b) =>
      a.value === SafetyLabelValue.TRUSTED &&
      b.value === SafetyLabelValue.TRUSTED
        ? new SafetyLabel(SafetyLabelValue.TRUSTED)
        : new SafetyLabel(SafetyLabelValue.UNTRUSTED)
    );
  }

  /**
   * Join is the least upper bound of the @property {[SafetyLabel]} labels.
   * Flow to any of these labels from the join is allowed.
   * Use this to compute a label of a node based on its outgoing edges.
   * That is, if a node writes to a TRUSTED node, it has to be TRUSTED.
   */
  static computeJoinOfLabels(labels: (SafetyLabel | undefined)[]): SafetyLabel {
    const definedLabels = labels.filter(
      (label) => label !== undefined && label.value !== undefined
    ) as SafetyLabel[];
    if (definedLabels.length === 0) return new SafetyLabel(undefined);
    return definedLabels.reduce((a, b) =>
      a.value === SafetyLabelValue.TRUSTED ||
      b.value === SafetyLabelValue.TRUSTED
        ? new SafetyLabel(SafetyLabelValue.TRUSTED)
        : new SafetyLabel(SafetyLabelValue.UNTRUSTED)
    );
  }

  /**
   * Compare with other label.
   *
   * @param {SafetyLabel} other label
   * @returns {Boolean} true if the labels are equal
   */
  equalsTo(other: SafetyLabel): boolean {
    return this.value === other.value;
  }

  /**
   * Checks whether the label can flow to the destination label.
   * Flow between undetermined labels is always allowed.
   *
   * @param {SafetyLabel} destinationLabel label to flow to
   * @returns {Boolean} true if the label can flow to the destination label
   */
  canFlowTo(destinationLabel: SafetyLabel | undefined): boolean {
    if (this.value === undefined) return true;
    return this.equalsTo(
      SafetyLabel.computeJoinOfLabels([this, destinationLabel])
    );
  }

  /**
   * Convert label to human-readable string.
   *
   * @param {SafetyLabel} label
   * @returns {String} human-readable string
   */
  toString(): string | undefined {
    return this.value === undefined
      ? "UNDETERMINED"
      : mapLabelToString.get(this.value);
  }
}

/**
 * Returns as much of leading characters from the `value` as would fit together with the key into
 * `limitBytes` with utf8 encoding.
 */
export function truncateValueForUtf8(
  key: string,
  value: string,
  limitBytes: number
): string {
  const getUtf8NumBytes = (value: string) =>
    new TextEncoder().encode(value).length;

  // Binary search the cut point.
  let startInd = 0;
  let endInd = value.length - 1;
  let leftOverIndex;
  while (startInd <= endInd) {
    const mid = Math.floor((startInd + endInd) / 2);
    const candidate = value.slice(0, mid + 1);
    const numBytes = getUtf8NumBytes(key + candidate);
    if (numBytes == limitBytes) {
      return candidate;
    } else if (numBytes < limitBytes) {
      // There may be more space left.
      startInd = mid + 1;
      leftOverIndex = startInd;
    } else {
      // Overrun.
      endInd = mid - 1;
      leftOverIndex = endInd;
    }
  }

  return value.slice(0, leftOverIndex);
}

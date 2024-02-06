export function getDate(now: Date): string {
  return `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
}

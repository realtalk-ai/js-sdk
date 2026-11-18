const warnedNames = new Set<string>();

export function warnDeprecated(name: string, message: string): void {
  if (warnedNames.has(name)) return;
  warnedNames.add(name);
  console.warn(`[realtalk] deprecated: ${message}`);
}

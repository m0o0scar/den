function normalizePlatform(platform: string | null | undefined): string {
  return platform?.trim().toLowerCase() || '';
}

export function platformUsesMetaShortcuts(platform: string | null | undefined): boolean {
  const normalizedPlatform = normalizePlatform(platform);
  return normalizedPlatform.includes('mac');
}

export function isWindowsPlatform(platform: string | null | undefined): boolean {
  return normalizePlatform(platform).includes('win');
}

export function isPrimaryShortcutModifierPressed(
  event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey'>,
  platform: string | null | undefined,
): boolean {
  return platformUsesMetaShortcuts(platform) ? event.metaKey : event.ctrlKey;
}

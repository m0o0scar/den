export function platformUsesMetaShortcuts(platform: string | null | undefined): boolean {
  const normalizedPlatform = platform?.trim().toLowerCase() || '';
  return normalizedPlatform.includes('mac');
}

export function isPrimaryShortcutModifierPressed(
  event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey'>,
  platform: string | null | undefined,
): boolean {
  return platformUsesMetaShortcuts(platform) ? event.metaKey : event.ctrlKey;
}

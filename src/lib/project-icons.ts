export const DEFAULT_PROJECT_ICON_PATH = '/default_project_icon.png';

export function getProjectIconUrl(iconPath?: string | null): string {
  if (!iconPath) {
    return DEFAULT_PROJECT_ICON_PATH;
  }

  return `/api/file-thumbnail?path=${encodeURIComponent(iconPath)}`;
}

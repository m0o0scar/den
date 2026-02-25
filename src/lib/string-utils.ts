export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const toKebabCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

export const toPascalCase = (value: string): string =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => (segment[0] ? segment[0].toUpperCase() + segment.slice(1) : ''))
    .join('');

export const uniqueStrings = (items: string[]): string[] => Array.from(new Set(items));

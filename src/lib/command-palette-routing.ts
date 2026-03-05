export type CommandPaletteRepoNavigation = {
  method: 'push' | 'replace';
  href: string;
};

type CommandPaletteRepoNavigationArgs = {
  pathname: string;
  search?: string;
  repoPath: string;
};

function toQueryString(search: string | undefined): string {
  if (!search) return '';
  return search.startsWith('?') ? search.slice(1) : search;
}

export function buildCommandPaletteRepoNavigation({
  pathname,
  search,
  repoPath,
}: CommandPaletteRepoNavigationArgs): CommandPaletteRepoNavigation {
  if (pathname === '/new') {
    const params = new URLSearchParams(toQueryString(search));
    params.set('repo', repoPath);
    return {
      method: 'replace',
      href: `/new?${params.toString()}`,
    };
  }

  if (pathname.startsWith('/git')) {
    return {
      method: 'push',
      href: `/git?path=${encodeURIComponent(repoPath)}`,
    };
  }

  if (pathname === '/' || pathname.startsWith('/session/')) {
    return {
      method: 'push',
      href: `/new?repo=${encodeURIComponent(repoPath)}`,
    };
  }

  return {
    method: 'push',
    href: `/new?repo=${encodeURIComponent(repoPath)}`,
  };
}

import { resolveCanonicalProjectReference } from './project-client.ts';
import { getProjects } from './store.ts';

export function resolveNewSessionProjectReference(projectReference?: string | null): string | null {
  return resolveCanonicalProjectReference(getProjects(), projectReference);
}

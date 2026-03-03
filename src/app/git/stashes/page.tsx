import type { Metadata } from 'next';
import { getRepoFolderName } from '@/lib/utils';
import StashesContentWrapper from './stashes-content';

type PageProps = {
    searchParams: Promise<{ path?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
    const { path: repoPath } = await searchParams;
    const repoName = repoPath ? getRepoFolderName(repoPath) : 'Workspace';
    return { title: { absolute: `${repoName} | Stashes` } };
}

export default function WorkspaceStashesPage() {
    return <StashesContentWrapper />;
}

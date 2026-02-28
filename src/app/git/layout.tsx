import { Sidebar } from '@/components/layout/sidebar';
import { Suspense } from 'react';
import { WorkspaceRepoOpenTracker } from '@/components/workspace-repo-open-tracker';
import { getSettings } from '@/lib/store';

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const sidebarCollapsed = getSettings().sidebarCollapsed ?? false;

    return (
        <div className="flex min-h-[calc(100vh-theme(spacing.16))] max-h-screen bg-white dark:bg-gray-900">
            <Suspense fallback={null}>
                <WorkspaceRepoOpenTracker />
            </Suspense>
            <Suspense fallback={<div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} border-r border-gray-200 dark:border-gray-800 min-h-screen bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-center`}><span className="loading loading-spinner"></span></div>}>
                <Sidebar initialCollapsed={sidebarCollapsed} />
            </Suspense>
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}

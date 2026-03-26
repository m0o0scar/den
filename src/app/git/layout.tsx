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
    const sidebarShellClass =
        'overflow-hidden rounded-[22px] bg-white/88 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.38)] backdrop-blur dark:bg-slate-950/88 dark:shadow-[0_20px_42px_-26px_rgba(2,6,23,0.82)]';

    return (
        <div className="flex h-dvh overflow-hidden gap-3 bg-[#f7f7f6] p-3 dark:bg-[#020617]">
            <Suspense fallback={null}>
                <WorkspaceRepoOpenTracker />
            </Suspense>
            <Suspense fallback={<div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} ${sidebarShellClass} flex items-center justify-center`}><span className="loading loading-spinner"></span></div>}>
                <div className={sidebarShellClass}>
                    <Sidebar initialCollapsed={sidebarCollapsed} className="h-full min-h-0 border-r-0 bg-transparent" />
                </div>
            </Suspense>
            <main className="flex-1 min-w-0 overflow-hidden">
                {children}
            </main>
        </div>
    );
}

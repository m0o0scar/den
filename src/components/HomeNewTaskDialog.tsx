'use client';

import { Bot, CloudDownload, Sparkles, X } from 'lucide-react';

import { getBaseName } from '@/lib/path';
import type { HomeTaskSuggestedProject } from '@/lib/home-task';

type HomeNewTaskProjectChoice = {
  projectPath: string;
  displayLabel: string;
};

export type HomeNewTaskDialogProps = {
  isOpen: boolean;
  description: string;
  attachmentPaths: string[];
  error: string | null;
  isLoadingProjects: boolean;
  isSubmitting: boolean;
  submissionStage: 'idle' | 'analyzing' | 'creating';
  suggestedProjects: HomeTaskSuggestedProject[];
  projectChoices: HomeNewTaskProjectChoice[];
  selectedProjectPath: string;
  onDescriptionChange: (value: string) => void;
  onSelectProjectPath: (projectPath: string) => void;
  onOpenAttachmentBrowser: () => void;
  onRemoveAttachment: (attachmentPath: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const stageLabel: Record<HomeNewTaskDialogProps['submissionStage'], string> = {
  idle: 'Create Task',
  analyzing: 'Analyzing task...',
  creating: 'Creating task...',
};

export function HomeNewTaskDialog({
  isOpen,
  description,
  attachmentPaths,
  error,
  isLoadingProjects,
  isSubmitting,
  submissionStage,
  suggestedProjects,
  projectChoices,
  selectedProjectPath,
  onDescriptionChange,
  onSelectProjectPath,
  onOpenAttachmentBrowser,
  onRemoveAttachment,
  onClose,
  onSubmit,
}: HomeNewTaskDialogProps) {
  if (!isOpen) {
    return null;
  }

  const isChoosingProject = suggestedProjects.length > 0;

  return (
    <div className="fixed inset-0 z-[1004] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#151b26]"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">New Task</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Create a plan-mode task in a prepared workspace without leaving home.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-circle btn-ghost btn-sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 dark:border-white/10 dark:bg-[#0d1117]/50 dark:text-slate-300">
            New tasks created from home always use <span className="font-semibold">Plan</span> mode and <span className="font-semibold">Workspace</span> mode.
          </div>

          {isLoadingProjects ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 dark:border-white/10 dark:bg-[#0d1117]/50 dark:text-slate-300">
              Loading registered projects...
            </div>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-100">
              Task Description
            </span>
            <textarea
              className="h-56 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-relaxed text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-slate-100"
              placeholder="Describe the work for the coding agent..."
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#30363d] dark:bg-[#0d1117]/60">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Attachments</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select files to include with the task context.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#30363d] dark:bg-[#151b26] dark:text-slate-200 dark:hover:bg-[#1d2430]"
                onClick={onOpenAttachmentBrowser}
                disabled={isSubmitting}
              >
                <CloudDownload className="h-4 w-4" />
                Select Attachments
              </button>
            </div>

            <div className="min-h-16 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-[#0d1117]/40">
              {attachmentPaths.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No attachments selected.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {attachmentPaths.map((attachmentPath) => (
                    <span
                      key={attachmentPath}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      title={attachmentPath}
                    >
                      <span className="truncate">{getBaseName(attachmentPath)}</span>
                      <button
                        type="button"
                        className="rounded text-slate-500 transition hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400"
                        onClick={() => onRemoveAttachment(attachmentPath)}
                        disabled={isSubmitting}
                        title="Remove attachment"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isChoosingProject ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-400/30 dark:bg-amber-950/25">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Choose a Project
                  </h4>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                    The background analysis found multiple plausible targets. Pick the project before Palx creates the task.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {suggestedProjects.map((project) => {
                  const isSelected = selectedProjectPath === project.projectPath;
                  return (
                    <button
                      key={project.projectPath}
                      type="button"
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? 'border-amber-500 bg-amber-100/90 dark:border-amber-300 dark:bg-amber-900/40'
                          : 'border-amber-200 bg-white/80 hover:border-amber-300 dark:border-amber-400/20 dark:bg-[#151b26]/70 dark:hover:border-amber-300/40'
                      }`}
                      onClick={() => onSelectProjectPath(project.projectPath)}
                      disabled={isSubmitting}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-900 dark:text-white">{project.displayLabel}</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                          {Math.round(project.confidence * 100)}%
                        </span>
                      </div>
                      {project.rationale ? (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{project.rationale}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-amber-900 dark:text-amber-100">
                  Or choose from all registered projects
                </span>
                <select
                  className="h-11 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-amber-400/20 dark:bg-[#151b26] dark:text-slate-100"
                  value={selectedProjectPath}
                  onChange={(event) => onSelectProjectPath(event.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Select project</option>
                  {projectChoices.map((project) => (
                    <option key={project.projectPath} value={project.projectPath}>
                      {project.displayLabel}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary gap-2"
            onClick={onSubmit}
            disabled={
              isSubmitting
              || description.trim().length === 0
              || (isChoosingProject && !selectedProjectPath)
            }
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : null}
            {stageLabel[submissionStage]}
          </button>
        </div>
      </div>
    </div>
  );
}

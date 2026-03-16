import type { AgentProvider, ModelOption, ReasoningEffort } from './types.ts';

import { normalizeProviderReasoningEffort } from './agent/reasoning.ts';

export const HOME_TASK_PROJECT_CONFIDENCE_THRESHOLD = 0.8;

export type HomeTaskProjectOption = {
  projectPath: string;
  displayLabel: string;
  recentRank: number | null;
};

export type HomeTaskSuggestedProject = {
  projectPath: string;
  displayLabel: string;
  rationale: string;
  confidence: number;
};

export type ParsedProjectRecommendation = {
  selectedProjectPath: string | null;
  needsUserChoice: boolean;
  candidates: Array<{
    projectPath: string;
    confidence: number;
    rationale: string;
  }>;
};

export type ParsedRuntimeRecommendation = {
  model: string | null;
  reasoningEffort?: ReasoningEffort;
  rationale: string;
};

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const attempts = [trimmed];
  const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of fencedMatches) {
    if (match[1]?.trim()) {
      attempts.push(match[1].trim());
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export function buildProjectRecommendationPrompt(input: {
  description: string;
  attachmentPaths: string[];
  projects: HomeTaskProjectOption[];
}): string {
  const projectLines = input.projects.map((project, index) => (
    `${index + 1}. ${JSON.stringify({
      projectPath: project.projectPath,
      displayLabel: project.displayLabel,
      recentRank: project.recentRank,
    })}`
  ));
  const attachmentLines = input.attachmentPaths.length > 0
    ? input.attachmentPaths.map((attachmentPath) => `- ${attachmentPath}`).join('\n')
    : '- None';

  return [
    'Choose the best Palx project for this task.',
    'Only use the provided project list.',
    'If the best project confidence is 0.80 or lower, set needsUserChoice to true.',
    'If the best project confidence is greater than 0.80, set needsUserChoice to false.',
    'Return JSON only with this schema:',
    '{"selectedProjectPath":string|null,"needsUserChoice":boolean,"candidates":[{"projectPath":string,"confidence":number,"rationale":string}]}',
    '',
    'Task description:',
    input.description.trim(),
    '',
    'Attachments:',
    attachmentLines,
    '',
    'Available projects:',
    ...projectLines,
  ].join('\n');
}

export function parseProjectRecommendation(text: string): ParsedProjectRecommendation | null {
  const parsed = parseJsonObject(text);
  if (!parsed) return null;

  const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
  const candidates = rawCandidates
    .map((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return null;
      }

      const projectPath = normalizeString((candidate as Record<string, unknown>).projectPath);
      if (!projectPath) return null;

      return {
        projectPath,
        confidence: clampConfidence((candidate as Record<string, unknown>).confidence),
        rationale: normalizeString((candidate as Record<string, unknown>).rationale),
      };
    })
    .filter((candidate): candidate is ParsedProjectRecommendation['candidates'][number] => Boolean(candidate))
    .sort((left, right) => right.confidence - left.confidence);

  return {
    selectedProjectPath: normalizeString(parsed.selectedProjectPath) || null,
    needsUserChoice: Boolean(parsed.needsUserChoice),
    candidates,
  };
}

export function evaluateProjectRecommendation(input: {
  recommendation: ParsedProjectRecommendation;
  projects: HomeTaskProjectOption[];
}): {
  selectedProjectPath: string | null;
  needsUserChoice: boolean;
  suggestedProjects: HomeTaskSuggestedProject[];
} {
  const projectByPath = new Map(
    input.projects.map((project) => [project.projectPath, project] as const),
  );
  const suggestedProjects = Array.from(new Map(
    input.recommendation.candidates
      .filter((candidate) => projectByPath.has(candidate.projectPath))
      .map((candidate) => [
        candidate.projectPath,
        {
          projectPath: candidate.projectPath,
          displayLabel: projectByPath.get(candidate.projectPath)?.displayLabel || candidate.projectPath,
          rationale: candidate.rationale,
          confidence: candidate.confidence,
        } satisfies HomeTaskSuggestedProject,
      ] as const),
  ).values()).slice(0, 5);

  const suggestedProjectPaths = new Set(suggestedProjects.map((project) => project.projectPath));
  const selectedProjectPath = projectByPath.has(input.recommendation.selectedProjectPath || '')
    ? input.recommendation.selectedProjectPath
    : (suggestedProjects[0]?.projectPath ?? null);

  if (input.projects.length <= 1) {
    return {
      selectedProjectPath: selectedProjectPath ?? input.projects[0]?.projectPath ?? null,
      needsUserChoice: false,
      suggestedProjects,
    };
  }

  const selectedConfidence = selectedProjectPath && suggestedProjectPaths.has(selectedProjectPath)
    ? (suggestedProjects.find((project) => project.projectPath === selectedProjectPath)?.confidence ?? 0)
    : 0;

  const isAmbiguous = (
    !selectedProjectPath
    || selectedConfidence <= HOME_TASK_PROJECT_CONFIDENCE_THRESHOLD
  );

  return {
    selectedProjectPath,
    needsUserChoice: isAmbiguous,
    suggestedProjects,
  };
}

export function buildRuntimeRecommendationPrompt(input: {
  description: string;
  attachmentPaths: string[];
  project: HomeTaskProjectOption;
  provider: AgentProvider;
  modelOptions: ModelOption[];
  savedModelHint?: string;
  savedReasoningHint?: ReasoningEffort;
}): string {
  const modelLines = input.modelOptions.map((model) => (
    `- ${JSON.stringify({
      id: model.id,
      label: model.label,
      description: model.description ?? null,
      reasoningEfforts: model.reasoningEfforts ?? [],
    })}`
  ));
  const attachmentLines = input.attachmentPaths.length > 0
    ? input.attachmentPaths.map((attachmentPath) => `- ${attachmentPath}`).join('\n')
    : '- None';

  return [
    `Choose the best ${input.provider} model for this Palx task.`,
    'Balance task complexity against latency and cost.',
    'Only use a reasoning effort that is supported by the chosen model. Use null when unsupported or unnecessary.',
    'Return JSON only with this schema:',
    '{"model":string|null,"reasoningEffort":string|null,"rationale":string}',
    '',
    `Project: ${input.project.displayLabel}`,
    `Project path: ${input.project.projectPath}`,
    `Provider: ${input.provider}`,
    `Saved model hint: ${input.savedModelHint || 'None'}`,
    `Saved reasoning hint: ${input.savedReasoningHint || 'None'}`,
    '',
    'Task description:',
    input.description.trim(),
    '',
    'Attachments:',
    attachmentLines,
    '',
    'Available models:',
    ...modelLines,
  ].join('\n');
}

export function parseRuntimeRecommendation(text: string): ParsedRuntimeRecommendation | null {
  const parsed = parseJsonObject(text);
  if (!parsed) return null;

  return {
    model: normalizeString(parsed.model) || null,
    reasoningEffort: (normalizeString(parsed.reasoningEffort) || undefined) as ReasoningEffort | undefined,
    rationale: normalizeString(parsed.rationale),
  };
}

export function resolveRuntimeRecommendation(input: {
  provider: AgentProvider;
  modelOptions: ModelOption[];
  defaultModel?: string | null;
  savedModelHint?: string;
  savedReasoningHint?: ReasoningEffort;
  recommendation: ParsedRuntimeRecommendation | null;
}): {
  model: string | null;
  reasoningEffort?: ReasoningEffort;
} {
  const modelOptionsById = new Map(
    input.modelOptions.map((option) => [option.id, option] as const),
  );
  const fallbackModel = [
    input.savedModelHint,
    input.defaultModel,
    input.modelOptions[0]?.id,
  ].find((value): value is string => Boolean(value && modelOptionsById.has(value)));
  const recommendedModel = input.recommendation?.model
    && modelOptionsById.has(input.recommendation.model)
    ? input.recommendation.model
    : null;
  const model = recommendedModel || fallbackModel || null;

  if (!model) {
    return { model: null };
  }

  const reasoningOptions = modelOptionsById.get(model)?.reasoningEfforts ?? [];
  if (reasoningOptions.length === 0) {
    return { model };
  }

  const recommendedReasoning = normalizeProviderReasoningEffort(
    input.provider,
    input.recommendation?.reasoningEffort,
  );
  if (recommendedReasoning && reasoningOptions.includes(recommendedReasoning)) {
    return {
      model,
      reasoningEffort: recommendedReasoning,
    };
  }

  const savedReasoning = normalizeProviderReasoningEffort(
    input.provider,
    input.savedReasoningHint,
  );
  if (savedReasoning && reasoningOptions.includes(savedReasoning)) {
    return {
      model,
      reasoningEffort: savedReasoning,
    };
  }

  return { model };
}

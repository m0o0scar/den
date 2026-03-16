import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateProjectRecommendation,
  parseProjectRecommendation,
  parseRuntimeRecommendation,
  resolveRuntimeRecommendation,
  type HomeTaskProjectOption,
} from './home-task.ts';

describe('home task recommendation helpers', () => {
  const projects: HomeTaskProjectOption[] = [
    {
      projectPath: '/work/apps/alpha',
      displayLabel: 'Alpha',
      recentRank: 1,
    },
    {
      projectPath: '/work/apps/beta',
      displayLabel: 'Beta',
      recentRank: 2,
    },
  ];

  it('parses project recommendations from fenced JSON and selects confident matches', () => {
    const parsed = parseProjectRecommendation(`
\`\`\`json
{
  "selectedProjectPath": "/work/apps/alpha",
  "needsUserChoice": false,
  "candidates": [
    {
      "projectPath": "/work/apps/alpha",
      "confidence": 0.91,
      "rationale": "Matches the Alpha app billing workflow."
    },
    {
      "projectPath": "/work/apps/beta",
      "confidence": 0.22,
      "rationale": "Less relevant."
    }
  ]
}
\`\`\`
`);

    assert.ok(parsed);
    assert.equal(parsed.selectedProjectPath, '/work/apps/alpha');

    const evaluated = evaluateProjectRecommendation({
      recommendation: parsed,
      projects,
    });

    assert.equal(evaluated.needsUserChoice, false);
    assert.equal(evaluated.selectedProjectPath, '/work/apps/alpha');
    assert.deepStrictEqual(evaluated.suggestedProjects[0], {
      projectPath: '/work/apps/alpha',
      displayLabel: 'Alpha',
      rationale: 'Matches the Alpha app billing workflow.',
      confidence: 0.91,
    });
  });

  it('keeps ambiguous recommendations in manual-choice mode', () => {
    const parsed = parseProjectRecommendation(JSON.stringify({
      selectedProjectPath: '/work/apps/alpha',
      needsUserChoice: false,
      candidates: [
        {
          projectPath: '/work/apps/alpha',
          confidence: 0.58,
          rationale: 'Could be Alpha.',
        },
        {
          projectPath: '/work/apps/beta',
          confidence: 0.54,
          rationale: 'Could also be Beta.',
        },
      ],
    }));

    assert.ok(parsed);

    const evaluated = evaluateProjectRecommendation({
      recommendation: parsed,
      projects,
    });

    assert.equal(evaluated.needsUserChoice, true);
    assert.equal(evaluated.selectedProjectPath, '/work/apps/alpha');
    assert.equal(evaluated.suggestedProjects.length, 2);
  });

  it('auto-selects when selected project confidence is above eighty percent', () => {
    const parsed = parseProjectRecommendation(JSON.stringify({
      selectedProjectPath: '/work/apps/alpha',
      needsUserChoice: true,
      candidates: [
        {
          projectPath: '/work/apps/alpha',
          confidence: 0.81,
          rationale: 'Alpha owns this task.',
        },
        {
          projectPath: '/work/apps/beta',
          confidence: 0.79,
          rationale: 'Beta is plausible but weaker.',
        },
      ],
    }));

    assert.ok(parsed);

    const evaluated = evaluateProjectRecommendation({
      recommendation: parsed,
      projects,
    });

    assert.equal(evaluated.needsUserChoice, false);
    assert.equal(evaluated.selectedProjectPath, '/work/apps/alpha');
  });

  it('falls back to supported runtime settings when recommendation output is partial', () => {
    const runtimeRecommendation = parseRuntimeRecommendation(JSON.stringify({
      model: 'gpt-5.4',
      reasoningEffort: 'xhigh',
      rationale: 'This task needs deeper reasoning.',
    }));

    assert.ok(runtimeRecommendation);

    const resolved = resolveRuntimeRecommendation({
      provider: 'codex',
      modelOptions: [
        {
          id: 'gpt-5.4',
          label: 'GPT-5.4',
          reasoningEfforts: ['low', 'medium', 'high'],
        },
      ],
      defaultModel: 'gpt-5.4',
      savedReasoningHint: 'medium',
      recommendation: runtimeRecommendation,
    });

    assert.deepStrictEqual(resolved, {
      model: 'gpt-5.4',
      reasoningEffort: 'medium',
    });
  });
});

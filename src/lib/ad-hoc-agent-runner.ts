import { getAgentAdapter } from './agent/providers/index.ts';
import { normalizeProviderReasoningEffort } from './agent/reasoning.ts';

import type { AgentProvider, ChatStreamEvent, ReasoningEffort } from './types.ts';

type AssistantMessageEntry = {
  order: number;
  text: string;
};

class AssistantTextCollector {
  private threadId: string | null = null;
  private readonly assistantMessages = new Map<string, AssistantMessageEntry>();
  private nextOrder = 0;

  applyEvent(event: ChatStreamEvent) {
    switch (event.type) {
      case 'thread_ready':
        this.threadId = event.threadId;
        return;
      case 'agent_message_delta':
        this.upsertAssistantMessage(event.itemId, (entry) => ({
          order: entry?.order ?? this.nextOrder++,
          text: `${entry?.text ?? ''}${event.delta}`,
        }));
        return;
      case 'item_completed': {
        const item = event.item;
        if (item.type !== 'agentMessage' || typeof item.id !== 'string') {
          return;
        }

        this.upsertAssistantMessage(item.id, (entry) => ({
          order: entry?.order ?? this.nextOrder++,
          text: typeof item.text === 'string' ? item.text : (entry?.text ?? ''),
        }));
        return;
      }
      default:
        return;
    }
  }

  private upsertAssistantMessage(
    itemId: string,
    updater: (entry: AssistantMessageEntry | undefined) => AssistantMessageEntry,
  ) {
    this.assistantMessages.set(itemId, updater(this.assistantMessages.get(itemId)));
  }

  getResult() {
    const assistantText = [...this.assistantMessages.values()]
      .sort((left, right) => left.order - right.order)
      .map((entry) => entry.text.trim())
      .filter(Boolean)
      .join('\n\n')
      .trim();

    return {
      threadId: this.threadId,
      assistantText,
    };
  }
}

export type RunAdHocAgentTextInput = {
  provider: AgentProvider;
  workspacePath: string;
  message: string;
  model?: string | null;
  reasoningEffort?: ReasoningEffort | null;
  signal?: AbortSignal;
};

export type RunAdHocAgentTextResult = {
  threadId: string | null;
  assistantText: string;
};

export async function runAdHocAgentText({
  provider,
  workspacePath,
  message,
  model,
  reasoningEffort,
  signal,
}: RunAdHocAgentTextInput): Promise<RunAdHocAgentTextResult> {
  const collector = new AssistantTextCollector();
  const adapter = getAgentAdapter(provider);

  await adapter.streamChat({
    workspacePath,
    threadId: null,
    message,
    model: model?.trim() || null,
    reasoningEffort: normalizeProviderReasoningEffort(provider, reasoningEffort) ?? null,
  }, (event) => {
    collector.applyEvent(event);
  }, signal);

  const result = collector.getResult();
  if (!result.assistantText) {
    throw new Error('Agent did not return a usable response.');
  }

  return result;
}

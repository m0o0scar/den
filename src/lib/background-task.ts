export type BackgroundTask = () => Promise<void> | void;
export type BackgroundTaskErrorHandler = (error: unknown) => void;

export function runInBackground(task: BackgroundTask, onError?: BackgroundTaskErrorHandler): void {
  globalThis.setTimeout(() => {
    try {
      void Promise.resolve(task()).catch((error) => {
        onError?.(error);
      });
    } catch (error) {
      onError?.(error);
    }
  }, 0);
}

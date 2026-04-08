export async function waitForCancelledSessionRunCleanup(runPromise: Promise<void>): Promise<void> {
  try {
    await runPromise;
  } catch {
    // Cancellation can surface as a rejected run promise.
    // The caller already marked the session cancelled, so cleanup
    // should not bubble another error back to the UI.
  }
}

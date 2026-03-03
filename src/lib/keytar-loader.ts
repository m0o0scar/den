export type KeytarModule = {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

type CreateKeytarLoaderOptions = {
  logLabel: string;
  loadModule?: () => Promise<KeytarModule>;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createKeytarLoader(options: CreateKeytarLoaderOptions) {
  const { logLabel } = options;
  const loadModule = options.loadModule ?? (async () => {
    const keytarPackage = await import('keytar');
    return (keytarPackage.default ?? keytarPackage) as KeytarModule;
  });

  let keytarPromise: Promise<KeytarModule | null> | null = null;
  let keytarUnavailableReason: string | null = null;
  let didLogKeytarWarning = false;

  const keytarUnavailableMessage = (): string => {
    if (keytarUnavailableReason) {
      return `Secure credential storage is unavailable: ${keytarUnavailableReason}`;
    }
    return 'Secure credential storage is unavailable in this runtime.';
  };

  const loadKeytar = async (): Promise<KeytarModule | null> => {
    if (!keytarPromise) {
      keytarPromise = loadModule().catch((error: unknown) => {
        keytarUnavailableReason = toErrorMessage(error);
        if (!didLogKeytarWarning) {
          didLogKeytarWarning = true;
          console.warn(`[${logLabel}] ${keytarUnavailableMessage()}`);
        }
        return null;
      });
    }

    return keytarPromise;
  };

  const requireKeytar = async (): Promise<KeytarModule> => {
    const keytar = await loadKeytar();
    if (!keytar) {
      throw new Error(keytarUnavailableMessage());
    }
    return keytar;
  };

  return {
    loadKeytar,
    requireKeytar,
  };
}

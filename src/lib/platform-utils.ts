import os from 'os';
import path from 'path';

export function getAppDataDir(): string {
  const homeDir = os.homedir();

  if (process.platform === 'darwin') {
    return path.join(/* turbopackIgnore: true */ homeDir, 'Library', 'Application Support', 'trident');
  }

  if (process.platform === 'win32') {
    return path.join(
      /* turbopackIgnore: true */ process.env.APPDATA
        || path.join(/* turbopackIgnore: true */ homeDir, 'AppData', 'Roaming'),
      'trident',
    );
  }

  // Linux: ~/.config/trident
  return path.join(
    /* turbopackIgnore: true */ process.env.XDG_CONFIG_HOME || path.join(/* turbopackIgnore: true */ homeDir, '.config'),
    'trident',
  );
}

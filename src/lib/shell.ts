export type ShellDialect = 'posix' | 'powershell';

export const quoteShellArg = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

export const quotePowerShellArg = (value: string): string => `'${value.replace(/'/g, "''")}'`;

export const quoteShellArgForDialect = (value: string, dialect: ShellDialect): string =>
  dialect === 'powershell' ? quotePowerShellArg(value) : quoteShellArg(value);

export const buildCdCommand = (directoryPath: string, dialect: ShellDialect): string => {
  const quotedPath = quoteShellArgForDialect(directoryPath, dialect);
  return dialect === 'powershell'
    ? `Set-Location -LiteralPath ${quotedPath}`
    : `cd ${quotedPath}`;
};

export const wrapCodexCommandWithApiKeyLogin = (command: string, dialect: ShellDialect): string => {
  if (dialect === 'powershell') {
    return `if ($env:OPENAI_API_KEY) { $env:OPENAI_API_KEY | codex login --with-api-key; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }; ${command}`;
  }

  return `if [ -n "$OPENAI_API_KEY" ]; then printenv OPENAI_API_KEY | codex login --with-api-key || exit 1; fi; ${command}`;
};

export const buildPromptArgumentFromFile = (filePath: string, dialect: ShellDialect): string => {
  const quotedPath = quoteShellArgForDialect(filePath, dialect);
  return dialect === 'powershell'
    ? ` "$(Get-Content -Raw -LiteralPath ${quotedPath})"`
    : ` "$(cat ${quotedPath})"`;
};

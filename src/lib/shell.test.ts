import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import {
    buildCdCommand,
    buildPromptArgumentFromFile,
    quotePowerShellArg,
    quoteShellArg,
    quoteShellArgForDialect,
    wrapCodexCommandWithApiKeyLogin,
} from './shell.ts';

describe('quoteShellArg', () => {
    it('quotes a simple string', () => {
        assert.strictEqual(quoteShellArg('foo'), "'foo'");
    });

    it('quotes a string with spaces', () => {
        assert.strictEqual(quoteShellArg('foo bar'), "'foo bar'");
    });

    it('quotes a string with single quotes', () => {
        assert.strictEqual(quoteShellArg("don't"), "'don'\\''t'");
    });

    it('quotes an empty string', () => {
        assert.strictEqual(quoteShellArg(''), "''");
    });

    it('quotes a string with multiple single quotes', () => {
        assert.strictEqual(quoteShellArg("it's a 'test'"), "'it'\\''s a '\\''test'\\'''");
    });
});

describe('quotePowerShellArg', () => {
    it('quotes a simple string', () => {
        assert.strictEqual(quotePowerShellArg('foo'), "'foo'");
    });

    it('quotes a string with single quotes', () => {
        assert.strictEqual(quotePowerShellArg("don't"), "'don''t'");
    });
});

describe('quoteShellArgForDialect', () => {
    it('uses POSIX quoting for posix dialect', () => {
        assert.strictEqual(quoteShellArgForDialect("don't", 'posix'), "'don'\\''t'");
    });

    it('uses PowerShell quoting for powershell dialect', () => {
        assert.strictEqual(quoteShellArgForDialect("don't", 'powershell'), "'don''t'");
    });
});

describe('buildCdCommand', () => {
    it('builds a POSIX cd command', () => {
        assert.strictEqual(buildCdCommand('/tmp/my repo', 'posix'), "cd '/tmp/my repo'");
    });

    it('builds a PowerShell Set-Location command', () => {
        assert.strictEqual(
            buildCdCommand("C:\\Users\\foo\\my repo", 'powershell'),
            "Set-Location -LiteralPath 'C:\\Users\\foo\\my repo'",
        );
    });
});

describe('wrapCodexCommandWithApiKeyLogin', () => {
    it('builds POSIX login wrapper', () => {
        assert.strictEqual(
            wrapCodexCommandWithApiKeyLogin('codex resume --last', 'posix'),
            'if [ -n "$OPENAI_API_KEY" ]; then printenv OPENAI_API_KEY | codex login --with-api-key || exit 1; fi; codex resume --last',
        );
    });

    it('builds PowerShell login wrapper', () => {
        assert.strictEqual(
            wrapCodexCommandWithApiKeyLogin('codex resume --last', 'powershell'),
            'if ($env:OPENAI_API_KEY) { $env:OPENAI_API_KEY | codex login --with-api-key; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }; codex resume --last',
        );
    });
});

describe('buildPromptArgumentFromFile', () => {
    it('builds POSIX file substitution argument', () => {
        assert.strictEqual(
            buildPromptArgumentFromFile('/tmp/prompt.txt', 'posix'),
            ` "$(cat '/tmp/prompt.txt')"`,
        );
    });

    it('builds PowerShell file substitution argument', () => {
        assert.strictEqual(
            buildPromptArgumentFromFile("C:\\temp\\prompt.txt", 'powershell'),
            ` "$(Get-Content -Raw -LiteralPath 'C:\\temp\\prompt.txt')"`,
        );
    });
});

# Contributing to Manel

Thank you for your interest in contributing to Manel. This document describes the standards and processes for contributing to the project.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Reporting bugs](#reporting-bugs)
- [Suggesting features](#suggesting-features)
- [Development environment](#development-environment)
- [Project structure](#project-structure)
- [Available scripts](#available-scripts)
- [Code standards](#code-standards)
- [PR process](#pr-process)
- [Commit guide](#commit-guide)
- [Documentation](#documentation)

## Code of conduct

This project is governed by a code of conduct based on mutual respect. Discrimination, harassment, or any conduct that creates a hostile environment is not tolerated. By participating, you agree to maintain a collaborative and professional environment.

## Reporting bugs

Before reporting a bug:

1. Check that there isn't already an open issue for the same problem.
2. Make sure you are using the latest version.
3. Check if the problem persists after restarting the application.

When reporting, include:

- **Descriptive title**: Summarize the problem in one line.
- **Steps to reproduce**: Exact sequence from a known initial state.
- **Expected behavior**: What should happen.
- **Actual behavior**: What actually happens.
- **Environment**:
  - Operating system and version.
  - Manel version (`manel --version`).
  - Node.js and npm version.
- **Logs**: Capture terminal output with `--verbose`.
- **Evidence**: Screenshots or video if applicable.

```
### Bug: [Brief title]

**Steps:**
1. Run `manel scan`
2. ...

**Expected:** ...
**Actual:** ...

**Environment:**
- OS: Ubuntu 24.04
- Manel: 1.0.0
- Node: 22.x
```

## Suggesting features

Before proposing a new feature:

1. Check existing issues to avoid duplicates.
2. Consider if the feature is of general interest or very specific to your use case.
3. Think about how it would integrate with the current architecture (CLI + Core).

When proposing, include:

- **Problem it solves**: What need does it address?
- **Expected behavior**: Describe the feature in detail.
- **Alternatives considered**: If there are other ways to solve it.
- **Impact**: Does it affect performance, security, compatibility?

```
### Feature: [Name]

**Problem:** ...
**Proposed solution:** ...
**Alternatives:** ...
```

## Development environment

### Requirements

- Node.js 18 or higher (20+ recommended).
- npm 9+ (or yarn/pnpm).
- Git.
- Linux or macOS (hardening checks only work on Linux).

### Initial setup

```bash
git clone https://github.com/devcristianlopez/manel.git
cd manel
npm install
npm run build:cli
```

### Running in development

```bash
# Build and run
npm run build:cli
node bin/manel-cli.js scan

# Or use npm link to have `manel` available globally
npm run global-link
manel scan
```

### Running tests

```bash
npm test                      # All tests
npx vitest run                # Alternative
npx vitest --watch            # Watch mode
npm run test:coverage         # With coverage
```

### Type checking

```bash
npm run lint                  # Runs tsc --noEmit
```

## Project structure

```
manel/
├── bin/
│   └── manel-cli.js           # Entry point (Node.js)
├── src/
│   ├── cli/                   # CLI framework
│   │   ├── commands/          # Command implementations
│   │   │   ├── status.ts      # `manel status`
│   │   │   ├── scan.ts        # `manel scan`
│   │   │   ├── vulnerabilities.ts  # `manel vulnerabilities`
│   │   │   ├── hardening.ts   # `manel hardening`
│   │   │   ├── score.ts       # `manel score`
│   │   │   ├── updates.ts     # `manel updates`
│   │   │   └── schema.ts      # `manel schema`
│   │   ├── output/            # Output formatters
│   │   │   ├── table-formatter.ts
│   │   │   ├── json-formatter.ts
│   │   │   ├── sarif-formatter.ts
│   │   │   └── ndjson-formatter.ts
│   │   ├── flags.ts           # Shared flags
│   │   ├── errors.ts          # Error handling
│   │   └── index.ts           # Main entry point
│   ├── core/                  # Business logic
│   │   ├── scanner/           # Software detection
│   │   ├── security/          # Security engine
│   │   ├── update-engine/     # Version checking
│   │   ├── database/          # SQLite persistence
│   │   └── index.ts           # Barrel export
│   └── shared/
│       └── types.ts           # Shared types
├── package.json
├── tsconfig.json              # Base TypeScript config
├── tsconfig.cli.json          # TypeScript config for CLI
├── vitest.config.ts           # Test config
└── CONTRIBUTING.md
```

### Key modules

| Module | Responsibility |
|--------|----------------|
| `cli/commands/` | One file per command, each exports `registerXCommand()` |
| `cli/output/` | One formatter per format (table, json, sarif, ndjson) |
| `core/scanner/` | Software detection via `execSync()` |
| `core/security/` | Vulnerability and hardening queries |
| `core/update-engine/` | Latest version checking |
| `core/database/` | SQLite operations |
| `shared/types.ts` | Shared TypeScript types |

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run build:cli` | Compile TypeScript to JavaScript |
| `npm run global-link` | Install `manel` globally via npm link |
| `npm test` | Run test suite (Vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with coverage report |
| `npm run lint` | TypeScript type checking |

## Code standards

### TypeScript

- **strict mode**: The project uses `strict: false` in `tsconfig.cli.json` for compatibility. If contributing, avoid `any` when possible.
- **Explicit typing**: Public functions must have explicit return types.
- **Shared types**: Types used by CLI and Core go in `src/shared/types.ts`.
- **Null safety**: Prefer `T | null` over `T | undefined`. Use `??` instead of `||`.

### Style

- **Indentation**: 2 spaces.
- **Quotes**: Single quotes (`'`) in TypeScript/JavaScript.
- **Semicolons**: Required at the end of each statement.
- **Naming**: `camelCase` for variables and functions, `PascalCase` for classes/types, `UPPER_CASE` for constants.
- **Line limit**: 120 characters.

### Commander.js

- Each command is registered with `registerXCommand(program)`.
- Use options from `flags.ts` for shared flags.
- The handler receives `CommonFlags` as type.
- Returns a numeric exit code (0, 1, 2, 3).

```typescript
// Command pattern example
export function registerMyCommand(program: Command): void {
  program
    .command('my-command')
    .description('Description here')
    .option(...COMMON_OPTIONS)
    .option(...OUTPUT_OPTIONS)
    .action(async (options: CommonFlags) => {
      await executeMyCommand(options)
    })
}

async function executeMyCommand(options: CommonFlags): Promise<number> {
  // Implementation
  return 0
}
```

### Output Engine

- Each formatter implements `FormatterFn<T>`.
- Use `FormatOptions` to control colors, pretty-print, etc.
- Output goes to stdout, errors to stderr.

### Best practices

- **Pure functions**: Prefer functions without side effects in Core.
- **Error handling**: Use try/catch in command handlers. Never let an exception crash the app.
- **Fetch with timeout**: All HTTP calls must have a timeout (use `AbortController`).
- **Meaningful logs**: Use `console.error` with module prefix for stderr, `console.log` for stdout.
- **Exit codes**: Respect semantic exit codes (0=success, 1=findings, 2=error, 3=invalid input).

## PR process

### Step by step

1. **Fork** the repository (if applicable) or create a branch from `main`.
2. **Create a branch** with a descriptive name:
   - `feat/feature-name`
   - `fix/bug-name`
   - `docs/change-name`
   - `refactor/name`
3. **Develop** following the code standards.
4. **Build** the CLI: `npm run build:cli`
5. **Run the tests**: `npm test`
6. **Check types**: `npm run lint`
7. **Update documentation** if your change affects the API, architecture, or behavior.
8. **Commit** following the commit guide.
9. **Push** to your branch.
10. **Open a Pull Request** against `main`.

### PR template

```markdown
## Description

[Description of the change]

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation
- [ ] Dependencies

## How was it tested?

[Description of tests performed]

## Checklist

- [ ] Code follows project standards
- [ ] `npm run build:cli` ran without errors
- [ ] Tests pass (`npm test`)
- [ ] Type checking OK (`npm run lint`)
- [ ] Documentation updated if applicable
- [ ] No new dependencies introduced without review
```

### Review

- A maintainer will review the PR within a reasonable timeframe.
- Changes may be requested. Please respond to comments.
- Once approved, it will be merged into `main`.

## Commit guide

Use descriptive messages in English:

```
feat(scanner): add support for Rust detection
fix(security): handle timeout in OSV query
docs(architecture): update CLI architecture diagram
refactor(score): extract category calculation
```

Recommended format:

```
<type>(<scope>): <description>

- <optional detail>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`.

## Documentation

- **README.md**: General project documentation (installation, usage, commands).
- **ARCHITECTURE.md**: Detailed technical documentation (architecture, types, decisions).
- **CONTRIBUTING.md**: This guide.
- **Code**: Changes that introduce new features or modify existing behavior must include corresponding documentation in the same PR.

## Tests

- Existing tests are in `src/core/__tests__/`, `src/cli/__tests__/`, `src/cli/commands/__tests__/`, and `src/cli/output/__tests__/`.
- If you add a new module, include unit tests.
- For CLI features, prioritize integration tests that verify the output.

### Running specific tests

```bash
# Tests for a specific module
npx vitest run src/core/security
npx vitest run src/cli/commands

# Individual test
npx vitest run src/cli/output/json-formatter.test.ts
```

## Questions

If you have questions, open an issue with the `question` label. For deeper technical discussions, mention the maintainers in the issue.
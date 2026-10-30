import chalk from 'chalk';

export class ReposeanceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1,
    public readonly suggestions: readonly string[] = [],
  ) {
    super(message);
    this.name = 'ReposeanceError';
  }
}

export class ConfigurationError extends ReposeanceError {
  constructor(message: string, suggestions: readonly string[] = []) {
    super(message, 'CONFIG_ERROR', 2, suggestions);
    this.name = 'ConfigurationError';
  }
}

export class RepositoryError extends ReposeanceError {
  constructor(message: string, suggestions: readonly string[] = []) {
    super(message, 'REPO_ERROR', 3, suggestions);
    this.name = 'RepositoryError';
  }
}

export class IndexError extends ReposeanceError {
  constructor(message: string, suggestions: readonly string[] = []) {
    super(message, 'INDEX_ERROR', 4, suggestions);
    this.name = 'IndexError';
  }
}

export class GitError extends ReposeanceError {
  constructor(message: string, suggestions: readonly string[] = []) {
    super(message, 'GIT_ERROR', 5, suggestions);
    this.name = 'GitError';
  }
}

export class LLMError extends ReposeanceError {
  constructor(message: string, suggestions: readonly string[] = []) {
    super(message, 'LLM_ERROR', 6, suggestions);
    this.name = 'LLMError';
  }
}

export class ValidationError extends ReposeanceError {
  constructor(message: string, suggestions: readonly string[] = []) {
    super(message, 'VALIDATION_ERROR', 7, suggestions);
    this.name = 'ValidationError';
  }
}

export function isReposeanceError(error: unknown): error is ReposeanceError {
  return error instanceof ReposeanceError;
}

export function handleError(error: unknown): never {
  if (isReposeanceError(error)) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (error.suggestions.length > 0) {
      console.error(chalk.yellow('\nSuggestions:'));
      for (const suggestion of error.suggestions) {
        console.error(chalk.yellow(`  • ${suggestion}`));
      }
    }
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    console.error(chalk.red(`Unexpected error: ${error.message}`));
    console.error(chalk.gray(error.stack));
  } else {
    console.error(chalk.red(`Unknown error: ${String(error)}`));
  }
  process.exit(1);
  // unreachable but satisfies never return type
  throw new Error('Unreachable');
}
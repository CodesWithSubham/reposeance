import chalk from 'chalk';

export const theme = {
  primary: chalk.hex('#00ff88'),
  secondary: chalk.hex('#8844ff'),
  accent: chalk.hex('#ff4488'),
  warning: chalk.hex('#ffaa00'),
  error: chalk.hex('#ff3333'),
  success: chalk.hex('#00ff88'),
  info: chalk.hex('#44aaff'),
  muted: chalk.hex('#888888'),
  dim: chalk.dim,
  bold: chalk.bold,
  underline: chalk.underline,
  ghost: chalk.hex('#00ff88').bold,
  commit: chalk.hex('#8844ff'),
  file: chalk.hex('#44aaff'),
  line: chalk.hex('#ffaa00'),
  evidence: chalk.hex('#00ff88'),
  inference: chalk.hex('#ff4488'),
};

export function getThemeColors() {
  return {
    primary: '#00ff88',
    secondary: '#8844ff',
    accent: '#ff4488',
    warning: '#ffaa00',
    error: '#ff3333',
    success: '#00ff88',
    info: '#44aaff',
    muted: '#888888',
  };
}

export function styleGhost(text: string): string {
  return theme.ghost(text);
}

export function styleCommit(text: string): string {
  return theme.commit(text);
}

export function styleFile(text: string): string {
  return theme.file(text);
}

export function styleLine(text: string): string {
  return theme.line(text);
}

export function styleEvidence(text: string): string {
  return theme.evidence(text);
}

export function styleInference(text: string): string {
  return theme.inference(text);
}

export function styleWarning(text: string): string {
  return theme.warning(text);
}

export function styleError(text: string): string {
  return theme.error(text);
}

export function styleSuccess(text: string): string {
  return theme.success(text);
}

export function styleInfo(text: string): string {
  return theme.info(text);
}

export function styleMuted(text: string): string {
  return theme.muted(text);
}

export function styleBold(text: string): string {
  return theme.bold(text);
}
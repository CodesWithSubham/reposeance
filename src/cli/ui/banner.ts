import { styleGhost, styleMuted, styleBold, styleFile, styleLine, styleCommit } from './theme';

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗ ███████╗███████╗████████╗██╗███╗   ██╗ ██████╗    ║
║   ██╔══██╗██╔════╝██╔════╝╚══██╔══╝██║████╗  ██║██╔════╝    ║
║   ██████╔╝█████╗  ███████╗   ██║   ██║██╔██╗ ██║██║  ███╗   ║
║   ██╔══██╗██╔══╝  ╚════██║   ██║   ██║██║╚██╗██║██║   ██║   ║
║   ██████╔╝███████╗███████║   ██║   ██║██║ ╚████║╚██████╔╝   ║
║   ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚═╝╚═╝  ╚═══╝ ╚═════╝    ║
║                                                              ║
║        ${styleGhost('Talk to the ghosts of your codebase.')}         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

const MINI_BANNER = `
${styleGhost('▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄')}
${styleGhost('▌')}  ${styleBold('REPOSEANCE')}  ${styleMuted('— Talk to the ghosts of your codebase.')}  ${styleGhost('▐')}
${styleGhost('▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀')}
`;

export function printBanner(): void {
  console.log(BANNER);
}

export function getMiniBanner(): string {
  return MINI_BANNER;
}

export function printMiniBanner(): void {
  console.log(MINI_BANNER);
}

export function printSection(title: string): void {
  console.log();
  console.log(styleBold(`═══ ${title} ═══`));
  console.log();
}

export function printSubsection(title: string): void {
  console.log(styleMuted(`── ${title} ──`));
}

export function printKeyValue(key: string, value: string): void {
  console.log(`  ${styleBold(key)}: ${value}`);
}

export function printList(items: string[], prefix: string = '•'): void {
  for (const item of items) {
    console.log(`  ${styleMuted(prefix)} ${item}`);
  }
}

export function printEvidence(filePath: string, startLine: number, endLine: number): void {
  console.log(`  ${styleFile(filePath)}:${styleLine(String(startLine))}-${styleLine(String(endLine))}`);
}

export function printCommit(shortHash: string, message: string, date: string): void {
  console.log(`  ${styleCommit(shortHash)} ${message} ${styleMuted(date)}`);
}
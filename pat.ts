import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// ─── ANSI Colors ──────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
};

const log = {
  info: (msg: string) => console.log(`${c.cyan}ℹ${c.reset}  ${msg}`),
  success: (msg: string) => console.log(`${c.green}✔${c.reset}  ${msg}`),
  warn: (msg: string) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`),
  error: (msg: string) => console.log(`${c.red}✖${c.reset}  ${msg}`),
  dim: (msg: string) => console.log(`${c.dim}${msg}${c.reset}`),
};

// ─── Config file (stored globally per machine) ────────────────────────────────

const CONFIG_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? "~",
  ".pat"
);
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

interface StoredConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

function readConfig(): StoredConfig | null {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) as StoredConfig;
  } catch {
    return null;
  }
}

function writeConfig(cfg: StoredConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function printBanner() {
  const magenta = "\x1b[35m";
  console.log();
  console.log(`  ${c.cyan}╔════════════════════════════════════════╗${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}██████╗ ${c.green} █████╗ ${c.red}████████╗${c.reset}         ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}██╔══██╗${c.green}██╔══██╗${c.red}╚══██╔══╝${c.reset}         ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}██████╔╝${c.green}███████║${c.red}   ██║${c.reset}            ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}██╔═══╝ ${c.green}██╔══██║${c.red}   ██║${c.reset}            ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}██║     ${c.green}██║  ██║${c.red}   ██║${c.reset} 🐥          ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}╚═╝     ${c.green}╚═╝  ╚═╝${c.red}   ╚═╝${c.reset}            ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}                                          ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.green}Pedro Arantes${c.reset} Tests · ${c.bold}${magenta}Azure OpenAI${c.reset}    ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}╚════════════════════════════════════════╝${c.reset}`);
  console.log();
}

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp() {
  printBanner();
  console.log(`${c.bold}USAGE${c.reset}`);
  console.log(`  pat <command> [options] [files...]`);
  console.log();
  console.log(`${c.bold}COMMANDS${c.reset}`);
  console.log(`  ${c.cyan}setup-api-key${c.reset}          Set your Azure OpenAI credentials`);
  console.log(`  ${c.cyan}show-config${c.reset}            Show current saved credentials`);
  console.log(`  ${c.cyan}generate${c.reset}               Generate tests (default command)`);
  console.log();
  console.log(`${c.bold}OPTIONS${c.reset}`);
  console.log(`  ${c.cyan}--help,    -h${c.reset}          Show this help message`);
  console.log(`  ${c.cyan}--version, -v${c.reset}          Show version`);
  console.log(`  ${c.cyan}--dir,     -d${c.reset}          Target directory (default: ./src)`);
  console.log(`  ${c.cyan}--out,     -o${c.reset}          Output directory (default: <dir>/__tests__)`);
  console.log(`  ${c.cyan}--dry-run${c.reset}              Preview files without generating`);
  console.log(`  ${c.cyan}--force,   -f${c.reset}          Overwrite existing test files`);
  console.log();
  console.log(`${c.bold}EXAMPLES${c.reset}`);
  console.log(`  pat setup-api-key         # configure Azure credentials`);
  console.log(`  pat show-config           # view saved credentials`);
  console.log(`  pat generate              # generate tests for all files in ./src`);
  console.log(`  pat generate src/utils.ts # generate for a single file`);
  console.log(`  pat generate -d src/api   # generate for a specific folder`);
  console.log(`  pat generate --dry-run    # preview without writing files`);
  console.log();
}

// ─── Command: setup-api-key ───────────────────────────────────────────────────

async function cmdSetupApiKey() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, res));

  const existing = readConfig();

  printBanner();
  console.log(`${c.bold}⚙  Azure OpenAI Credentials Setup${c.reset}`);
  console.log(`${c.dim}  Find these in: Azure Portal → Your OpenAI Resource → Keys and Endpoint${c.reset}`);
  if (existing) {
    console.log(`${c.dim}  Press Enter to keep the current value shown in [brackets]${c.reset}`);
  }
  console.log();

  const endpoint = await ask(
    `${c.cyan}  Endpoint URL${c.reset}   ${existing ? c.dim + "[" + existing.endpoint + "]" + c.reset + " " : ""}› `
  );
  const apiKey = await ask(
    `${c.cyan}  API Key${c.reset}       ${existing ? c.dim + "[" + existing.apiKey.slice(0, 8) + "...]" + c.reset + " " : ""}› `
  );
  const deployment = await ask(
    `${c.cyan}  Deployment${c.reset}    ${existing ? c.dim + "[" + existing.deployment + "]" + c.reset + " " : c.dim + "[gpt-4o]" + c.reset + " "}› `
  );
  const apiVersion = await ask(
    `${c.cyan}  API Version${c.reset}   ${existing ? c.dim + "[" + existing.apiVersion + "]" + c.reset + " " : c.dim + "[2024-02-01]" + c.reset + " "}› `
  );

  rl.close();

  const config: StoredConfig = {
    endpoint:   endpoint.trim()   || existing?.endpoint   || "",
    apiKey:     apiKey.trim()     || existing?.apiKey     || "",
    deployment: deployment.trim() || existing?.deployment || "gpt-4o",
    apiVersion: apiVersion.trim() || existing?.apiVersion || "2024-02-01",
  };

  if (!config.endpoint || !config.apiKey) {
    console.log();
    log.error("Endpoint and API Key are required.");
    process.exit(1);
  }

  writeConfig(config);

  console.log();
  log.success(`Credentials saved to ${c.bold}${CONFIG_FILE}${c.reset}`);
  log.info(`Run ${c.bold}pat show-config${c.reset} to verify.`);
  log.info(`Run ${c.bold}pat generate${c.reset} to start generating tests.`);
  console.log();
}

// ─── Command: show-config ─────────────────────────────────────────────────────

function cmdShowConfig() {
  printBanner();
  const cfg = readConfig();

  if (!cfg) {
    log.warn(`No credentials found.`);
    log.info(`Run ${c.bold}pat setup-api-key${c.reset} to configure.`);
    console.log();
    return;
  }

  console.log(`${c.bold}  Saved credentials${c.reset}  ${c.dim}(${CONFIG_FILE})${c.reset}\n`);
  console.log(`  ${c.cyan}Endpoint${c.reset}     ${cfg.endpoint}`);
  console.log(`  ${c.cyan}API Key${c.reset}      ${cfg.apiKey.slice(0, 8)}${"*".repeat(20)}`);
  console.log(`  ${c.cyan}Deployment${c.reset}   ${cfg.deployment}`);
  console.log(`  ${c.cyan}API Version${c.reset}  ${cfg.apiVersion}`);
  console.log();
  log.info(`To update, run: ${c.bold}pat setup-api-key${c.reset}`);
  console.log();
}

// ─── Azure OpenAI client ──────────────────────────────────────────────────────

function createClient(): { client: OpenAI; deployment: string } {
  const cfg = readConfig();

  if (!cfg || !cfg.endpoint || !cfg.apiKey) {
    log.error("No credentials configured.");
    log.info(`Run ${c.bold}pat setup-api-key${c.reset} first.`);
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: `${cfg.endpoint.replace(/\/$/, "")}/openai/deployments/${cfg.deployment}`,
    defaultQuery: { "api-version": cfg.apiVersion },
    defaultHeaders: { "api-key": cfg.apiKey },
  });

  return { client, deployment: cfg.deployment };
}

// ─── File Discovery ───────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(["node_modules", "dist", "__tests__", ".git", "coverage"]);

function findTypeScriptFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".test.tsx") &&
        !entry.name.endsWith(".spec.ts") &&
        !entry.name.endsWith(".spec.tsx") &&
        !entry.name.endsWith(".d.ts")
      ) {
        results.push(fullPath);
      }
    }
  }
  walk(dir);
  return results;
}

function resolveTestPath(sourceFile: string, srcDir: string, outDir: string): string {
  const relative = path.relative(srcDir, sourceFile);
  const baseName = path.basename(relative, path.extname(relative));
  const dirName  = path.dirname(relative);
  const testDir  = path.join(outDir, dirName);
  fs.mkdirSync(testDir, { recursive: true });
  return path.join(testDir, `${baseName}.test.ts`);
}

// ─── Test Generation ──────────────────────────────────────────────────────────

async function generateTests(
  client: OpenAI,
  deployment: string,
  sourceCode: string,
  fileName: string
): Promise<string> {
  const response = await client.chat.completions.create({
    model: deployment,
    temperature: 0.2,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: `You are an expert TypeScript developer. Write comprehensive Jest unit tests.
Rules:
- Use Jest with TypeScript (describe, it, expect)
- Import the module by its relative path from __tests__ folder
- Cover happy paths, edge cases, errors, and boundary values
- Mock external dependencies with jest.mock() when needed
- Return ONLY the test file TypeScript code — no markdown, no explanation`,
      },
      {
        role: "user",
        content: `Generate Jest unit tests for this TypeScript file named "${fileName}":\n\n${sourceCode}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  return content
    .replace(/^```(?:typescript|ts)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function spinner(label: string): () => void {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(`\r${c.cyan}${frames[i++ % frames.length]}${c.reset}  ${label}`);
  }, 80);
  return () => { clearInterval(id); process.stdout.write("\r\x1b[2K"); };
}

// ─── Command: generate ────────────────────────────────────────────────────────

async function cmdGenerate(argv: string[]) {
  let dir = "src";
  let out: string | null = null;
  let dryRun = false;
  let force = false;
  const files: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--dir": case "-d": dir = argv[++i] ?? "src"; break;
      case "--out": case "-o": out = argv[++i] ?? null; break;
      case "--dry-run": dryRun = true; break;
      case "--force": case "-f": force = true; break;
      default: if (!argv[i].startsWith("-")) files.push(argv[i]);
    }
  }

  printBanner();

  const cwd    = process.cwd();
  const srcDir = path.resolve(cwd, dir);
  const outDir = out ? path.resolve(cwd, out) : path.join(srcDir, "__tests__");

  let sourceFiles: string[];
  if (files.length > 0) {
    sourceFiles = files.map((f) => path.resolve(cwd, f));
    const missing = sourceFiles.filter((f) => !fs.existsSync(f));
    if (missing.length > 0) { missing.forEach((f) => log.error(`File not found: ${f}`)); process.exit(1); }
  } else {
    if (!fs.existsSync(srcDir)) {
      log.error(`Directory not found: ${srcDir}`);
      log.info(`Use ${c.bold}--dir <path>${c.reset} to specify a different folder.`);
      process.exit(1);
    }
    sourceFiles = findTypeScriptFiles(srcDir);
  }

  if (sourceFiles.length === 0) { log.warn("No TypeScript source files found."); process.exit(0); }

  log.info(`Source dir:  ${c.bold}${path.relative(cwd, srcDir) || "."}${c.reset}`);
  log.info(`Output dir:  ${c.bold}${path.relative(cwd, outDir)}${c.reset}`);
  log.info(`Files found: ${c.bold}${sourceFiles.length}${c.reset}`);
  if (dryRun) log.warn(`Dry run — no files will be written`);
  console.log();
  sourceFiles.forEach((f) => log.dim(`  • ${path.relative(cwd, f)}`));
  console.log();
  if (dryRun) process.exit(0);

  const { client, deployment } = createClient();
  let success = 0, skipped = 0, failed = 0;

  for (const sourceFile of sourceFiles) {
    const rel      = path.relative(cwd, sourceFile);
    const testPath = resolveTestPath(sourceFile, srcDir, outDir);

    if (!force && fs.existsSync(testPath)) {
      log.warn(`Skipping (exists): ${path.relative(cwd, testPath)}`);
      skipped++; continue;
    }

    const stop = spinner(`Generating tests for ${c.bold}${rel}${c.reset}...`);
    try {
      const sourceCode = fs.readFileSync(sourceFile, "utf-8");
      if (!sourceCode.trim()) { stop(); log.warn(`Empty file, skipping: ${rel}`); skipped++; continue; }

      const testCode = await generateTests(client, deployment, sourceCode, path.basename(sourceFile));
      stop();
      fs.writeFileSync(testPath, testCode, "utf-8");
      log.success(`${c.bold}${rel}${c.reset} → ${c.green}${path.relative(cwd, testPath)}${c.reset}`);
      success++;
    } catch (err: any) {
      stop();
      log.error(`Failed: ${rel} — ${err?.message ?? err}`);
      failed++;
    }
  }

  console.log();
  console.log(`${"─".repeat(44)}`);
  console.log(
    `  ${c.green}✔ ${success} generated${c.reset}` +
    (skipped > 0 ? `  ${c.yellow}⊘ ${skipped} skipped${c.reset}` : "") +
    (failed  > 0 ? `  ${c.red}✖ ${failed} failed${c.reset}`   : "")
  );
  console.log(`${"─".repeat(44)}`);
  if (success > 0) { console.log(); log.info(`Run your tests with: ${c.bold}npx jest${c.reset}`); }
  console.log();
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") { printHelp(); return; }
  if (command === "--version" || command === "-v") { console.log("pat v1.0.0"); return; }

  switch (command) {
    case "setup-api-key": await cmdSetupApiKey(); break;
    case "show-config":   cmdShowConfig();        break;
    case "generate":      await cmdGenerate(rest); break;
    default:
      log.error(`Unknown command: "${command}"`);
      log.info(`Run ${c.bold}pat --help${c.reset} to see available commands.`);
      process.exit(1);
  }
}

main();
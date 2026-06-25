import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { execSync, spawn } from "child_process";

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
  magenta: "\x1b[35m",
};

const log = {
  info: (msg: string) => console.log(`${c.cyan}ℹ${c.reset}  ${msg}`),
  success: (msg: string) => console.log(`${c.green}✔${c.reset}  ${msg}`),
  warn: (msg: string) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`),
  error: (msg: string) => console.log(`${c.red}✖${c.reset}  ${msg}`),
  dim: (msg: string) => console.log(`${c.dim}${msg}${c.reset}`),
};

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(process.env.HOME ?? process.env.USERPROFILE ?? "~", ".pat");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

interface OllamaConfig {
  host: string;
  model: string;
}

interface StoredConfig {
  active: "azure" | "ollama";
  azure?: AzureConfig;
  ollama?: OllamaConfig;
  maxTokens?: number;
}

function readConfig(): StoredConfig | null {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) as StoredConfig; }
  catch { return null; }
}

function writeConfig(cfg: StoredConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function printBanner() {
  console.log();
  console.log(`  ${c.cyan}╔════════════════════════════════════════╗${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}██████╗ ${c.green} █████╗ ${c.red}████████╗${c.reset}         ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}██╔══██╗${c.green}██╔══██╗${c.red}╚══██╔══╝${c.reset}         ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}██████╔╝${c.green}███████║${c.red}   ██║${c.reset}            ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}██╔═══╝ ${c.green}██╔══██║${c.red}   ██║${c.reset}            ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}██║     ${c.green}██║  ██║${c.red}   ██║${c.reset} 🐥          ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.yellow}╚═╝     ${c.green}╚═╝  ╚═╝${c.red}   ╚═╝${c.reset}            ${c.cyan}║${c.reset}`);
  console.log(`  ${c.cyan}║${c.reset}                                          ${c.cyan}║${c.reset}`);
  const cfg = readConfig();
  const providerLabel = !cfg
    ? `${c.dim}no provider configured${c.reset}`
    : cfg.active === "ollama" && cfg.ollama
      ? `${c.bold}${c.green}Ollama${c.reset} ${c.dim}(${cfg.ollama.model})${c.reset}`
      : `${c.bold}${c.magenta}Azure OpenAI${c.reset}`;
  console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${c.green}Pedro Arantes${c.reset} Tests · ${providerLabel}       ${c.cyan}║${c.reset}`);
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
  console.log(`  ${c.cyan}setup-api-key${c.reset}      Set your Azure OpenAI credentials`);
  console.log(`  ${c.cyan}setup-ollama${c.reset}       Set up local Ollama as the AI provider`);
  console.log(`  ${c.cyan}show-config${c.reset}        Show current saved credentials`);
  console.log(`  ${c.cyan}generate${c.reset}           Generate tests for TypeScript files`);
  console.log(`  ${c.cyan}coverage${c.reset}           Analyse which files are missing tests`);
  console.log(`  ${c.cyan}suggest${c.reset}            Suggest missing test cases (no files written)`);
  console.log(`  ${c.cyan}report${c.reset}             Generate an HTML coverage report`);
  console.log(`  ${c.cyan}watch${c.reset}              Watch for file changes and auto-generate tests`);
  console.log(`  ${c.cyan}fix${c.reset}                Run tests, find failures and auto-fix them`);
  console.log(`  ${c.cyan}use${c.reset}                Switch between azure and ollama`);
  console.log(`  ${c.cyan}config${c.reset}             Set default options (e.g. max-tokens)`);
  console.log();
  console.log(`${c.bold}OPTIONS${c.reset}`);
  console.log(`  ${c.cyan}--help,  -h${c.reset}        Show this help message`);
  console.log(`  ${c.cyan}--version, -v${c.reset}      Show version`);
  console.log(`  ${c.cyan}--dir,   -d${c.reset}        Target directory (default: ./src)`);
  console.log(`  ${c.cyan}--out,   -o${c.reset}        Output directory (default: <dir>/__tests__)`);
  console.log(`  ${c.cyan}--dry-run${c.reset}          Preview without writing files`);
  console.log(`  ${c.cyan}--force, -f${c.reset}        Overwrite existing test files`);
  console.log(`  ${c.cyan}--max-tokens${c.reset}       Max tokens per AI response (default: 2000)`);
  console.log();
  console.log(`${c.bold}EXAMPLES${c.reset}`);
  console.log(`  pat setup-api-key         # configure Azure OpenAI`);
  console.log(`  pat setup-ollama          # configure local Ollama`);
  console.log(`  pat generate              # generate tests for ./src`);
  console.log(`  pat coverage              # show which files have no tests`);
  console.log(`  pat suggest src/auth.ts   # suggest test cases for a file`);
  console.log(`  pat report                # open HTML coverage report`);
  console.log(`  pat watch                 # auto-generate on file save`);
  console.log(`  pat fix                   # fix failing tests automatically`);
  console.log(`  pat fix --retries 3       # retry fixing up to 3 times`);
  console.log(`  pat generate --max-tokens 4000  # use more tokens for large files`);
  console.log(`  pat config --max-tokens 4000    # save as default for all commands`);
  console.log(`  pat use                   # show active provider`);
  console.log(`  pat use azure             # switch to Azure OpenAI`);
  console.log(`  pat use ollama            # switch to local Ollama`);
  console.log();
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

// ─── Secret input (hidden, but supports copy/paste) ───────────────────────────

function askSecret(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");
    let value = "";
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.stdout.write("\n");
        process.exit();
      } else if (ch === "\u007f" || ch === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        value += ch;
        process.stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

// ─── AI Client (Azure or Ollama) ─────────────────────────────────────────────

function createClient(): { client: OpenAI; deployment: string } {
  const cfg = readConfig();
  if (!cfg) {
    log.error("No provider configured.");
    log.info(`Run ${c.bold}pat setup-api-key${c.reset} for Azure or ${c.bold}pat setup-ollama${c.reset} for local Ollama.`);
    process.exit(1);
  }

  if (cfg.active === "ollama") {
    if (!cfg.ollama) { log.error("Ollama not configured. Run: pat setup-ollama"); process.exit(1); }
    const client = new OpenAI({ apiKey: "ollama", baseURL: `${cfg.ollama.host.replace(/\/$/, "")}/v1` });
    return { client, deployment: cfg.ollama.model };
  }

  if (!cfg.azure) { log.error("Azure not configured. Run: pat setup-api-key"); process.exit(1); }
  const client = new OpenAI({
    apiKey: cfg.azure.apiKey,
    baseURL: `${cfg.azure.endpoint.replace(/\/$/, "")}/openai/deployments/${cfg.azure.deployment}`,
    defaultQuery: { "api-version": cfg.azure.apiVersion },
    defaultHeaders: { "api-key": cfg.azure.apiKey },
  });
  return { client, deployment: cfg.azure.deployment };
}

async function callAI(client: OpenAI, deployment: string, system: string, user: string, maxTokens?: number): Promise<string> {
  const cfg = readConfig();
  const tokens = maxTokens ?? cfg?.maxTokens ?? 2000;
  const response = await client.chat.completions.create({
    model: deployment,
    temperature: 0.2,
    max_tokens: tokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = response.choices[0]?.message?.content ?? "";
  return content.replace(/^```(?:typescript|ts)?\n?/i, "").replace(/\n?```$/i, "").trim();
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
        entry.isFile() && /\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx") &&
        !entry.name.endsWith(".spec.ts") && !entry.name.endsWith(".spec.tsx") &&
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
  const dirName = path.dirname(relative);
  const testDir = path.join(outDir, dirName);
  fs.mkdirSync(testDir, { recursive: true });
  return path.join(testDir, `${baseName}.test.ts`);
}

function hasTestFile(sourceFile: string, srcDir: string, outDir: string): boolean {
  const testPath = resolveTestPath(sourceFile, srcDir, outDir);
  return fs.existsSync(testPath);
}

// ─── Detect framework ─────────────────────────────────────────────────────────

function detectFramework(srcDir: string): "angular" | "react" | "nestjs" | "generic" {
  const pkgPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(pkgPath)) return "generic";
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["@angular/core"]) return "angular";
    if (deps["@nestjs/core"]) return "nestjs";
    if (deps["react"]) return "react";
  } catch {}
  return "generic";
}

function getSystemPrompt(framework: string): string {
  const base = `You are an expert TypeScript developer. Write comprehensive unit tests.
Rules:
- Return ONLY the test file TypeScript code — no markdown, no explanation
- Cover happy paths, edge cases, errors, and boundary values
- Mock external dependencies when needed`;

  if (framework === "angular") return `${base}
Angular-specific rules:
- Use Angular TestBed for component and service tests
- Use HttpClientTestingModule for services with HTTP calls
- Use ComponentFixture for component tests
- Mock services with jasmine.createSpyObj or jest.fn()
- Use fakeAsync/tick for async operations
- Import CommonModule, RouterTestingModule when needed
- Use Jest as the test runner (describe, it, expect)`;

  if (framework === "nestjs") return `${base}
NestJS-specific rules:
- Use @nestjs/testing Test.createTestingModule()
- Mock providers with jest.fn()
- Test controllers and services separately
- Use supertest for e2e-style controller tests`;

  return `${base}
- Use Jest with TypeScript (describe, it, expect)
- Import the module by its relative path from the __tests__ folder`;
}


// ─── Command: setup-ollama ────────────────────────────────────────────────────

async function cmdSetupOllama() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, res));
  const existing = readConfig();
  const existingOllama = existing?.ollama ?? null;

  printBanner();
  console.log(`${c.bold}⚙  Ollama Local Setup${c.reset}`);
  console.log(`${c.dim}  Make sure Ollama is running: ollama serve${c.reset}`);
  console.log(`${c.dim}  Install a model first:       ollama pull codellama${c.reset}`);
  if (existingOllama) console.log(`${c.dim}  Press Enter to keep the current value shown in [brackets]${c.reset}`);
  console.log();

  const host = await ask(
    `${c.cyan}  Ollama host${c.reset}   ${existingOllama ? c.dim+"["+existingOllama.host+"]"+c.reset+" " : c.dim+"[http://localhost:11434]"+c.reset+" "}› `
  );
  const model = await ask(
    `${c.cyan}  Model${c.reset}         ${existingOllama ? c.dim+"["+existingOllama.model+"]"+c.reset+" " : c.dim+"[codellama]"+c.reset+" "}› `
  );
  rl.close();

  const config: OllamaConfig = {
    host: host.trim() || existingOllama?.host || "http://localhost:11434",
    model: model.trim() || existingOllama?.model || "codellama",
  };

  // Test connection
  const stop = spinner(`Testing connection to ${config.host}...`);
  try {
    const res = await fetch(`${config.host}/api/tags`);
    stop();
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json() as { models?: { name: string }[] };
    const models = data.models?.map((m: { name: string }) => m.name) ?? [];
    const hasModel = models.some((m: string) => m.startsWith(config.model));
    if (!hasModel) {
      log.warn(`Model "${config.model}" not found locally.`);
      log.info(`Run: ${c.bold}ollama pull ${config.model}${c.reset}`);
      if (models.length > 0) {
        log.info(`Available models: ${c.dim}${models.slice(0, 5).join(", ")}${c.reset}`);
      }
    } else {
      log.success(`Connected! Model "${config.model}" is ready.`);
    }
  } catch (err: any) {
    stop();
    log.warn(`Could not connect to Ollama at ${config.host}`);
    log.info(`Make sure Ollama is running: ${c.bold}ollama serve${c.reset}`);
  }

  writeConfig({ ...existing, active: "ollama", ollama: config });
  console.log();
  log.success(`Config saved to ${c.bold}${CONFIG_FILE}${c.reset}`);
  log.info(`Active provider set to ${c.bold}${c.green}Ollama${c.reset}.`);
  log.info(`Run ${c.bold}pat generate${c.reset} to start generating tests with Ollama.`);
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
  if (existing?.azure) console.log(`${c.dim}  Press Enter to keep the current value shown in [brackets]${c.reset}`);
  console.log();
  const existingAzure = existing?.azure ?? null;
  const endpoint   = await ask(`${c.cyan}  Endpoint URL${c.reset}   ${existingAzure ? c.dim+"["+existingAzure.endpoint+"]"+c.reset+" " : ""}› `);
  rl.close();
  const apiKey     = await askSecret(`${c.cyan}  API Key${c.reset}       ${existingAzure ? c.dim+"["+existingAzure.apiKey.slice(0,8)+"...]"+c.reset+" " : ""}› `);
  const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask2 = (q: string): Promise<string> => new Promise((res) => rl2.question(q, res));
  const deployment = await ask2(`${c.cyan}  Deployment${c.reset}    ${existingAzure ? c.dim+"["+existingAzure.deployment+"]"+c.reset+" " : c.dim+"[gpt-4o]"+c.reset+" "}› `);
  const apiVersion = await ask2(`${c.cyan}  API Version${c.reset}   ${existingAzure ? c.dim+"["+existingAzure.apiVersion+"]"+c.reset+" " : c.dim+"[2024-02-01]"+c.reset+" "}› `);
  rl2.close();
  const azureCfg: AzureConfig = {
    endpoint:   endpoint.trim()   || existingAzure?.endpoint   || "",
    apiKey:     apiKey.trim()     || existingAzure?.apiKey     || "",
    deployment: deployment.trim() || existingAzure?.deployment || "gpt-4o",
    apiVersion: apiVersion.trim() || existingAzure?.apiVersion || "2024-02-01",
  };
  if (!azureCfg.endpoint || !azureCfg.apiKey) { console.log(); log.error("Endpoint and API Key are required."); process.exit(1); }
  writeConfig({ ...existing, active: "azure", azure: azureCfg });
  console.log();
  log.success(`Credentials saved to ${c.bold}${CONFIG_FILE}${c.reset}`);
  log.info(`Active provider set to ${c.bold}${c.magenta}Azure OpenAI${c.reset}.`);
  log.info(`Run ${c.bold}pat generate${c.reset} to start generating tests.`);
  console.log();
}

// ─── Command: show-config ─────────────────────────────────────────────────────

function cmdShowConfig() {
  printBanner();
  const cfg = readConfig();
  if (!cfg) {
    log.warn("No provider configured.");
    log.info(`Run ${c.bold}pat setup-api-key${c.reset} for Azure or ${c.bold}pat setup-ollama${c.reset} for Ollama.`);
    console.log(); return;
  }

  const active = cfg.active;
  console.log(`${c.bold}  Active provider:${c.reset} ${active === "azure" ? c.magenta : c.green}${active}${c.reset}
`);

  if (cfg.azure) {
    const a = cfg.azure;
    console.log(`  ${active === "azure" ? c.green+"●"+c.reset : c.dim+"○"+c.reset}  ${c.bold}Azure OpenAI${c.reset}`);
    console.log(`     ${c.cyan}Endpoint${c.reset}     ${a.endpoint}`);
    console.log(`     ${c.cyan}API Key${c.reset}      ${a.apiKey.slice(0, 8)}${"*".repeat(20)}`);
    console.log(`     ${c.cyan}Deployment${c.reset}   ${a.deployment}`);
    console.log(`     ${c.cyan}API Version${c.reset}  ${a.apiVersion}`);
    console.log();
  }

  if (cfg.ollama) {
    const o = cfg.ollama;
    console.log(`  ${active === "ollama" ? c.green+"●"+c.reset : c.dim+"○"+c.reset}  ${c.bold}Ollama (local)${c.reset}`);
    console.log(`     ${c.cyan}Host${c.reset}    ${o.host}`);
    console.log(`     ${c.cyan}Model${c.reset}   ${o.model}`);
    console.log();
  }

  log.info(`Switch with: ${c.bold}pat use azure${c.reset}  or  ${c.bold}pat use ollama${c.reset}`);
  console.log();
}

// ─── Command: generate ────────────────────────────────────────────────────────

async function cmdGenerate(argv: string[]) {
  let dir = "src", out: string | null = null, dryRun = false, force = false;
  const files: string[] = [];
  let maxTokens: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--dir": case "-d": dir = argv[++i] ?? "src"; break;
      case "--out": case "-o": out = argv[++i] ?? null; break;
      case "--dry-run": dryRun = true; break;
      case "--force": case "-f": force = true; break;
      case "--max-tokens": maxTokens = parseInt(argv[++i] ?? "2000"); break;
      default: if (!argv[i].startsWith("-")) files.push(argv[i]);
    }
  }
  printBanner();
  const cwd = process.cwd();
  const srcDir = path.resolve(cwd, dir);
  const outDir = out ? path.resolve(cwd, out) : path.join(srcDir, "__tests__");
  const framework = detectFramework(srcDir);

  if (framework !== "generic") log.info(`Detected framework: ${c.bold}${framework}${c.reset}`);
  if (maxTokens) log.info(`Max tokens: ${c.bold}${maxTokens}${c.reset}`);

  let sourceFiles: string[];
  if (files.length > 0) {
    sourceFiles = files.map((f) => path.resolve(cwd, f));
    const missing = sourceFiles.filter((f) => !fs.existsSync(f));
    if (missing.length > 0) { missing.forEach((f) => log.error(`File not found: ${f}`)); process.exit(1); }
  } else {
    if (!fs.existsSync(srcDir)) { log.error(`Directory not found: ${srcDir}`); process.exit(1); }
    sourceFiles = findTypeScriptFiles(srcDir);
  }

  if (sourceFiles.length === 0) { log.warn("No TypeScript source files found."); process.exit(0); }
  log.info(`Source dir:  ${c.bold}${path.relative(cwd, srcDir) || "."}${c.reset}`);
  log.info(`Output dir:  ${c.bold}${path.relative(cwd, outDir)}${c.reset}`);
  log.info(`Files found: ${c.bold}${sourceFiles.length}${c.reset}`);
  if (dryRun) log.warn("Dry run — no files will be written");
  console.log();
  sourceFiles.forEach((f) => log.dim(`  • ${path.relative(cwd, f)}`));
  console.log();
  if (dryRun) process.exit(0);

  const { client, deployment } = createClient();
  const systemPrompt = getSystemPrompt(framework);
  let success = 0, skipped = 0, failed = 0;

  for (const sourceFile of sourceFiles) {
    const rel = path.relative(cwd, sourceFile);
    const testPath = resolveTestPath(sourceFile, srcDir, outDir);
    if (!force && fs.existsSync(testPath)) { log.warn(`Skipping (exists): ${path.relative(cwd, testPath)}`); skipped++; continue; }
    const stop = spinner(`Generating tests for ${c.bold}${rel}${c.reset}...`);
    try {
      const sourceCode = fs.readFileSync(sourceFile, "utf-8");
      if (!sourceCode.trim()) { stop(); log.warn(`Empty file, skipping: ${rel}`); skipped++; continue; }
      const testCode = await callAI(client, deployment, systemPrompt,
        `Generate unit tests for this TypeScript file named "${path.basename(sourceFile)}":\n\n${sourceCode}`, maxTokens);
      stop();
      fs.writeFileSync(testPath, testCode, "utf-8");
      log.success(`${c.bold}${rel}${c.reset} → ${c.green}${path.relative(cwd, testPath)}${c.reset}`);
      success++;
    } catch (err: any) { stop(); log.error(`Failed: ${rel} — ${err?.message ?? err}`); failed++; }
  }

  console.log();
  console.log(`${"─".repeat(44)}`);
  console.log(`  ${c.green}✔ ${success} generated${c.reset}` + (skipped > 0 ? `  ${c.yellow}⊘ ${skipped} skipped${c.reset}` : "") + (failed > 0 ? `  ${c.red}✖ ${failed} failed${c.reset}` : ""));
  console.log(`${"─".repeat(44)}`);
  if (success > 0) { console.log(); log.info(`Run your tests with: ${c.bold}npx jest${c.reset}`); }
  console.log();
}

// ─── Command: coverage ────────────────────────────────────────────────────────

async function cmdCoverage(argv: string[]) {
  let dir = "src", out: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" || argv[i] === "-d") dir = argv[++i] ?? "src";
    if (argv[i] === "--out" || argv[i] === "-o") out = argv[++i] ?? null;
  }
  printBanner();
  const cwd = process.cwd();
  const srcDir = path.resolve(cwd, dir);
  const outDir = out ? path.resolve(cwd, out) : path.join(srcDir, "__tests__");

  if (!fs.existsSync(srcDir)) { log.error(`Directory not found: ${srcDir}`); process.exit(1); }

  const sourceFiles = findTypeScriptFiles(srcDir);
  if (sourceFiles.length === 0) { log.warn("No TypeScript source files found."); process.exit(0); }

  const covered: string[] = [];
  const missing: string[] = [];

  for (const f of sourceFiles) {
    if (hasTestFile(f, srcDir, outDir)) covered.push(f);
    else missing.push(f);
  }

  const pct = Math.round((covered.length / sourceFiles.length) * 100);
  const bar = (filled: number, total: number) => {
    const w = 30;
    const n = Math.round((filled / total) * w);
    return `${c.green}${"█".repeat(n)}${c.reset}${c.dim}${"░".repeat(w - n)}${c.reset}`;
  };

  console.log(`${c.bold}  Coverage Report${c.reset}\n`);
  console.log(`  ${bar(covered.length, sourceFiles.length)}  ${pct >= 80 ? c.green : pct >= 50 ? c.yellow : c.red}${pct}%${c.reset}  (${covered.length}/${sourceFiles.length} files)\n`);

  if (covered.length > 0) {
    console.log(`${c.green}  ✔ Covered${c.reset}`);
    covered.forEach((f) => console.log(`    ${c.dim}${path.relative(cwd, f)}${c.reset}`));
    console.log();
  }

  if (missing.length > 0) {
    console.log(`${c.red}  ✖ Missing tests${c.reset}`);
    missing.forEach((f) => console.log(`    ${c.yellow}${path.relative(cwd, f)}${c.reset}`));
    console.log();
    log.info(`Run ${c.bold}pat generate${c.reset} to generate the missing tests.`);
    log.info(`Or target specific files: ${c.bold}pat generate ${path.relative(cwd, missing[0])}${c.reset}`);
  } else {
    log.success("All files have tests! 🎉");
  }
  console.log();
}

// ─── Command: suggest ─────────────────────────────────────────────────────────

async function cmdSuggest(argv: string[]) {
  let dir = "src";
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" || argv[i] === "-d") dir = argv[++i] ?? "src";
    else if (!argv[i].startsWith("-")) files.push(argv[i]);
  }

  printBanner();
  const cwd = process.cwd();
  const srcDir = path.resolve(cwd, dir);
  const framework = detectFramework(srcDir);

  let sourceFiles: string[];
  if (files.length > 0) {
    sourceFiles = files.map((f) => path.resolve(cwd, f));
    const missing = sourceFiles.filter((f) => !fs.existsSync(f));
    if (missing.length > 0) { missing.forEach((f) => log.error(`File not found: ${f}`)); process.exit(1); }
  } else {
    sourceFiles = findTypeScriptFiles(srcDir);
  }

  if (sourceFiles.length === 0) { log.warn("No TypeScript source files found."); process.exit(0); }

  const { client, deployment } = createClient();

  for (const sourceFile of sourceFiles) {
    const rel = path.relative(cwd, sourceFile);
    const stop = spinner(`Analysing ${c.bold}${rel}${c.reset}...`);
    try {
      const sourceCode = fs.readFileSync(sourceFile, "utf-8");
      const suggestions = await callAI(client, deployment,
        `You are an expert ${framework} TypeScript developer. Analyse the given code and suggest test cases.
Return a plain numbered list of test case descriptions — no code, no markdown headers.
Group them by: Happy paths, Edge cases, Error cases.
Be specific to the actual functions and logic in the file.`,
        `Suggest test cases for this file named "${path.basename(sourceFile)}":\n\n${sourceCode}`
      );
      stop();
      console.log(`\n${c.bold}${c.cyan}  📋 ${rel}${c.reset}\n`);
      suggestions.split("\n").forEach((line) => {
        if (line.trim()) console.log(`  ${line}`);
      });
      console.log();
    } catch (err: any) { stop(); log.error(`Failed: ${rel} — ${err?.message ?? err}`); }
  }
}

// ─── Command: report ──────────────────────────────────────────────────────────

async function cmdReport(argv: string[]) {
  let dir = "src", out: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" || argv[i] === "-d") dir = argv[++i] ?? "src";
    if (argv[i] === "--out" || argv[i] === "-o") out = argv[++i] ?? null;
  }

  printBanner();
  const cwd = process.cwd();
  const srcDir = path.resolve(cwd, dir);
  const outDir = out ? path.resolve(cwd, out) : path.join(srcDir, "__tests__");
  const framework = detectFramework(srcDir);

  if (!fs.existsSync(srcDir)) { log.error(`Directory not found: ${srcDir}`); process.exit(1); }

  const sourceFiles = findTypeScriptFiles(srcDir);
  if (sourceFiles.length === 0) { log.warn("No TypeScript source files found."); process.exit(0); }

  const rows = sourceFiles.map((f) => {
    const has = hasTestFile(f, srcDir, outDir);
    const rel = path.relative(cwd, f);
    const isAngularComponent = rel.includes(".component.");
    const isAngularService   = rel.includes(".service.");
    const isAngularPipe      = rel.includes(".pipe.");
    const type = isAngularComponent ? "Component" : isAngularService ? "Service" : isAngularPipe ? "Pipe" : "Module";
    return { rel, has, type };
  });

  const covered = rows.filter((r) => r.has).length;
  const pct = Math.round((covered / rows.length) * 100);
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  const tableRows = rows.map((r) => `
    <tr>
      <td>${r.rel}</td>
      <td><span class="badge badge-${r.type.toLowerCase()}">${r.type}</span></td>
      <td>${r.has
        ? '<span class="status ok">✔ covered</span>'
        : '<span class="status missing">✖ missing</span>'}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>pat coverage report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
  h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.25rem; }
  .sub { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card { background: #1e293b; border-radius: 12px; padding: 1.25rem; border: 1px solid #334155; }
  .card .num { font-size: 2rem; font-weight: 700; }
  .card .lbl { font-size: 0.8rem; color: #94a3b8; margin-top: 4px; }
  .progress { background: #1e293b; border-radius: 12px; padding: 1.25rem; margin-bottom: 2rem; border: 1px solid #334155; }
  .bar-bg { background: #334155; border-radius: 99px; height: 12px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 99px; background: ${color}; width: ${pct}%; transition: width 0.6s ease; }
  .bar-label { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem; color: #94a3b8; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
  th { background: #0f172a; padding: 0.75rem 1rem; text-align: left; font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 0.75rem 1rem; border-top: 1px solid #1e293b; font-size: 0.875rem; }
  tr:hover td { background: #263245; }
  .status.ok { color: #22c55e; font-weight: 500; }
  .status.missing { color: #ef4444; font-weight: 500; }
  .badge { padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 500; }
  .badge-component { background: #1d4ed840; color: #60a5fa; }
  .badge-service   { background: #7c3aed40; color: #a78bfa; }
  .badge-pipe      { background: #0f766e40; color: #2dd4bf; }
  .badge-module    { background: #78350f40; color: #fbbf24; }
  .framework { display: inline-block; background: #334155; padding: 2px 10px; border-radius: 99px; font-size: 0.8rem; color: #94a3b8; margin-left: 8px; vertical-align: middle; }
  footer { margin-top: 2rem; text-align: center; font-size: 0.8rem; color: #475569; }
</style>
</head>
<body>
<h1>🐥 pat <span class="framework">${framework}</span></h1>
<p class="sub">Generated on ${new Date().toLocaleString()} · ${path.relative(cwd, srcDir)}</p>

<div class="cards">
  <div class="card"><div class="num">${rows.length}</div><div class="lbl">Total files</div></div>
  <div class="card"><div class="num" style="color:#22c55e">${covered}</div><div class="lbl">Covered</div></div>
  <div class="card"><div class="num" style="color:#ef4444">${rows.length - covered}</div><div class="lbl">Missing tests</div></div>
  <div class="card"><div class="num" style="color:${color}">${pct}%</div><div class="lbl">Coverage</div></div>
</div>

<div class="progress">
  <div class="bar-label"><span>Test coverage</span><span style="color:${color}">${pct}%</span></div>
  <div class="bar-bg"><div class="bar-fill"></div></div>
</div>

<table>
  <thead><tr><th>File</th><th>Type</th><th>Status</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>

<footer>generated by pat · Pedro Arantes Tests</footer>
</body>
</html>`;

  const reportDir = path.join(cwd, "pat-report");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "index.html");
  fs.writeFileSync(reportPath, html, "utf-8");

  log.success(`Report saved to ${c.bold}${path.relative(cwd, reportPath)}${c.reset}`);

  try {
    const opener = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
    execSync(`${opener} "${reportPath}"`);
    log.info("Opening in browser...");
  } catch {
    log.info(`Open manually: ${c.bold}${reportPath}${c.reset}`);
  }
  console.log();
}

// ─── Command: watch ───────────────────────────────────────────────────────────

async function cmdWatch(argv: string[]) {
  let dir = "src", out: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" || argv[i] === "-d") dir = argv[++i] ?? "src";
    if (argv[i] === "--out" || argv[i] === "-o") out = argv[++i] ?? null;
  }

  printBanner();
  const cwd = process.cwd();
  const srcDir = path.resolve(cwd, dir);
  const outDir = out ? path.resolve(cwd, out) : path.join(srcDir, "__tests__");
  const framework = detectFramework(srcDir);

  if (!fs.existsSync(srcDir)) { log.error(`Directory not found: ${srcDir}`); process.exit(1); }

  if (framework !== "generic") log.info(`Detected framework: ${c.bold}${framework}${c.reset}`);
  log.info(`Watching ${c.bold}${path.relative(cwd, srcDir)}${c.reset} for changes...`);
  log.info(`Press ${c.bold}Ctrl+C${c.reset} to stop.\n`);

  const { client, deployment } = createClient();
  const systemPrompt = getSystemPrompt(framework);
  const debounceMap = new Map<string, NodeJS.Timeout>();

  const handleChange = async (filePath: string) => {
    if (
      !filePath.endsWith(".ts") && !filePath.endsWith(".tsx") ||
      filePath.endsWith(".test.ts") || filePath.endsWith(".spec.ts") ||
      filePath.endsWith(".d.ts")
    ) return;

    const rel = path.relative(cwd, filePath);
    const testPath = resolveTestPath(filePath, srcDir, outDir);

    const stop = spinner(`${c.yellow}Changed${c.reset} ${c.bold}${rel}${c.reset} — generating tests...`);
    try {
      const sourceCode = fs.readFileSync(filePath, "utf-8");
      if (!sourceCode.trim()) { stop(); return; }
      const testCode = await callAI(client, deployment, systemPrompt,
        `Generate unit tests for this TypeScript file named "${path.basename(filePath)}":\n\n${sourceCode}`);
      stop();
      fs.writeFileSync(testPath, testCode, "utf-8");
      log.success(`${c.bold}${rel}${c.reset} → ${c.green}${path.relative(cwd, testPath)}${c.reset}`);
    } catch (err: any) { stop(); log.error(`Failed: ${rel} — ${err?.message ?? err}`); }
  };

  fs.watch(srcDir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const fullPath = path.join(srcDir, filename);
    if (debounceMap.has(fullPath)) clearTimeout(debounceMap.get(fullPath)!);
    debounceMap.set(fullPath, setTimeout(() => handleChange(fullPath), 500));
  });
}

// ─── Command: config ──────────────────────────────────────────────────────────

async function cmdConfig(argv: string[]) {
  const cfg = readConfig();
  let maxTokens: number | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--max-tokens") maxTokens = parseInt(argv[++i] ?? "2000");
  }

  // If no args, just show current config
  if (maxTokens === undefined) {
    printBanner();
    console.log(`${c.bold}  Default settings${c.reset}  ${c.dim}(${CONFIG_FILE})${c.reset}
`);
    console.log(`  ${c.cyan}Max tokens${c.reset}   ${cfg?.maxTokens ?? 2000} ${c.dim}(default: 2000)${c.reset}`);
    console.log();
    log.info(`Change with: ${c.bold}pat config --max-tokens 4000${c.reset}`);
    console.log();
    return;
  }

  if (isNaN(maxTokens) || maxTokens < 100 || maxTokens > 128000) {
    log.error("--max-tokens must be a number between 100 and 128000.");
    process.exit(1);
  }

  writeConfig({ ...cfg!, maxTokens });
  printBanner();
  log.success(`Default max tokens set to ${c.bold}${maxTokens}${c.reset}`);
  log.info(`This applies to all commands unless overridden with ${c.bold}--max-tokens${c.reset}`);
  console.log();
}

// ─── Command: use ─────────────────────────────────────────────────────────────

async function cmdUse(argv: string[]) {
  const provider = argv[0]?.toLowerCase();

  if (!provider || (provider !== "azure" && provider !== "ollama")) {
    printBanner();
    const cfg = readConfig();
    const current = cfg ? cfg.active : "none";
    console.log(`${c.bold}  Active provider:${c.reset} ${current === "azure" ? c.magenta : current === "ollama" ? c.green : c.dim}${current}${c.reset}
`);
    console.log(`  ${current === "azure" ? c.green+"●"+c.reset : c.dim+"○"+c.reset}  ${c.bold}azure${c.reset}   ${c.dim}Azure OpenAI (cloud)${c.reset}`);
    console.log(`  ${current === "ollama" ? c.green+"●"+c.reset : c.dim+"○"+c.reset}  ${c.bold}ollama${c.reset}  ${c.dim}Ollama (local)${c.reset}`);
    console.log();
    log.info(`Switch with: ${c.bold}pat use azure${c.reset}  or  ${c.bold}pat use ollama${c.reset}`);
    console.log();
    return;
  }

  const cfg = readConfig();

  if (provider === "azure") {
    if (!cfg?.azure) {
      log.error("Azure is not configured yet.");
      log.info(`Run ${c.bold}pat setup-api-key${c.reset} first.`);
      process.exit(1);
    }
    writeConfig({ ...cfg, active: "azure" });
    printBanner();
    log.success(`Switched to ${c.bold}${c.magenta}Azure OpenAI${c.reset} (${cfg.azure.deployment})`);
  }

  if (provider === "ollama") {
    if (!cfg?.ollama) {
      log.error("Ollama is not configured yet.");
      log.info(`Run ${c.bold}pat setup-ollama${c.reset} first.`);
      process.exit(1);
    }
    writeConfig({ ...cfg, active: "ollama" });
    printBanner();
    log.success(`Switched to ${c.bold}${c.green}Ollama${c.reset} (${cfg.ollama.model} @ ${cfg.ollama.host})`);
  }

  console.log();
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") { printHelp(); return; }
  if (command === "--version" || command === "-v") { console.log("pat v2.0.0"); return; }

  switch (command) {
    case "setup-api-key": await cmdSetupApiKey(); break;
    case "setup-ollama":  await cmdSetupOllama();  break;
    case "show-config":   cmdShowConfig();         break;
    case "generate":      await cmdGenerate(rest);  break;
    case "coverage":      await cmdCoverage(rest);  break;
    case "suggest":       await cmdSuggest(rest);   break;
    case "report":        await cmdReport(rest);    break;
    case "watch":         await cmdWatch(rest);     break;
    case "fix":           await cmdFix(rest);       break;
    case "use":           await cmdUse(rest);       break;
    case "config":        await cmdConfig(rest);    break;
    default:
      log.error(`Unknown command: "${command}"`);
      log.info(`Run ${c.bold}pat --help${c.reset} to see available commands.`);
      process.exit(1);
  }
}

main();

// ─── Command: fix ─────────────────────────────────────────────────────────────

interface FailedTest {
  testFile: string;
  sourceFile: string | null;
  errorOutput: string;
  testName: string;
}

function parseJestOutput(output: string, cwd: string): FailedTest[] {
  const failed: FailedTest[] = [];
  const fileRegex = /FAIL\s+(.+\.(?:test|spec)\.tsx?)/g;
  const errorBlockRegex = /●\s+(.+?)\n([\s\S]+?)(?=\n●|\n={20,}|$)/g;

  const failedFiles = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(output)) !== null) {
    const testFile = path.resolve(cwd, match[1].trim());
    failedFiles.add(testFile);
  }

  for (const testFile of failedFiles) {
    // Try to find the corresponding source file
    const sourceFile = testFile
      .replace("__tests__/", "")
      .replace(/\.test\.tsx?$/, ".ts")
      .replace(/\.spec\.tsx?$/, ".ts");

    const errors: string[] = [];
    while ((match = errorBlockRegex.exec(output)) !== null) {
      errors.push(`● ${match[1]}\n${match[2]}`);
    }

    failed.push({
      testFile,
      sourceFile: fs.existsSync(sourceFile) ? sourceFile : null,
      errorOutput: errors.join("\n\n") || output.slice(0, 3000),
      testName: path.basename(testFile),
    });
  }

  return failed;
}

async function cmdFix(argv: string[]) {
  let dir = "src";
  let maxRetries = 2;
  const files: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" || argv[i] === "-d") dir = argv[++i] ?? "src";
    else if (argv[i] === "--retries") maxRetries = parseInt(argv[++i] ?? "2");
    else if (!argv[i].startsWith("-")) files.push(argv[i]);
  }

  printBanner();
  const cwd = process.cwd();
  const srcDir = path.resolve(cwd, dir);
  const framework = detectFramework(srcDir);

  if (framework !== "generic") log.info(`Detected framework: ${c.bold}${framework}${c.reset}`);
  console.log();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      console.log();
      log.info(`${c.yellow}Retry ${attempt}/${maxRetries}${c.reset} — re-running tests...`);
      console.log();
    }

    // Run jest and capture output
    log.info(`Running tests...`);
    let jestOutput = "";
    let allPassed = false;

    try {
      const jestCmd = files.length > 0
        ? `npx jest ${files.join(" ")} --no-coverage 2>&1`
        : `npx jest --no-coverage 2>&1`;

      jestOutput = execSync(jestCmd, { cwd, encoding: "utf-8" });
      allPassed = true;
    } catch (err: any) {
      jestOutput = err.stdout ?? err.message ?? "";
    }

    if (allPassed || jestOutput.includes("Tests:") && !jestOutput.includes("failed")) {
      console.log();
      log.success("All tests are passing! Nothing to fix. 🎉");
      console.log();
      return;
    }

    // Parse which tests failed
    const failedTests = parseJestOutput(jestOutput, cwd);

    if (failedTests.length === 0) {
      console.log();
      log.warn("Could not parse failed tests from Jest output.");
      log.dim(jestOutput.slice(0, 500));
      return;
    }

    console.log();
    log.warn(`Found ${c.bold}${failedTests.length}${c.reset} failing test file(s):`);
    failedTests.forEach((t) => log.dim(`  • ${path.relative(cwd, t.testFile)}`));
    console.log();

    const { client, deployment } = createClient();

    let fixed = 0, failed = 0;

    for (const failedTest of failedTests) {
      const rel = path.relative(cwd, failedTest.testFile);

      if (!fs.existsSync(failedTest.testFile)) {
        log.error(`Test file not found: ${rel}`);
        failed++;
        continue;
      }

      const currentTestCode = fs.readFileSync(failedTest.testFile, "utf-8");
      const sourceCode = failedTest.sourceFile
        ? fs.readFileSync(failedTest.sourceFile, "utf-8")
        : null;

      const stop = spinner(`Fixing ${c.bold}${rel}${c.reset}...`);

      try {
        const fixedCode = await callAI(
          client,
          deployment,
          `You are an expert ${framework} TypeScript developer. Fix failing Jest tests.
Rules:
- Analyse the error output carefully
- Return ONLY the fixed test file TypeScript code — no markdown, no explanation
- Keep all existing test cases but fix the broken ones
- Common fixes: wrong imports, missing TestBed providers, wrong mock setup, wrong assertions, missing async/await
- For Angular: ensure TestBed.configureTestingModule has all required imports and providers`,
          `Fix this failing test file.

${sourceCode ? `SOURCE FILE (${path.basename(failedTest.sourceFile!)}):
\`\`\`typescript
${sourceCode}
\`\`\`

` : ""}CURRENT TEST FILE (${failedTest.testName}):
\`\`\`typescript
${currentTestCode}
\`\`\`

JEST ERROR OUTPUT:
\`\`\`
${failedTest.errorOutput.slice(0, 2000)}
\`\`\`

Fix the test file so all tests pass.`
        );

        stop();

        // Backup the original
        const backupPath = failedTest.testFile + ".bak";
        fs.writeFileSync(backupPath, currentTestCode, "utf-8");

        // Write the fix
        fs.writeFileSync(failedTest.testFile, fixedCode, "utf-8");
        log.success(`Fixed: ${c.bold}${rel}${c.reset} ${c.dim}(backup: ${path.basename(backupPath)})${c.reset}`);
        fixed++;
      } catch (err: any) {
        stop();
        log.error(`Failed to fix: ${rel} — ${err?.message ?? err}`);
        failed++;
      }
    }

    console.log();
    console.log(`${"─".repeat(44)}`);
    console.log(`  ${c.green}✔ ${fixed} fixed${c.reset}` + (failed > 0 ? `  ${c.red}✖ ${failed} could not fix${c.reset}` : ""));
    console.log(`${"─".repeat(44)}`);

    if (fixed === 0) break;
  }

  console.log();
  log.info(`Run ${c.bold}npx jest${c.reset} to verify all tests pass.`);
  log.info(`Backups saved as ${c.bold}.bak${c.reset} files — delete them when happy.`);
  console.log();
}
# pat-ai-tests 🐥

> Pedro Arantes Tests — AI-powered test generator for TypeScript

Generate, fix, and manage Jest unit tests automatically using **Azure OpenAI** or **Ollama** (local).

## Install

```bash
npm install -g pat-ai-tests
```

## Setup

```bash
# Azure OpenAI (cloud)
pat setup-api-key

# Ollama (local, free)
pat setup-ollama
```

## Commands

| Command | Description |
|---|---|
| `pat generate` | Generate tests for all files in `./src` |
| `pat coverage` | Show which files are missing tests |
| `pat suggest` | Suggest test cases without writing files |
| `pat report` | Generate an HTML coverage report |
| `pat watch` | Auto-generate tests on file save |
| `pat fix` | Auto-fix failing tests |
| `pat use azure` | Switch to Azure OpenAI |
| `pat use ollama` | Switch to local Ollama |
| `pat show-config` | Show current configuration |

## Usage

```bash
# Generate tests for all files
pat generate

# Generate for a specific file
pat generate src/auth.service.ts

# Generate for a specific folder
pat generate --dir src/services

# Preview without writing
pat generate --dry-run

# Fix failing tests
pat fix
pat fix --retries 3

# Watch mode — auto-generates on save
pat watch
```

## Framework support

`pat` automatically detects your framework and uses the right test patterns:

- **Angular** — TestBed, HttpClientTestingModule, ComponentFixture, fakeAsync
- **NestJS** — Test.createTestingModule, providers, supertest
- **React** — React Testing Library, hooks
- **TypeScript** — Jest, ts-jest

## Switching providers

```bash
# Set up both providers once
pat setup-api-key    # Azure OpenAI
pat setup-ollama     # Ollama local

# Switch instantly between them
pat use azure
pat use ollama

# Check which is active
pat show-config
```

## Coverage report

```bash
pat report
```

Generates a dark-mode HTML report showing which files have tests, file types (Component, Service, Pipe), and overall coverage percentage. Opens automatically in your browser.

---

Made with 🐥 by [Pedro Arantes](https://github.com/piguelmon)
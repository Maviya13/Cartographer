# Project Cartographer

A production-grade VS Code extension that uses agentic, graph-based static analysis to understand codebases and answer architectural questions.

- GitHub: https://github.com/Maviya13/Cartographer

## Features

- **Workspace Scanning**: Recursively scans workspace folders (excluding node_modules, .git, etc.)
- **Static Analysis**: Extracts functions, dependencies, and relationships
- **Knowledge Graph**: Builds a graph representation of your codebase
- **Graph Queries**: Answers questions like:
  - "What breaks if I change this function?" (blast radius)
  - "Which functions are most central?" (centrality analysis)
  - "What should a new dev read first?" (file importance)
- **Natural Language Queries**: Ask questions in plain English
- **Gemini AI Integration**: Optional LLM explanations (requires API key)

## Installation

1. Clone this repository
2. Run `npm install`
3. Press F5 to open a new VS Code window with the extension loaded

## Configuration

To enable Gemini AI explanations:

**Option 1: Using .env file (Recommended)**
1. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a `.env` file in the project root (or copy `.env.example`)
3. Add your API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
4. The extension will automatically detect and use it

**Option 2: Using VS Code Settings**
1. Get a Gemini API key from Google AI Studio
2. Open VS Code settings
3. Set `projectCartographer.geminiApiKey` to your API key
4. Enable `projectCartographer.enableLLM`

## Usage

1. Open a workspace in VS Code
2. The extension pre-builds the graph in the background after startup
3. Click the status bar item (`Project Cartographer`) to open the dashboard
4. If workspace files/folders or exclude settings change, the graph is marked stale and rebuilt on next open
5. Use Command Palette: `Refresh Project Cartographer Graph` for a manual rebuild

## Architecture

- **Coordinator**: Orchestrates the multi-agent system.
- **Archaeologist Agent**: Maps the repository structure and languages.
- **Detective Agent**: Resolves dependencies and imports.
- **Risk Assessor**: Scans for security risks and technical debt.
- **Historian Agent**: Analyzes Git history for hotspots.
- **Translator Agent**: Auto-documents complex code (requires Gemini).
- **Architect Agent**: Detects circular dependencies and structural issues.
- **Knowledge Base**: Shared memory for agent findings.
- **Knowledge Graph**: Central graph data structure for queries.


## Development

```bash
npm install
npm run compile
npm run watch  # For development
```

## Build Artifacts

- TypeScript compiles into `out/`
- `npm run compile` also copies:
  - `src/extractors/python_ast_helper.py` -> `out/extractors/python_ast_helper.py`
  - `src/ui/*.html` -> `out/ui/`

## Deploy (Local VSIX)

1. Install packaging tool:
  ```bash
  npm install -g @vscode/vsce
  ```
2. Build extension output:
  ```bash
  npm run compile
  ```
3. Package VSIX:
  ```bash
  vsce package
  ```
4. Install in VS Code:
  - Command Palette -> `Extensions: Install from VSIX...`
  - Select the generated `.vsix` file

## Publish (VS Code Marketplace)

1. Update `package.json` metadata:
  - set `publisher` (required)
  - bump `version`
  - ensure `displayName`, `description`, and categories are accurate
2. Create a Personal Access Token (PAT) from Azure DevOps marketplace publisher settings.
3. Login and publish:
  ```bash
  vsce login <your-publisher>
  npm run compile
  vsce publish
  ```

Optional publish with explicit version bump:

```bash
vsce publish patch
```

## Requirements

- Node.js 18+
- Python 3.x (for Python AST parsing)
- VS Code 1.80+

## License

MIT — see `LICENSE`.

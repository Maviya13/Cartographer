import * as vscode from 'vscode';
import { ArchaeologistAgent, WorkspaceMetadata } from './agents/archaeologist';
import { DetectiveAgent, Dependency } from './agents/detective';
import { RiskAssessorAgent, RiskFinding } from './agents/risk-assessor';
import { HistorianAgent, FileHistory } from './agents/historian';
import { TranslatorAgent, FileDocumentation } from './agents/translator';
import { ArchitectAgent, ArchitectureInsight } from './agents/architect';
import { EntrypointDetectorAgent } from './agents/entrypoint-detector';
import { DomainDetectorAgent } from './agents/domain-detector';
import { FlowTracerAgent } from './agents/flow-tracer';
import { AgentCoordinator } from './agents/base/coordinator';
import { KnowledgeBase } from './knowledge/knowledge-base';
import { PythonExtractor } from './extractors/pythonExtractor';
import { JSExtractor } from './extractors/jsExtractor';
import { KnowledgeGraph } from './graph/knowledgeGraph';
import { QueryOrchestrator } from './orchestrator';
import { GeminiClient } from './llm/geminiClient';
import { createWebviewPanel } from './ui/webview';
// import { SidebarProvider } from './ui/sidebarProvider'; // Removed

let graph: KnowledgeGraph | null = null;
let orchestrator: QueryOrchestrator | null = null;
let agentData: any = null;
let geminiClient: GeminiClient | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;
let buildPromise: Promise<void> | null = null;
let currentWorkspacePath: string | null = null;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Project Cartographer is now active!');

    geminiClient = new GeminiClient(context);

    const openViewCommand = vscode.commands.registerCommand('projectCartographer.openView', async () => {
        const ready = await ensureGraphReady(context, false);
        if (!ready || !graph || !orchestrator) {
            return;
        }

        const panel = createWebviewPanel(context.extensionUri, graph, orchestrator, agentData);
        context.subscriptions.push(panel);
    });

    const refreshCommand = vscode.commands.registerCommand('projectCartographer.refreshGraph', async () => {
        const ready = await ensureGraphReady(context, true);
        if (ready) {
            vscode.window.showInformationMessage('Project Cartographer graph refreshed.');
        }
    });

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(map) Project Cartographer";
    statusBarItem.command = 'projectCartographer.openView';
    statusBarItem.tooltip = "Open Project Cartographer Dashboard";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            invalidateGraphState('Workspace changed');
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('projectCartographer.excludePatterns')) {
                invalidateGraphState('Exclude patterns updated');
            }
        })
    );

    updateStatusBar('idle');

    setTimeout(() => {
        ensureGraphReady(context, false).catch((error) => {
            console.error('Background graph prebuild failed:', error);
        });
    }, 1500);

    context.subscriptions.push(openViewCommand, refreshCommand);
}

function getPrimaryWorkspacePath(): string | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath || null;
}

function invalidateGraphState(reason: string): void {
    graph = null;
    orchestrator = null;
    agentData = null;
    currentWorkspacePath = null;
    updateStatusBar('stale', reason);
}

function updateStatusBar(state: 'idle' | 'building' | 'ready' | 'stale' | 'error', details?: string): void {
    if (!statusBarItem) {
        return;
    }

    if (state === 'building') {
        statusBarItem.text = '$(sync~spin) Cartographer: Building graph';
        statusBarItem.tooltip = details || 'Analyzing workspace files';
        return;
    }

    if (state === 'ready' && graph) {
        statusBarItem.text = `$(map) Cartographer: ${graph.getNodeCount()}n/${graph.getEdgeCount()}e`;
        statusBarItem.tooltip = details || 'Graph ready. Click to open dashboard.';
        return;
    }

    if (state === 'stale') {
        statusBarItem.text = '$(warning) Cartographer: Rebuild needed';
        statusBarItem.tooltip = details || 'Workspace changed. Click to rebuild and open dashboard.';
        return;
    }

    if (state === 'error') {
        statusBarItem.text = '$(error) Cartographer: Build failed';
        statusBarItem.tooltip = details || 'Click to retry graph build.';
        return;
    }

    statusBarItem.text = '$(map) Project Cartographer';
    statusBarItem.tooltip = details || 'Open Project Cartographer Dashboard';
}

async function ensureGraphReady(context: vscode.ExtensionContext, force: boolean): Promise<boolean> {
    const workspacePath = getPrimaryWorkspacePath();
    if (!workspacePath) {
        vscode.window.showWarningMessage('Open a workspace folder to use Project Cartographer.');
        return false;
    }

    if (!force && graph && orchestrator && currentWorkspacePath === workspacePath) {
        return true;
    }

    if (buildPromise) {
        await buildPromise;
        return !!graph && !!orchestrator;
    }

    buildPromise = (async () => {
        try {
            graph = new KnowledgeGraph();
            updateStatusBar('building', 'Analyzing project...');

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Window,
                    title: 'Project Cartographer: building graph...',
                    cancellable: false
                },
                async (progress) => {
                    agentData = await buildKnowledgeGraph(progress, context);
                }
            );

            orchestrator = new QueryOrchestrator(graph!, geminiClient || undefined);
            currentWorkspacePath = workspacePath;
            updateStatusBar('ready');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            orchestrator = null;
            updateStatusBar('error', errorMessage);
            throw error;
        }
    })();

    try {
        await buildPromise;
        return !!graph && !!orchestrator;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to build graph: ${errorMessage}`);
        console.error('Graph building error:', error);
        return false;
    } finally {
        buildPromise = null;
    }
}

async function buildKnowledgeGraph(progress: vscode.Progress<{ message?: string; increment?: number }>, context: vscode.ExtensionContext) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        throw new Error('No workspace folder found');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const workspacePath = workspaceFolder.uri.fsPath;

    progress.report({ message: 'Scanning workspace...', increment: 10 });

    // 1. Initialize Infrastructure
    const knowledgeBase = new KnowledgeBase();
    const coordinator = new AgentCoordinator(knowledgeBase);

    // Register Agents
    const config = vscode.workspace.getConfiguration('projectCartographer');
    const excludePatterns = config.get<string[]>('excludePatterns') || [];
    coordinator.registerAgent(new ArchaeologistAgent(knowledgeBase, excludePatterns));
    coordinator.registerAgent(new DetectiveAgent(knowledgeBase));
    coordinator.registerAgent(new RiskAssessorAgent(knowledgeBase));
    coordinator.registerAgent(new HistorianAgent(knowledgeBase));
    coordinator.registerAgent(new TranslatorAgent(knowledgeBase, context));
    coordinator.registerAgent(new ArchitectAgent(knowledgeBase));
    coordinator.registerAgent(new EntrypointDetectorAgent(knowledgeBase));
    coordinator.registerAgent(new DomainDetectorAgent(knowledgeBase));
    coordinator.registerAgent(new FlowTracerAgent(knowledgeBase));

    progress.report({ message: 'Agents exploring...', increment: 10 });

    // 2. Run Agents
    await coordinator.runAll(workspacePath);

    // 3. Populate Knowledge Graph from Agent Findings
    const knowledge = knowledgeBase.getAll();
    const metadata = knowledge['archaeologist'] as WorkspaceMetadata;
    const dependencies = knowledge['detective'] as Dependency[];
    const risks = knowledge['risk-assessor'] as RiskFinding[];
    const history = knowledge['historian'] as FileHistory[];
    const docs = knowledge['translator'] as FileDocumentation[];
    const insights = knowledge['architect'] as ArchitectureInsight[];

    if (risks) {
        console.log(`[RiskAssessor] Found ${risks.length} risks.`);
        risks.forEach(r => console.log(` - [${r.severity}] ${r.message} in ${r.file}:${r.line}`));
        // TODO: Add risks to graph nodes or edges for visualization
    }

    if (history) {
        console.log(`[Historian] Analyzed history for ${history.length} files.`);
        // sort by commits desc
        const hotspots = history.sort((a, b) => b.commits - a.commits).slice(0, 5);
        console.log('[Historian] Top Hotspots:');
        hotspots.forEach(h => console.log(` - ${h.file} (${h.commits} commits)`));
    }

    if (docs) {
        console.log(`[Translator] Generated docs for ${docs.length} files.`);
        docs.forEach(d => console.log(` - ${d.file}: ${d.summary.substring(0, 50)}...`));
    }

    if (insights) {
        console.log(`[Architect] Found ${insights.length} architectural insights.`);
        insights.forEach(i => console.log(` - [${i.type}] ${i.message}`));
    }

    if (metadata) {
        progress.report({ message: 'Building graph nodes...', increment: 30 });
        // Add files and folders to graph
        for (const file of metadata.files) {
            graph!.addNode({ id: file, type: 'File', data: { path: file } });
        }

        for (const folder of metadata.folders) {
            graph!.addNode({ id: folder, type: 'Folder', data: { path: folder } });
        }
    }

    if (dependencies) {
        progress.report({ message: 'Building graph edges...', increment: 40 });
        for (const dep of dependencies) {
            graph!.addEdge({
                from: dep.from,
                to: dep.to,
                type: 'IMPORTS'
            });
        }
    }

    progress.report({ message: 'Extracting functions...', increment: 50 });

    // 4. Extract functions (Legacy/Non-Agent extraction for now)
    // Ideally this should be an agent too
    const pythonExtractor = new PythonExtractor();
    const jsExtractor = new JSExtractor();
    const pendingCallLinks: Array<{ fromFunctionId: string; callName: string }> = [];

    if (metadata && metadata.files) {
        for (const file of metadata.files) {
            try {
                if (file.endsWith('.py')) {
                    const functions = await pythonExtractor.extract(file, workspacePath);
                    if (functions.length > 0) {
                        console.log(`Extracted ${functions.length} functions from ${file}`);
                    }
                    for (const func of functions) {
                        graph!.addNode({
                            id: func.id,
                            type: 'Function',
                            data: func
                        });
                        graph!.addEdge({
                            from: file,
                            to: func.id,
                            type: 'DEFINES'
                        });
                        for (const call of func.calls) {
                            pendingCallLinks.push({
                                fromFunctionId: func.id,
                                callName: call
                            });
                        }
                    }
                } else if (file.match(/\.(js|ts|jsx|tsx)$/)) {
                    const functions = await jsExtractor.extract(file, workspacePath);
                    if (functions.length > 0) {
                        console.log(`Extracted ${functions.length} functions from ${file}`);
                    }
                    for (const func of functions) {
                        graph!.addNode({
                            id: func.id,
                            type: 'Function',
                            data: func
                        });
                        graph!.addEdge({
                            from: file,
                            to: func.id,
                            type: 'DEFINES'
                        });
                        for (const call of func.calls) {
                            pendingCallLinks.push({
                                fromFunctionId: func.id,
                                callName: call
                            });
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to extract from ${file}:`, error);
            }
        }

        const allFunctionNodes = graph!.getNodesByType('Function');
        const functionLookup = new Map<string, typeof allFunctionNodes>();

        for (const functionNode of allFunctionNodes) {
            const functionName = String(functionNode.data?.name || '').toLowerCase();
            if (!functionName) {
                continue;
            }

            if (!functionLookup.has(functionName)) {
                functionLookup.set(functionName, []);
            }
            functionLookup.get(functionName)!.push(functionNode);
        }

        for (const pending of pendingCallLinks) {
            const calledCandidates = functionLookup.get(String(pending.callName || '').toLowerCase()) || [];
            if (calledCandidates.length === 0) {
                continue;
            }

            const fromNode = graph!.getNode(pending.fromFunctionId);
            const fromFile = fromNode?.data?.file;
            const preferredTarget = calledCandidates.find(candidate => candidate.data?.file === fromFile) || calledCandidates[0];

            if (preferredTarget && preferredTarget.id !== pending.fromFunctionId) {
                graph!.addEdge({
                    from: pending.fromFunctionId,
                    to: preferredTarget.id,
                    type: 'CALLS'
                });
            }
        }
    }

    progress.report({ message: 'Finalizing graph...', increment: 90 });

    console.log(`Graph built: ${graph!.getNodeCount()} nodes, ${graph!.getEdgeCount()} edges`);

    return knowledgeBase.getAll();
}

export function deactivate() {
    graph = null;
    orchestrator = null;
    agentData = null;
    geminiClient = null;
    buildPromise = null;
    currentWorkspacePath = null;
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = null;
    }
}

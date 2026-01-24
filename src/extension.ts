import * as vscode from 'vscode';
import { WorkspaceScanner } from './workspace/scanner';
import { ArchaeologistAgent } from './agents/archaeologist';
import { DetectiveAgent } from './agents/detective';
import { PythonExtractor } from './extractors/pythonExtractor';
import { JSExtractor } from './extractors/jsExtractor';
import { KnowledgeGraph } from './graph/knowledgeGraph';
import { QueryOrchestrator } from './orchestrator';
import { GeminiClient } from './llm/geminiClient';
import { createWebviewPanel } from './ui/webview';

let graph: KnowledgeGraph | null = null;
let orchestrator: QueryOrchestrator | null = null;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Project Cartographer is now active!');

    // Initialize graph
    graph = new KnowledgeGraph();

    // Initialize Gemini client (optional)
    const geminiClient = new GeminiClient(context);

    // Register command
    const disposable = vscode.commands.registerCommand('projectCartographer.openView', async () => {
        if (!graph) {
            vscode.window.showErrorMessage('Graph not initialized yet. Please wait for the graph to finish building.');
            return;
        }
        if (!orchestrator) {
            vscode.window.showWarningMessage('Orchestrator not ready yet. Graph is still building...');
            return;
        }
        const panel = createWebviewPanel(context.extensionUri, graph, orchestrator);
        context.subscriptions.push(panel);
    });

    context.subscriptions.push(disposable);

    // Build graph in background
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Building codebase graph...",
        cancellable: false
    }, async (progress) => {
        try {
            await buildKnowledgeGraph(progress);
            orchestrator = new QueryOrchestrator(graph!, geminiClient);
            
            // Open view automatically after build
            const panel = createWebviewPanel(context.extensionUri, graph!, orchestrator);
            context.subscriptions.push(panel);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to build graph: ${errorMessage}`);
            console.error('Graph building error:', error);
        }
    });
}

async function buildKnowledgeGraph(progress: vscode.Progress<{ message?: string; increment?: number }>) {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        throw new Error('No workspace folder found');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const workspacePath = workspaceFolder.uri.fsPath;

    progress.report({ message: 'Scanning workspace...', increment: 10 });
    
    // 1. Scan workspace
    const scanner = new WorkspaceScanner();
    const fileTree = await scanner.scan(workspacePath);
    
    progress.report({ message: 'Analyzing structure...', increment: 20 });
    
    // 2. Archaeologist - extract metadata
    const archaeologist = new ArchaeologistAgent();
    const metadata = await archaeologist.analyze(fileTree, workspacePath);
    
    // Add files and folders to graph
    for (const file of metadata.files) {
        graph!.addNode({ id: file, type: 'File', data: { path: file } });
    }
    
    for (const folder of metadata.folders) {
        graph!.addNode({ id: folder, type: 'Folder', data: { path: folder } });
    }
    
    progress.report({ message: 'Extracting dependencies...', increment: 30 });
    
    // 3. Detective - extract imports
    const detective = new DetectiveAgent();
    const dependencies = await detective.extractDependencies(metadata.files, workspacePath);
    
    for (const dep of dependencies) {
        graph!.addEdge({
            from: dep.from,
            to: dep.to,
            type: 'IMPORTS'
        });
    }
    
    progress.report({ message: 'Extracting functions...', increment: 50 });
    
    // 4. Extract functions
    const pythonExtractor = new PythonExtractor();
    const jsExtractor = new JSExtractor();
    
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
                    // Note: func.calls are function names, not function IDs
                    // We'll try to match them to actual function nodes
                    for (const call of func.calls) {
                        // Try to find a function with this name
                        const calledFunctions = graph!.getNodesByType('Function').filter(
                            f => f.data.name === call || f.id.includes(`::${call}`)
                        );
                        if (calledFunctions.length > 0) {
                            // Link to the first match
                            graph!.addEdge({
                                from: func.id,
                                to: calledFunctions[0].id,
                                type: 'CALLS'
                            });
                        }
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
                    // Try to match call names to actual function nodes
                    for (const call of func.calls) {
                        const calledFunctions = graph!.getNodesByType('Function').filter(
                            f => f.data.name === call || f.id.includes(`::${call}`)
                        );
                        if (calledFunctions.length > 0) {
                            graph!.addEdge({
                                from: func.id,
                                to: calledFunctions[0].id,
                                type: 'CALLS'
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to extract from ${file}:`, error);
        }
    }
    
    progress.report({ message: 'Finalizing graph...', increment: 90 });
    
    console.log(`Graph built: ${graph!.getNodeCount()} nodes, ${graph!.getEdgeCount()} edges`);
}

export function deactivate() {
    graph = null;
    orchestrator = null;
}

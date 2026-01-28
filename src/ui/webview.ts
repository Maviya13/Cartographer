import * as vscode from 'vscode';
import { KnowledgeGraph } from '../graph/knowledgeGraph';
import { QueryOrchestrator } from '../orchestrator';
import * as fs from 'fs';
import * as path from 'path';

export function createWebviewPanel(
    extensionUri: vscode.Uri,
    graph: KnowledgeGraph,
    orchestrator: QueryOrchestrator,
    data?: any
): vscode.Disposable {
    const panel = vscode.window.createWebviewPanel(
        'projectCartographer',
        'Project Cartographer',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'out'),
                vscode.Uri.joinPath(extensionUri, 'src')
            ]
        }
    );

    panel.webview.html = getWebviewContent(panel.webview, extensionUri);

    // Get all files for dropdown
    const allFiles = graph.getNodesByType('File').map(n => n.data.path);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'getFiles':
                    panel.webview.postMessage({
                        command: 'files',
                        files: allFiles
                    });
                    break;

                case 'runQuery':
                    try {
                        console.log('Query received:', message.question);
                        panel.webview.postMessage({
                            command: 'loading',
                            loading: true
                        });

                        console.log('Running query through orchestrator...');
                        // Check if orchestrator is valid
                        if (!orchestrator) {
                            throw new Error('Orchestrator is not initialized.');
                        }
                        const result = await orchestrator.runQuery(message.question);
                        console.log('Query result:', result);

                        panel.webview.postMessage({
                            command: 'result',
                            result,
                            loading: false
                        });
                        console.log('Result message sent to webview');
                    } catch (error) {
                        console.error('Query error:', error);
                        panel.webview.postMessage({
                            command: 'error',
                            error: error instanceof Error ? error.message : String(error),
                            loading: false
                        });
                    }
                    break;

                case 'openFile':
                    try {
                        const doc = await vscode.workspace.openTextDocument(message.file);
                        await vscode.window.showTextDocument(doc);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to open file: ${message.file}`);
                    }
                    break;

                case 'getGraphData':
                    try {
                        // Serialize graph for D3 visualization
                        const nodes = [];
                        const links = [];

                        // Get risk data from knowledge base if available
                        const riskData = data?.['risk-assessor'] || [];
                        const riskMap = new Map();
                        riskData.forEach((r: any) => {
                            if (r.file) riskMap.set(r.file, r.severity);
                        });
                        // Add file nodes
                        const fileNodes = graph.getNodesByType('File');
                        for (const node of fileNodes) {
                            const filePath = node.data.path || node.id;
                            const fileRisk = riskMap.get(filePath) || 'LOW';
                            
                            nodes.push({
                                id: node.id,
                                label: path.basename(filePath),
                                type: 'File',
                                risk: fileRisk,
                                centrality: 0,
                                filePath: filePath,
                                isolated: false
                            });
                        }

                        // Add function nodes
                        const funcNodes = graph.getNodesByType('Function');
                        for (const node of funcNodes) {
                            const inEdges = graph.getIncomingEdges(node.id).filter(e => e.type === 'CALLS');
                            const outEdges = graph.getOutgoingEdges(node.id).filter(e => e.type === 'CALLS');
                            const centrality = inEdges.length + outEdges.length;

                            nodes.push({
                                id: node.id,
                                label: node.data.name || node.id.split(':').pop() || node.id,
                                type: 'Function',
                                risk: node.data.risk || 'LOW',
                                centrality,
                                filePath: node.data.file,
                            isolated: centrality === 0
                        });
                        }

                        // Add edges
                        for (const node of [...fileNodes, ...funcNodes]) {
                            const edges = graph.getOutgoingEdges(node.id);
                            for (const edge of edges) {
                                if (edge.type === 'CALLS' || edge.type === 'IMPORTS') {
                                    links.push({
                                        source: edge.from,
                                        target: edge.to,
                                        type: edge.type
                                    });
                                }
                            }
                        }
                        // Mark truly isolated nodes (no edges at all)
                        const connectedIds = new Set();
                        links.forEach(l => {
                            connectedIds.add(l.source);
                            connectedIds.add(l.target);
                        });
                        nodes.forEach((n: any) => {
                            if (!connectedIds.has(n.id)) {
                                n.isolated = true;
                                n.risk = 'ISOLATED'; // Special risk level for isolated nodes
                            }
                        });

                        panel.webview.postMessage({
                            command: 'graphData',
                            data: { nodes, links }
                        });
                    } catch (error) {
                        console.error('Graph data error:', error);
                        panel.webview.postMessage({
                            command: 'error',
                            error: 'Failed to load graph data'
                        });
                    }
                    break;
            }
        },
        undefined,
        []
    );

    // Send initial files list
    panel.webview.postMessage({
        command: 'files',
        files: allFiles
    });

    // Send agent data
    if (data) {
        setTimeout(() => {
            panel.webview.postMessage({
                command: 'data',
                data: data
            });
        }, 500); // Small delay to ensure webview is ready
    }

    return panel;
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    try {
        // Construct path to the HTML file
        // Note: In development, it's in src/ui/dashboard.html
        // In production (compile), it will be in out/ui/dashboard.html
        // We added copy-assets, so we should look in out/ui first if running from there.

        let htmlPath = vscode.Uri.joinPath(extensionUri, 'out', 'ui', 'dashboard.html');

        // Check if out file exists
        if (!fs.existsSync(htmlPath.fsPath)) {
            // Fallback to src for dev mode if cp didn't run
            htmlPath = vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'dashboard.html');
        }

        const fsPath = htmlPath.fsPath;
        if (fs.existsSync(fsPath)) {
            let html = fs.readFileSync(fsPath, 'utf-8');
            return html;
        } else {
            console.error('dashboard.html not found at ' + fsPath);
            return `<!DOCTYPE html><html><body><h1>Error loading dashboard</h1><p>File not found: ${fsPath}</p></body></html>`;
        }
    } catch (e) {
        console.error('Failed to load dashboard.html', e);
        return `<!DOCTYPE html><html><body><h1>Error loading dashboard</h1><p>${String(e)}</p></body></html>`;
    }
}

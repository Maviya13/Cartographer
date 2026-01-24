import * as vscode from 'vscode';
import { KnowledgeGraph } from '../graph/knowledgeGraph';
import { QueryOrchestrator } from '../orchestrator';

export function createWebviewPanel(
    extensionUri: vscode.Uri,
    graph: KnowledgeGraph,
    orchestrator: QueryOrchestrator
): vscode.Disposable {
    const panel = vscode.window.createWebviewPanel(
        'projectCartographer',
        'Project Cartographer',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true
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
    
    return panel;
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Cartographer</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: var(--vscode-textLink-foreground);
            margin-bottom: 20px;
        }
        .input-section {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        select, input, button {
            width: 100%;
            padding: 8px;
            margin-bottom: 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            font-weight: bold;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .results {
            margin-top: 20px;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .result-item {
            margin: 10px 0;
            padding: 10px;
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 2px;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
        .error {
            color: var(--vscode-errorForeground);
            padding: 10px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border-radius: 2px;
        }
        .file-list {
            max-height: 300px;
            overflow-y: auto;
            margin-top: 10px;
        }
        .file-item {
            padding: 5px;
            cursor: pointer;
            border-radius: 2px;
        }
        .file-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .explanation {
            margin-top: 15px;
            padding: 10px;
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            border-radius: 2px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🗺️ Project Cartographer</h1>
        
        <div class="input-section">
            <label for="question">Ask a question about your codebase:</label>
            <input type="text" id="question" placeholder="e.g., What breaks if I change calculateTotal?" />
            <button id="runButton">Run Query</button>
        </div>
        
        <div id="loading" class="loading" style="display: none;">Analyzing codebase...</div>
        <div id="error" class="error" style="display: none;"></div>
        
        <div id="results" class="results" style="display: none;">
            <h2>Results</h2>
            <div id="resultContent"></div>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const questionInput = document.getElementById('question');
        const runButton = document.getElementById('runButton');
        const loadingDiv = document.getElementById('loading');
        const errorDiv = document.getElementById('error');
        const resultsDiv = document.getElementById('results');
        const resultContent = document.getElementById('resultContent');
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('Received message:', message.command, message);
            
            switch (message.command) {
                case 'files':
                    // Files received, can populate dropdown if needed
                    console.log('Files received:', message.files?.length);
                    break;
                    
                case 'loading':
                    console.log('Loading state:', message.loading);
                    loadingDiv.style.display = message.loading ? 'block' : 'none';
                    runButton.disabled = message.loading;
                    errorDiv.style.display = 'none';
                    resultsDiv.style.display = 'none';
                    break;
                    
                case 'result':
                    console.log('Result received:', message.result);
                    loadingDiv.style.display = 'none';
                    runButton.disabled = false;
                    displayResult(message.result);
                    break;
                    
                case 'error':
                    console.error('Error received:', message.error);
                    loadingDiv.style.display = 'none';
                    runButton.disabled = false;
                    errorDiv.textContent = message.error || 'Unknown error occurred';
                    errorDiv.style.display = 'block';
                    resultsDiv.style.display = 'none';
                    break;
                    
                default:
                    console.log('Unknown message command:', message.command);
            }
        });
        
        runButton.addEventListener('click', () => {
            const question = questionInput.value.trim();
            console.log('Run button clicked, question:', question);
            if (question) {
                console.log('Sending query message...');
                vscode.postMessage({
                    command: 'runQuery',
                    question: question
                });
            } else {
                console.log('Question is empty');
            }
        });
        
        questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                runButton.click();
            }
        });
        
        function displayResult(result) {
            console.log('Displaying result:', result);
            if (!result) {
                console.error('Result is null or undefined');
                errorDiv.textContent = 'No result received';
                errorDiv.style.display = 'block';
                return;
            }
            
            // Store result for click handlers
            window.lastQueryResult = result;
            
            resultsDiv.style.display = 'block';
            let html = '<div class="result-item">';
            html += '<strong>Intent:</strong> ' + escapeHtml(result.intent || 'unknown') + '<br>';
            
            if (result.contextPreview) {
                html += '<div class="explanation"><strong>Explanation:</strong><br>' + escapeHtml(result.contextPreview) + '</div>';
            }
            
            if (result.files && result.files.length > 0) {
                html += '<strong>Files (' + result.files.length + '):</strong><ul class="file-list">';
                result.files.slice(0, 20).forEach((file, index) => {
                    // Use data attribute and escape properly
                    const escapedFile = escapeHtml(file);
                    html += '<li class="file-item" data-file-index="' + index + '">' + escapedFile + '</li>';
                });
                html += '</ul>';
            } else {
                html += '<p>No files found.</p>';
            }
            
            if (result.functions && result.functions.length > 0) {
                html += '<strong>Functions (' + result.functions.length + '):</strong><ul>';
                result.functions.slice(0, 20).forEach(func => {
                    html += '<li>' + escapeHtml(func) + '</li>';
                });
                html += '</ul>';
            }
            
            if (result.metadata) {
                html += '<details><summary>Metadata</summary><pre>' + escapeHtml(JSON.stringify(result.metadata, null, 2)) + '</pre></details>';
            }
            
            // Show message if no results
            if ((!result.files || result.files.length === 0) && (!result.functions || result.functions.length === 0)) {
                html += '<p><em>No results found. Try a different query.</em></p>';
            }
            
            html += '</div>';
            resultContent.innerHTML = html;
            console.log('Result HTML set, resultsDiv should be visible');
            
            // Attach click handlers after HTML is inserted
            setTimeout(() => {
                const fileItems = document.querySelectorAll('.file-item');
                fileItems.forEach((item) => {
                    item.addEventListener('click', () => {
                        const fileIndex = parseInt(item.getAttribute('data-file-index') || '0');
                        if (window.lastQueryResult && window.lastQueryResult.files && window.lastQueryResult.files[fileIndex]) {
                            openFile(window.lastQueryResult.files[fileIndex]);
                        }
                    });
                });
            }, 0);
        }
        
        function escapeHtml(text) {
            if (typeof text !== 'string') {
                text = String(text);
            }
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function openFile(filePath) {
            vscode.postMessage({
                command: 'openFile',
                file: filePath
            });
        }
    </script>
</body>
</html>`;
}

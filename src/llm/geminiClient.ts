import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Gemini API Client for LLM explanations
 * 
 * This is used ONLY for explaining graph query results.
 * The LLM never decides what to analyze - that's done by the graph queries.
 */
export class GeminiClient {
    private genAI: GoogleGenerativeAI | null = null;
    private enabled: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.initialize(context);
        
        // Listen for configuration changes
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('projectCartographer')) {
                    this.initialize(context);
                }
            })
        );
    }

    private initialize(context: vscode.ExtensionContext) {
        // Try to get API key from .env file first
        let apiKey = this.getApiKeyFromEnv();
        
        // Fallback to VS Code settings if .env doesn't have it
        if (!apiKey) {
            const config = vscode.workspace.getConfiguration('projectCartographer');
            apiKey = config.get<string>('geminiApiKey', '');
        }
        
        // Enable LLM if we have an API key (from .env or settings)
        // Or check VS Code setting if no .env key
        const config = vscode.workspace.getConfiguration('projectCartographer');
        const enableFromSettings = config.get<boolean>('enableLLM', false);
        this.enabled = !!apiKey || enableFromSettings;

        if (apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
                console.log('Gemini API initialized successfully');
            } catch (error) {
                console.error('Failed to initialize Gemini client:', error);
                this.genAI = null;
                this.enabled = false;
            }
        } else {
            this.genAI = null;
            if (this.enabled) {
                console.warn('Gemini API key not found. Please add GEMINI_API_KEY to .env file or VS Code settings.');
            }
        }
    }
    
    private getApiKeyFromEnv(): string | null {
        try {
            // Get workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return null;
            }
            
            // Look for .env file in workspace root
            const envPath = path.join(workspaceFolder.uri.fsPath, '.env');
            
            if (!fs.existsSync(envPath)) {
                return null;
            }
            
            // Read .env file
            const envContent = fs.readFileSync(envPath, 'utf-8');
            const lines = envContent.split('\n');
            
            // Parse .env file (simple parser)
            for (const line of lines) {
                const trimmed = line.trim();
                // Skip comments and empty lines
                if (!trimmed || trimmed.startsWith('#')) {
                    continue;
                }
                
                // Look for GEMINI_API_KEY
                const match = trimmed.match(/^GEMINI_API_KEY\s*=\s*(.+)$/);
                if (match) {
                    // Remove quotes if present
                    const key = match[1].trim().replace(/^["']|["']$/g, '');
                    if (key) {
                        console.log('Found GEMINI_API_KEY in .env file');
                        return key;
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to read .env file:', error);
        }
        
        return null;
    }

    /**
     * Generate explanation for graph query results
     * 
     * Role: Explainer, not reasoner
     * The graph query has already determined what's relevant.
     * This just explains it in natural language.
     */
    async explainResult(
        question: string,
        intent: string,
        files: string[],
        functions: string[],
        metadata: any,
        contextPreview?: string
    ): Promise<string | null> {
        if (!this.enabled || !this.genAI) {
            return null;
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

            const prompt = this.buildExplanationPrompt(
                question,
                intent,
                files,
                functions,
                metadata,
                contextPreview
            );

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini API error:', error);
            return null;
        }
    }

    private buildExplanationPrompt(
        question: string,
        intent: string,
        files: string[],
        functions: string[],
        metadata: any,
        contextPreview?: string
    ): string {
        return `You are an AI assistant explaining codebase analysis results. Your role is to EXPLAIN, not to analyze.

The graph-based analysis has already been completed. Your job is to explain the results clearly.

Question: ${question}
Query Intent: ${intent}

Results:
- Files: ${files.length} files
${files.slice(0, 10).map(f => `  - ${f}`).join('\n')}
${files.length > 10 ? `  ... and ${files.length - 10} more` : ''}

${functions.length > 0 ? `- Functions: ${functions.length} functions\n${functions.slice(0, 10).map(f => `  - ${f}`).join('\n')}\n${functions.length > 10 ? `  ... and ${functions.length - 10} more` : ''}` : ''}

${metadata ? `Metadata:\n${JSON.stringify(metadata, null, 2)}` : ''}

${contextPreview ? `Context Preview:\n${contextPreview}` : ''}

Provide a clear, concise explanation of what these results mean in the context of the question. 
Focus on explaining the relationships and implications. Do NOT make up or infer additional structure.
Keep it under 200 words.`;
    }

    /**
     * Answer general questions about the codebase by reading project files
     * This is used for queries that need code understanding, not just graph analysis
     */
    async answerCodebaseQuestion(
        question: string,
        projectFiles: Array<{ path: string; content: string }>
    ): Promise<string | null> {
        if (!this.enabled || !this.genAI) {
            return null;
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

            // Build context from project files
            const codeContext = projectFiles.map(file => 
                `=== ${file.path} ===\n${file.content}\n`
            ).join('\n');

            const prompt = `You are an AI assistant helping a developer understand their codebase.

The user asked: "${question}"

Here are the relevant files from the project:

${codeContext}

Please answer the user's question based on the code you see. Be specific, reference file names and functions when relevant. If you need more context, mention which files would be helpful to see.

Keep your answer clear and concise.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini API error:', error);
            return null;
        }
    }

    isEnabled(): boolean {
        return this.enabled && this.genAI !== null;
    }
}

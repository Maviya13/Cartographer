import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import * as vscode from 'vscode';

export interface ExtractedFunction {
    id: string;
    file: string;
    name: string;
    calls: string[];
    startLine: number;
    endLine: number;
    language: 'python';
}

export class PythonExtractor {
    private pythonScriptPath: string;
    
    constructor() {
        // Path to the Python AST helper script
        // __dirname in compiled output will be something like: .../out/extractors
        // We need to find the project root
        const fs = require('fs');
        let scriptPath: string | null = null;
        
        // Strategy 1: Check if we're in out/ directory, look for out/extractors/python_ast_helper.py
        const outPath = path.join(__dirname, 'python_ast_helper.py');
        if (fs.existsSync(outPath)) {
            scriptPath = outPath;
        } else {
            // Strategy 2: Go up from out/extractors to find project root, then check out/extractors
            const possibleRoot = path.resolve(__dirname, '../..');
            const outScriptPath = path.join(possibleRoot, 'out', 'extractors', 'python_ast_helper.py');
            if (fs.existsSync(outScriptPath)) {
                scriptPath = outScriptPath;
            } else {
                // Strategy 3: Check source directory
                const srcScriptPath = path.join(possibleRoot, 'src', 'extractors', 'python_ast_helper.py');
                if (fs.existsSync(srcScriptPath)) {
                    scriptPath = srcScriptPath;
                }
            }
        }
        
        if (!scriptPath) {
            console.error('Python AST helper script not found. Tried:', {
                outPath,
                possibleRoot: path.resolve(__dirname, '../..'),
                __dirname
            });
            // Fallback - will fail but at least we tried
            scriptPath = path.join(__dirname, 'python_ast_helper.py');
        }
        
        this.pythonScriptPath = scriptPath;
        console.log('Python script path resolved to:', this.pythonScriptPath);
    }
    
    async extract(filePath: string, workspacePath: string): Promise<ExtractedFunction[]> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            
            // Use Python script to parse AST
            const result = await this.runPythonScript(filePath, content);
            
            // Handle error response from Python script
            if (result && typeof result === 'object' && 'error' in result) {
                console.warn(`Python script error for ${filePath}:`, result.error);
                return [];
            }
            
            if (!Array.isArray(result)) {
                console.warn(`Unexpected result format from Python script for ${filePath}:`, result);
                return [];
            }
            
            return result.map(func => ({
                id: `${filePath}::${func.name}`,
                file: filePath,
                name: func.name,
                calls: func.calls || [],
                startLine: func.start_line,
                endLine: func.end_line,
                language: 'python' as const
            }));
        } catch (error) {
            console.warn(`Failed to extract from ${filePath}:`, error);
            return [];
        }
    }
    
    private async runPythonScript(filePath: string, content: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const fs = require('fs');
            if (!fs.existsSync(this.pythonScriptPath)) {
                reject(new Error(`Python script not found at: ${this.pythonScriptPath}`));
                return;
            }
            
            const python = spawn('python3', [this.pythonScriptPath]);
            let stdout = '';
            let stderr = '';
            
            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            python.on('error', (error) => {
                reject(new Error(`Failed to spawn Python process: ${error.message}. Make sure python3 is installed.`));
            });
            
            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script failed (exit code ${code}): ${stderr || 'No error message'}`));
                    return;
                }
                
                if (!stdout.trim()) {
                    reject(new Error('Python script produced no output'));
                    return;
                }
                
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (error) {
                    reject(new Error(`Failed to parse Python output: ${error}. Output was: ${stdout.substring(0, 200)}`));
                }
            });
            
            // Send content to script
            try {
                python.stdin.write(JSON.stringify({ file: filePath, content }));
                python.stdin.end();
            } catch (error) {
                reject(new Error(`Failed to write to Python script: ${error}`));
            }
        });
    }
}

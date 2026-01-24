import * as fs from 'fs/promises';
import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

export interface ExtractedFunction {
    id: string;
    file: string;
    name: string;
    calls: string[];
    startLine: number;
    endLine: number;
    language: 'javascript' | 'typescript';
}

export class JSExtractor {
    async extract(filePath: string, workspacePath: string): Promise<ExtractedFunction[]> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
            
            const ast = parser.parse(content, {
                sourceType: 'module',
                plugins: [
                    'typescript',
                    'jsx',
                    'decorators-legacy',
                    'classProperties'
                ]
            });
            
            const functions: ExtractedFunction[] = [];
            
            // Bind extractCalls to maintain 'this' context
            const extractCalls = (path: NodePath<any>): string[] => {
                return this.extractCalls(path);
            };
            
            traverse(ast, {
                // Function declarations
                FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
                    const node = path.node;
                    const name = node.id?.name || '<anonymous>';
                    const calls = extractCalls(path);
                    
                    functions.push({
                        id: `${filePath}::${name}`,
                        file: filePath,
                        name,
                        calls,
                        startLine: node.loc?.start.line || 0,
                        endLine: node.loc?.end.line || 0,
                        language: isTypeScript ? 'typescript' : 'javascript'
                    });
                },
                
                // Arrow functions and function expressions
                VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
                    if (t.isArrowFunctionExpression(path.node.init) || 
                        t.isFunctionExpression(path.node.init)) {
                        const name = t.isIdentifier(path.node.id) ? path.node.id.name : '<anonymous>';
                        const funcNode = path.node.init;
                        const calls = extractCalls(path.get('init') as NodePath<t.FunctionExpression | t.ArrowFunctionExpression>);
                        
                        functions.push({
                            id: `${filePath}::${name}`,
                            file: filePath,
                            name,
                            calls,
                            startLine: funcNode.loc?.start.line || 0,
                            endLine: funcNode.loc?.end.line || 0,
                            language: isTypeScript ? 'typescript' : 'javascript'
                        });
                    }
                },
                
                // Method definitions in classes
                ClassMethod(path: NodePath<t.ClassMethod>) {
                    const node = path.node;
                    const name = t.isIdentifier(node.key) ? node.key.name : '<anonymous>';
                    const calls = extractCalls(path);
                    
                    functions.push({
                        id: `${filePath}::${name}`,
                        file: filePath,
                        name,
                        calls,
                        startLine: node.loc?.start.line || 0,
                        endLine: node.loc?.end.line || 0,
                        language: isTypeScript ? 'typescript' : 'javascript'
                    });
                }
            });
            
            return functions;
        } catch (error) {
            console.warn(`Failed to extract from ${filePath}:`, error);
            return [];
        }
    }
    
    private extractCalls(path: NodePath<any>): string[] {
        const calls: string[] = [];
        
        path.traverse({
            CallExpression(callPath: NodePath<t.CallExpression>) {
                const callee = callPath.node.callee;
                if (t.isIdentifier(callee)) {
                    calls.push(callee.name);
                } else if (t.isMemberExpression(callee)) {
                    if (t.isIdentifier(callee.property)) {
                        calls.push(callee.property.name);
                    }
                }
            }
        });
        
        return [...new Set(calls)]; // Remove duplicates
    }
}

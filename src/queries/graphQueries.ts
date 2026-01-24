import { KnowledgeGraph, GraphNode, GraphEdge } from '../graph/knowledgeGraph';

export interface BlastRadiusResult {
    functionId: string;
    affectedFunctions: string[];
    affectedFiles: string[];
    depth: number;
}

export interface CentralityResult {
    functionId: string;
    inDegree: number;
    outDegree: number;
    centrality: number;
}

export interface FileImportanceResult {
    fileId: string;
    importance: number;
    functionCount: number;
    centralitySum: number;
}

export class GraphQueries {
    constructor(private graph: KnowledgeGraph) {}
    
    /**
     * Calculate blast radius - what breaks if we change this function?
     * Uses BFS with depth limit
     */
    functionBlastRadius(functionId: string, maxDepth: number = 5): BlastRadiusResult {
        const visited = new Set<string>();
        const queue: Array<{ id: string; depth: number }> = [{ id: functionId, depth: 0 }];
        const affectedFunctions = new Set<string>();
        const affectedFiles = new Set<string>();
        
        visited.add(functionId);
        
        while (queue.length > 0) {
            const { id, depth } = queue.shift()!;
            
            if (depth >= maxDepth) {
                continue;
            }
            
            // Get all functions that call this one
            const incoming = this.graph.getIncomingEdges(id);
            for (const edge of incoming) {
                if (edge.type === 'CALLS' && !visited.has(edge.from)) {
                    visited.add(edge.from);
                    const node = this.graph.getNode(edge.from);
                    if (node && node.type === 'Function') {
                        affectedFunctions.add(edge.from);
                        affectedFiles.add(node.data.file);
                        queue.push({ id: edge.from, depth: depth + 1 });
                    }
                }
            }
            
            // Also check what this function calls
            const outgoing = this.graph.getOutgoingEdges(id);
            for (const edge of outgoing) {
                if (edge.type === 'CALLS' && !visited.has(edge.to)) {
                    visited.add(edge.to);
                    const node = this.graph.getNode(edge.to);
                    if (node && node.type === 'Function') {
                        affectedFunctions.add(edge.to);
                        if (node.data.file) {
                            affectedFiles.add(node.data.file);
                        }
                        queue.push({ id: edge.to, depth: depth + 1 });
                    }
                }
            }
        }
        
        return {
            functionId,
            affectedFunctions: Array.from(affectedFunctions),
            affectedFiles: Array.from(affectedFiles),
            depth: maxDepth
        };
    }
    
    /**
     * Calculate function centrality (in-degree + out-degree)
     * Also includes functions with 0 centrality (no connections) at the end
     */
    functionCentrality(): CentralityResult[] {
        const functions = this.graph.getNodesByType('Function');
        const results: CentralityResult[] = [];
        
        for (const func of functions) {
            const incoming = this.graph.getIncomingEdges(func.id).filter(e => e.type === 'CALLS');
            const outgoing = this.graph.getOutgoingEdges(func.id).filter(e => e.type === 'CALLS');
            
            const inDegree = incoming.length;
            const outDegree = outgoing.length;
            const centrality = inDegree + outDegree;
            
            results.push({
                functionId: func.id,
                inDegree,
                outDegree,
                centrality
            });
        }
        
        // Sort by centrality (descending), but include all functions
        // Functions with 0 centrality are still important - they might be entry points
        return results.sort((a, b) => {
            // First sort by centrality
            if (b.centrality !== a.centrality) {
                return b.centrality - a.centrality;
            }
            // Then by name for consistency
            return a.functionId.localeCompare(b.functionId);
        });
    }
    
    /**
     * Calculate file importance based on function centrality
     */
    fileImportance(): FileImportanceResult[] {
        const centrality = this.functionCentrality();
        const fileScores = new Map<string, { functionCount: number; centralitySum: number }>();
        
        // Aggregate by file
        for (const func of this.graph.getNodesByType('Function')) {
            const file = func.data.file;
            if (!file) continue;
            
            const funcCentrality = centrality.find(c => c.functionId === func.id);
            if (!funcCentrality) continue;
            
            if (!fileScores.has(file)) {
                fileScores.set(file, { functionCount: 0, centralitySum: 0 });
            }
            
            const score = fileScores.get(file)!;
            score.functionCount++;
            score.centralitySum += funcCentrality.centrality;
        }
        
        const results: FileImportanceResult[] = [];
        for (const [fileId, score] of fileScores.entries()) {
            results.push({
                fileId,
                importance: score.centralitySum / Math.max(score.functionCount, 1),
                functionCount: score.functionCount,
                centralitySum: score.centralitySum
            });
        }
        
        return results.sort((a, b) => b.importance - a.importance);
    }
    
    /**
     * Find function by name (fuzzy search)
     */
    findFunctionByName(query: string): GraphNode[] {
        const functions = this.graph.getNodesByType('Function');
        const lowerQuery = query.toLowerCase();
        
        return functions.filter(func => {
            const name = func.data.name?.toLowerCase() || '';
            return name.includes(lowerQuery) || func.id.toLowerCase().includes(lowerQuery);
        });
    }
}

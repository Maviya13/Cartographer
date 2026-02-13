import { Agent } from './base/agent';
import { KnowledgeBase } from '../knowledge/knowledge-base';

export interface FlowPath {
    nodeId: string;
    depth: number;
    path: string[];
    isOnCriticalPath: boolean;
}

export class FlowTracerAgent extends Agent {
    private flowPaths: Map<string, FlowPath> = new Map();

    constructor(knowledgeBase: KnowledgeBase) {
        super(
            {
                name: 'FlowTracer',
                priority: 9
            },
            knowledgeBase
        );
    }

    async explore(workspacePath: string): Promise<void> {
        this.log('Tracing execution flows...');

        // Get entrypoints
        const entrypointData = this.knowledgeBase.get('entrypoint-detector') || [];
        if (!entrypointData || entrypointData.length === 0) {
            this.log('No entrypoints found, skipping flow tracing');
            return;
        }

        // Build adjacency map from dependency graph
        const adjacencyMap = this.buildAdjacencyMap();

        if (adjacencyMap.size === 0) {
            this.log('No dependency edges found, skipping flow tracing');
            return;
        }

        // Trace flows from each entrypoint
        this.flowPaths.clear();
        for (const entrypoint of entrypointData) {
            if (entrypoint.filePath) {
                this.traceFromEntrypoint(entrypoint.filePath, adjacencyMap);
            }
        }

        // Store results
        const flowData = Array.from(this.flowPaths.values());
        this.knowledgeBase.store('flow-tracer', flowData);

        this.log(`Traced ${flowData.length} flow paths`);
    }

    private buildAdjacencyMap(): Map<string, string[]> {
        const adjacencyMap = new Map<string, string[]>();
        const dependencies = this.knowledgeBase.get('detective') || [];

        for (const dependency of dependencies) {
            const from = dependency?.from;
            const to = dependency?.to;
            if (!from || !to) {
                continue;
            }

            if (!adjacencyMap.has(from)) {
                adjacencyMap.set(from, []);
            }

            const targets = adjacencyMap.get(from)!;
            if (!targets.includes(to)) {
                targets.push(to);
            }
        }

        return adjacencyMap;
    }

    private traceFromEntrypoint(entrypointId: string, adjacencyMap: Map<string, string[]>): void {
        const visited = new Set<string>();
        const queue: Array<{ id: string; depth: number; path: string[] }> = [
            { id: entrypointId, depth: 0, path: [entrypointId] }
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;

            if (visited.has(current.id)) {
                continue;
            }
            visited.add(current.id);

            // Store flow path
            const existingPath = this.flowPaths.get(current.id);
            if (!existingPath || current.depth < existingPath.depth) {
                this.flowPaths.set(current.id, {
                    nodeId: current.id,
                    depth: current.depth,
                    path: current.path,
                    isOnCriticalPath: current.depth <= 3 // Critical if within 3 hops
                });
            }

            // Add neighbors to queue
            const neighbors = adjacencyMap.get(current.id) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    queue.push({
                        id: neighbor,
                        depth: current.depth + 1,
                        path: [...current.path, neighbor]
                    });
                }
            }
        }
    }

    getFlowPaths(): Map<string, FlowPath> {
        return this.flowPaths;
    }
}

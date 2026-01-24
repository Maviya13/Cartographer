export type NodeType = 'File' | 'Folder' | 'Function' | 'Concept';
export type EdgeType = 'CONTAINS' | 'DEFINES' | 'IMPORTS' | 'CALLS';

export interface GraphNode {
    id: string;
    type: NodeType;
    data: any;
}

export interface GraphEdge {
    from: string;
    to: string;
    type: EdgeType;
}

export class KnowledgeGraph {
    private nodes: Map<string, GraphNode> = new Map();
    private edges: Map<string, GraphEdge[]> = new Map(); // from -> edges
    private reverseEdges: Map<string, GraphEdge[]> = new Map(); // to -> edges
    
    addNode(node: GraphNode): void {
        this.nodes.set(node.id, node);
        if (!this.edges.has(node.id)) {
            this.edges.set(node.id, []);
        }
        if (!this.reverseEdges.has(node.id)) {
            this.reverseEdges.set(node.id, []);
        }
    }
    
    addEdge(edge: GraphEdge): void {
        if (!this.edges.has(edge.from)) {
            this.edges.set(edge.from, []);
        }
        if (!this.reverseEdges.has(edge.to)) {
            this.reverseEdges.set(edge.to, []);
        }
        
        this.edges.get(edge.from)!.push(edge);
        this.reverseEdges.get(edge.to)!.push(edge);
    }
    
    getNode(id: string): GraphNode | undefined {
        return this.nodes.get(id);
    }
    
    hasNode(id: string): boolean {
        return this.nodes.has(id);
    }
    
    getNodesByType(type: NodeType): GraphNode[] {
        return Array.from(this.nodes.values()).filter(n => n.type === type);
    }
    
    getOutgoingEdges(nodeId: string): GraphEdge[] {
        return this.edges.get(nodeId) || [];
    }
    
    getIncomingEdges(nodeId: string): GraphEdge[] {
        return this.reverseEdges.get(nodeId) || [];
    }
    
    getEdgesByType(type: EdgeType): GraphEdge[] {
        const allEdges: GraphEdge[] = [];
        for (const edges of this.edges.values()) {
            allEdges.push(...edges.filter(e => e.type === type));
        }
        return allEdges;
    }
    
    getNodeCount(): number {
        return this.nodes.size;
    }
    
    getEdgeCount(): number {
        let count = 0;
        for (const edges of this.edges.values()) {
            count += edges.length;
        }
        return count;
    }
    
    getAllNodes(): GraphNode[] {
        return Array.from(this.nodes.values());
    }
    
    getAllEdges(): GraphEdge[] {
        const allEdges: GraphEdge[] = [];
        for (const edges of this.edges.values()) {
            allEdges.push(...edges);
        }
        return allEdges;
    }
}

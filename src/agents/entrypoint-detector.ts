import { Agent, AgentConfig } from './base/agent';
import { KnowledgeBase } from '../knowledge/knowledge-base';
import * as path from 'path';

export interface EntrypointInfo {
    nodeId: string;
    filePath: string;
    functionName?: string;
    pattern: string;
    confidence: 'high' | 'medium' | 'low';
}

export class EntrypointDetectorAgent extends Agent {
    private entrypoints: EntrypointInfo[] = [];

    constructor(knowledgeBase: KnowledgeBase) {
        super(
            {
                name: 'EntrypointDetector',
                priority: 8
            },
            knowledgeBase
        );
    }

    async explore(workspacePath: string): Promise<void> {
        this.log('Detecting entry points...');

        // Get data from other agents
        const metadata = this.knowledgeBase.get('archaeologist');
        if (!metadata || !metadata.files) {
            this.log('No file metadata found, skipping entrypoint detection');
            return;
        }

        this.entrypoints = [];

        // Detect file-level entrypoints
        this.detectFileEntrypoints(metadata.files);

        // Store results
        this.knowledgeBase.store('entrypoint-detector', this.entrypoints);

        this.log(`Found ${this.entrypoints.length} entry points`);
    }

    private detectFileEntrypoints(files: string[]): void {
        for (const filePath of files) {
            const fileName = path.basename(filePath);
            const ext = path.extname(filePath);

            // Python __main__.py
            if (fileName === '__main__.py') {
                this.addEntrypoint(filePath, filePath, undefined, 'Python __main__.py', 'high');
                continue;
            }

            // JavaScript/TypeScript index files
            if (fileName === 'index.js' || fileName === 'index.ts' ||
                fileName === 'main.js' || fileName === 'main.ts') {
                this.addEntrypoint(filePath, filePath, undefined, 'Index/Main file', 'medium');
                continue;
            }

            // Common server files
            if (fileName === 'server.js' || fileName === 'server.ts' ||
                fileName === 'app.js' || fileName === 'app.ts') {
                this.addEntrypoint(filePath, filePath, undefined, 'Server file', 'medium');
                continue;
            }

            // Django manage.py
            if (fileName === 'manage.py') {
                this.addEntrypoint(filePath, filePath, undefined, 'Django manage.py', 'high');
            }
        }
    }


    private addEntrypoint(
        nodeId: string,
        filePath: string,
        functionName: string | undefined,
        pattern: string,
        confidence: 'high' | 'medium' | 'low'
    ): void {
        this.entrypoints.push({
            nodeId,
            filePath,
            functionName,
            pattern,
            confidence
        });
    }

    getEntrypoints(): EntrypointInfo[] {
        return this.entrypoints;
    }
}

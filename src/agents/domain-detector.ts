import { Agent } from './base/agent';
import { KnowledgeBase } from '../knowledge/knowledge-base';
import * as path from 'path';

export interface DomainMapping {
    filePath: string;
    domain: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
}

export class DomainDetectorAgent extends Agent {
    private domainMappings: DomainMapping[] = [];

    // Domain keyword patterns
    private domainKeywords = {
        auth: ['auth', 'authentication', 'authorization', 'login', 'session', 'token', 'security', 'password', 'oauth'],
        users: ['user', 'profile', 'account', 'member', 'person'],
        payments: ['payment', 'billing', 'invoice', 'subscription', 'checkout', 'stripe', 'paypal'],
        products: ['product', 'catalog', 'inventory', 'item', 'goods'],
        orders: ['order', 'cart', 'purchase', 'transaction'],
        api: ['api', 'endpoint', 'route', 'controller', 'handler', 'service'],
        database: ['db', 'database', 'model', 'schema', 'migration', 'repository'],
        ui: ['ui', 'view', 'component', 'page', 'frontend', 'widget', 'template'],
        config: ['config', 'configuration', 'settings', 'env', 'environment'],
        utils: ['util', 'utility', 'helper', 'common', 'shared', 'lib'],
        tests: ['test', 'spec', '__tests__', 'testing']
    };

    // Domain colors for visualization
    private domainColors: Record<string, string> = {
        auth: '#9C27B0',
        users: '#2196F3',
        payments: '#4CAF50',
        products: '#FF9800',
        orders: '#F44336',
        api: '#00BCD4',
        database: '#795548',
        ui: '#E91E63',
        config: '#607D8B',
        utils: '#9E9E9E',
        tests: '#FFC107',
        core: '#3F51B5',
        infrastructure: '#757575'
    };

    constructor(knowledgeBase: KnowledgeBase) {
        super(
            {
                name: 'DomainDetector',
                priority: 7
            },
            knowledgeBase
        );
    }

    async explore(workspacePath: string): Promise<void> {
        this.log('Detecting business domains...');

        // Get file metadata from archaeologist
        const metadata = this.knowledgeBase.get('archaeologist');
        if (!metadata || !metadata.files) {
            this.log('No file metadata found, skipping domain detection');
            return;
        }

        this.domainMappings = [];

        // Detect domains for each file
        for (const filePath of metadata.files) {
            const domain = this.detectDomain(filePath);
            if (domain) {
                this.domainMappings.push(domain);
            }
        }

        // Store results with color mapping
        this.knowledgeBase.store('domain-detector', {
            mappings: this.domainMappings,
            colors: this.domainColors
        });

        this.log(`Detected ${this.domainMappings.length} domain mappings`);

        // Log domain distribution
        const domainCounts = this.getDomainCounts();
        this.log(`Domain distribution: ${JSON.stringify(domainCounts)}`);
    }

    private detectDomain(filePath: string): DomainMapping | null {
        const normalizedPath = filePath.toLowerCase();
        const fileName = path.basename(normalizedPath);
        const dirName = path.dirname(normalizedPath);

        // Skip node_modules and other common exclusions
        if (normalizedPath.includes('node_modules') ||
            normalizedPath.includes('.git') ||
            normalizedPath.includes('dist') ||
            normalizedPath.includes('build')) {
            return null;
        }

        // 1. Check directory structure (high confidence)
        for (const [domain, keywords] of Object.entries(this.domainKeywords)) {
            for (const keyword of keywords) {
                if (dirName.includes(`/${keyword}/`) || dirName.includes(`/${keyword}s/`)) {
                    return {
                        filePath,
                        domain,
                        confidence: 'high',
                        reason: `Directory contains '${keyword}'`
                    };
                }
            }
        }

        // 2. Check filename (medium confidence)
        for (const [domain, keywords] of Object.entries(this.domainKeywords)) {
            for (const keyword of keywords) {
                if (fileName.includes(keyword)) {
                    return {
                        filePath,
                        domain,
                        confidence: 'medium',
                        reason: `Filename contains '${keyword}'`
                    };
                }
            }
        }

        // 3. Default to 'core' for unclassified files
        return {
            filePath,
            domain: 'core',
            confidence: 'low',
            reason: 'Default classification'
        };
    }

    private getDomainCounts(): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const mapping of this.domainMappings) {
            counts[mapping.domain] = (counts[mapping.domain] || 0) + 1;
        }
        return counts;
    }

    getDomainMappings(): DomainMapping[] {
        return this.domainMappings;
    }

    getDomainColors(): Record<string, string> {
        return this.domainColors;
    }
}

import { Agent, AgentConfig } from './base/agent';
import { KnowledgeBase } from '../knowledge/knowledge-base';
import { GeminiClient } from '../llm/geminiClient';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface MarkdownExportOptions {
    outputPath: string;
    includeStats?: boolean;
    includeRisks?: boolean;
    includeDependencies?: boolean;
    useLLM?: boolean;
}

export class MarkdownExporterAgent extends Agent {
    private llmClient: GeminiClient | null = null;

    constructor(knowledgeBase: KnowledgeBase, context?: vscode.ExtensionContext) {
        super(
            {
                name: 'MarkdownExporter',
                priority: 10
            },
            knowledgeBase
        );

        if (context) {
            this.llmClient = new GeminiClient(context);
        }
    }

    async explore(workspacePath: string): Promise<void> {
        // This agent doesn't explore, it exports on demand
        this.log('Markdown exporter ready');
    }

    /**
     * Generate markdown report from graph data (public method for webview)
     */
    async generateMarkdownFromData(data: any, projectName: string, useLLM: boolean = true): Promise<string> {
        if (useLLM && this.llmClient) {
            return await this.generateLLMEnhancedMarkdown(data, projectName);
        }

        return this.generateMarkdown(data, projectName, {
            outputPath: '',
            includeStats: true,
            includeRisks: true,
            includeDependencies: true
        });
    }

    /**
     * Generate architecture.md report from current graph data
     */
    async exportArchitecture(workspacePath: string, options: MarkdownExportOptions): Promise<string> {
        this.log('Generating architecture.md...');

        const data = this.knowledgeBase.getData();
        const markdown = this.generateMarkdown(data, path.basename(workspacePath), options);

        // Write to file
        const outputFile = path.join(options.outputPath, 'architecture.md');
        fs.writeFileSync(outputFile, markdown, 'utf-8');

        this.log(`Architecture report saved to ${outputFile}`);
        return outputFile;
    }

    /**
     * Generate LLM-enhanced markdown with intelligent insights
     */
    private async generateLLMEnhancedMarkdown(data: any, projectName: string): Promise<string> {
        const sections: string[] = [];

        // Header
        sections.push(`# ${projectName} - Architecture Documentation\n`);
        sections.push(`*Generated on ${new Date().toLocaleDateString()} with AI-powered analysis*\n`);

        // Prepare data summary for LLM
        const dataSummary = this.prepareDataSummary(data);

        try {
            // Use LLM to generate intelligent overview
            const overviewPrompt = `Analyze this codebase structure and provide a comprehensive overview:

Project: ${projectName}
Files: ${data.nodes?.length || 0}
Dependencies: ${data.links?.length || 0}

Top connected components:
${this.getTopComponents(data, 10)}

File types detected:
${this.getFileTypes(data)}

Generate a professional README-style overview that includes:
1. **Project Purpose** - Infer what this system does based on file names and structure
2. **Technology Stack** - Identify frameworks, languages, and tools
3. **Architecture Style** - Describe the architectural pattern (monolithic, microservices, layered, etc.)
4. **Key Features** - List main capabilities based on component names

Keep it concise but insightful. Use markdown formatting.`;

            const overview = await this.llmClient!.explain(overviewPrompt, dataSummary);
            sections.push(overview + '\n');

        } catch (error) {
            console.error('LLM analysis failed, falling back to template:', error);
            sections.push(this.generateOverview(data));
        }

        // Statistics (template-based, always reliable)
        sections.push(this.generateStatistics(data));

        // Try LLM for architectural insights
        try {
            const archPrompt = `Based on this dependency graph analysis, provide architectural insights:

Average dependencies per file: ${(data.links?.length || 0) / Math.max(data.nodes?.length || 1, 1)}
Most connected component: ${this.getMaxDependencies(data.nodes || [], data.links || []).node?.label || 'N/A'}

Analyze:
1. **Coupling Level** - Is this well-modularized or tightly coupled?
2. **Potential Issues** - Any architectural anti-patterns?
3. **Recommendations** - Specific improvements for better architecture

Be specific and actionable.`;

            const archInsights = await this.llmClient!.explain(archPrompt, dataSummary);
            sections.push(`## Architecture Analysis\n\n${archInsights}\n`);

        } catch (error) {
            sections.push(this.generateArchitecture(data));
        }

        // Components and risks (template-based)
        sections.push(this.generateComponents(data));
        sections.push(this.generateRiskAnalysis(data));
        sections.push(this.generateDependencies(data));

        return sections.join('\n');
    }

    private prepareDataSummary(data: any): string {
        const nodes = data.nodes || [];
        const links = data.links || [];

        return `Graph contains ${nodes.length} nodes and ${links.length} edges. 
Top files: ${nodes.slice(0, 20).map((n: any) => n.label).join(', ')}`;
    }

    private getTopComponents(data: any, limit: number): string {
        const nodes = data.nodes || [];
        const links = data.links || [];

        const nodeCounts = nodes.map((node: any) => ({
            label: node.label,
            connections: links.filter((l: any) => l.source === node.id || l.target === node.id).length
        }));

        return nodeCounts
            .sort((a: any, b: any) => b.connections - a.connections)
            .slice(0, limit)
            .map((n: any) => `- ${n.label} (${n.connections} connections)`)
            .join('\n');
    }

    private getFileTypes(data: any): string {
        const nodes = data.nodes || [];
        const extensions = new Map<string, number>();

        for (const node of nodes) {
            const ext = path.extname(node.filePath || node.label || '');
            if (ext) {
                extensions.set(ext, (extensions.get(ext) || 0) + 1);
            }
        }

        return Array.from(extensions.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([ext, count]) => `- ${ext}: ${count} files`)
            .join('\n');
    }
    const sections: string[] = [];

        // Header
        sections.push(`# ${projectName} - Architecture Documentation\n`);
        sections.push(`* Generated on ${ new Date().toLocaleDateString() }*\n`);

        // Overview
        sections.push(this.generateOverview(data));

        // Statistics
        if (options.includeStats !== false) {
            sections.push(this.generateStatistics(data));
        }

        // Architecture
        sections.push(this.generateArchitecture(data));

        // Components
        sections.push(this.generateComponents(data));

        // Risk Analysis
        if (options.includeRisks !== false) {
            sections.push(this.generateRiskAnalysis(data));
        }

        // Dependencies
        if (options.includeDependencies !== false) {
            sections.push(this.generateDependencies(data));
        }

        return sections.join('\n');
    }

    private generateOverview(data: any): string {
        const nodes = data.nodes || [];
        const links = data.links || [];

        return `## Overview

This project contains ** ${ nodes.length } files ** with ** ${ links.length } dependencies ** between them.

### Project Structure

The codebase is organized into interconnected modules that form the application's architecture. This document provides a comprehensive view of the system's structure, dependencies, and risk areas.
`;
    }

    private generateStatistics(data: any): string {
        const nodes = data.nodes || [];
        const links = data.links || [];

        const fileCount = nodes.filter((n: any) => n.type === 'file').length;
        const functionCount = nodes.filter((n: any) => n.type === 'function').length;

        const riskCounts = {
            high: nodes.filter((n: any) => n.risk === 'high').length,
            medium: nodes.filter((n: any) => n.risk === 'medium').length,
            low: nodes.filter((n: any) => n.risk === 'low').length
        };

        return `## Statistics

    | Metric | Count |
| --------| -------|
| Total Nodes | ${ nodes.length } |
| Files | ${ fileCount } |
| Functions | ${ functionCount } |
| Dependencies | ${ links.length } |
| High Risk Items | ${ riskCounts.high } |
| Medium Risk Items | ${ riskCounts.medium } |
| Low Risk Items | ${ riskCounts.low } |
    `;
    }

    private generateArchitecture(data: any): string {
        const nodes = data.nodes || [];
        const links = data.links || [];

        // Calculate some architectural metrics
        const avgDependencies = links.length / Math.max(nodes.length, 1);
        const maxDependencies = this.getMaxDependencies(nodes, links);

        return `## Architecture

### Dependency Structure

The project follows a ${ avgDependencies > 3 ? 'highly interconnected' : 'modular' } architecture with an average of ** ${ avgDependencies.toFixed(1) } dependencies per file **.

    ${ maxDependencies.node ? `The most connected component is \`${maxDependencies.node.label}\` with **${maxDependencies.count} connections**, indicating it's a central piece of the architecture.` : '' }

### Design Patterns

Based on the dependency graph analysis:
- ${ avgDependencies < 2 ? '✅ Low coupling - good modularity' : '⚠️ High coupling - consider refactoring' }
- ${ maxDependencies.count > 10 ? '⚠️ Potential god object detected' : '✅ No obvious architectural anti-patterns' }
`;
    }

    private generateComponents(data: any): string {
        const nodes = data.nodes || [];
        const fileNodes = nodes.filter((n: any) => n.type === 'file');

        let markdown = `## Key Components\n\n`;

        // Group by directory
        const byDirectory = this.groupByDirectory(fileNodes);

        for (const [dir, files] of Object.entries(byDirectory)) {
            markdown += `### ${ dir || 'Root' } \n\n`;

            for (const file of files as any[]) {
                const riskBadge = this.getRiskBadge(file.risk);
                markdown += `- ** ${ file.label }** ${ riskBadge } \n`;

                if (file.reasoning) {
                    markdown += `  - * ${ file.reasoning }*\n`;
                }
            }
            markdown += '\n';
        }

        return markdown;
    }

    private generateRiskAnalysis(data: any): string {
        const nodes = data.nodes || [];
        const highRisk = nodes.filter((n: any) => n.risk === 'high');

        let markdown = `## Risk Analysis\n\n`;

        if (highRisk.length === 0) {
            markdown += `✅ ** No high - risk components detected.**\n\n`;
        } else {
            markdown += `⚠️ ** ${ highRisk.length } high - risk components require attention:**\n\n`;

            for (const node of highRisk) {
                markdown += `### ${ node.label } \n\n`;
                markdown += `- ** Risk Level:** 🔴 High\n`;
                markdown += `- ** Reason:** ${ node.reasoning || 'High complexity or centrality' } \n`;
                markdown += `- ** Connections:** ${ node.callers?.length || 0 } callers, ${ node.callees?.length || 0 } callees\n\n`;
            }
        }

        return markdown;
    }

    private generateDependencies(data: any): string {
        const links = data.links || [];
        const nodes = data.nodes || [];

        let markdown = `## Dependency Map\n\n`;
        markdown += `The following diagram shows the key dependencies in the system: \n\n`;
        markdown += '```mermaid\n';
markdown += 'graph TD\n';

// Limit to top 20 most connected nodes to keep diagram readable
const topNodes = this.getTopConnectedNodes(nodes, links, 20);
const nodeIds = new Map(topNodes.map((n, i) => [n.id, `N${i}`]));

for (const node of topNodes) {
    const nodeId = nodeIds.get(node.id);
    const label = node.label.replace(/[^a-zA-Z0-9]/g, '_');
    markdown += `  ${nodeId}["${label}"]\n`;
}

for (const link of links) {
    const sourceId = nodeIds.get(link.source);
    const targetId = nodeIds.get(link.target);
    if (sourceId && targetId) {
        markdown += `  ${sourceId} --> ${targetId}\n`;
    }
}

markdown += '```\n\n';
return markdown;
    }

    // Helper methods
    private getMaxDependencies(nodes: any[], links: any[]): { node: any; count: number } {
    let maxNode = null;
    let maxCount = 0;

    for (const node of nodes) {
        const count = links.filter(l => l.source === node.id || l.target === node.id).length;
        if (count > maxCount) {
            maxCount = count;
            maxNode = node;
        }
    }

    return { node: maxNode, count: maxCount };
}

    private groupByDirectory(nodes: any[]): Record < string, any[] > {
    const groups: Record<string, any[]> = { };

for (const node of nodes) {
    const dir = path.dirname(node.filePath || node.label);
    if (!groups[dir]) {
        groups[dir] = [];
    }
    groups[dir].push(node);
}

return groups;
    }

    private getRiskBadge(risk: string): string {
    switch (risk) {
        case 'high': return '🔴';
        case 'medium': return '🟡';
        case 'low': return '🟢';
        default: return '⚪';
    }
}

    private getTopConnectedNodes(nodes: any[], links: any[], limit: number): any[] {
    const nodeCounts = nodes.map(node => ({
        ...node,
        connectionCount: links.filter(l => l.source === node.id || l.target === node.id).length
    }));

    return nodeCounts
        .sort((a, b) => b.connectionCount - a.connectionCount)
        .slice(0, limit);
}
}

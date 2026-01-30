import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileNode {
    path: string;
    type: 'file' | 'folder';
    children?: FileNode[];
}

export class WorkspaceScanner {
    private excludePatterns: string[] = [
        'node_modules',
        '.git',
        '.next',
        'venv',
        'dist',
        'out',
        '.vscode',
        '.idea',
        '__pycache__',
        '.pytest_cache',
        'build',
        '.build'
    ];

    constructor(customExcludes: string[] = []) {
        if (customExcludes.length > 0) {
            this.excludePatterns = [...this.excludePatterns, ...customExcludes];
            // Remove duplicates
            this.excludePatterns = [...new Set(this.excludePatterns)];
        }
    }

    async scan(rootPath: string): Promise<FileNode> {
        return this.scanDirectory(rootPath, rootPath);
    }

    private async scanDirectory(fullPath: string, rootPath: string): Promise<FileNode> {
        const relativePath = path.relative(rootPath, fullPath);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
            const children: FileNode[] = [];
            const entries = await fs.readdir(fullPath);

            for (const entry of entries) {
                // Skip excluded patterns
                if (this.excludePatterns.some(pattern => entry.includes(pattern))) {
                    continue;
                }

                const entryPath = path.join(fullPath, entry);
                try {
                    const child = await this.scanDirectory(entryPath, rootPath);
                    children.push(child);
                } catch (error) {
                    // Skip files we can't read
                    console.warn(`Skipping ${entryPath}:`, error);
                }
            }

            return {
                path: relativePath || '.',
                type: 'folder',
                children
            };
        } else {
            return {
                path: relativePath,
                type: 'file'
            };
        }
    }

    async getAllFiles(rootPath: string, node: FileNode): Promise<string[]> {
        const files: string[] = [];

        if (node.type === 'file') {
            files.push(path.join(rootPath, node.path));
        } else if (node.children) {
            for (const child of node.children) {
                files.push(...await this.getAllFiles(rootPath, child));
            }
        }

        return files;
    }
}

import { FileNode, WorkspaceScanner } from '../workspace/scanner';
import * as path from 'path';

export interface WorkspaceMetadata {
    files: string[];
    folders: string[];
    languages: Record<string, number>;
    entryPoints: string[];
}

const ENTRY_POINT_PATTERNS = [
    'main.py',
    'index.js',
    'index.ts',
    'app.ts',
    'app.js',
    'server.ts',
    'server.js',
    'main.ts',
    'main.js',
    'app.py',
    'server.py'
];

export class ArchaeologistAgent {
    async analyze(fileTree: FileNode, workspacePath: string): Promise<WorkspaceMetadata> {
        const scanner = new WorkspaceScanner();
        const allFiles = await scanner.getAllFiles(workspacePath, fileTree);
        
        const files: string[] = [];
        const folders = new Set<string>();
        const languages: Record<string, number> = {};
        const entryPoints: string[] = [];
        
        for (const file of allFiles) {
            files.push(file);
            
            // Extract folder
            const folder = path.dirname(file);
            if (folder !== workspacePath) {
                folders.add(folder);
            }
            
            // Count languages
            const ext = path.extname(file);
            const lang = this.getLanguage(ext);
            if (lang) {
                languages[lang] = (languages[lang] || 0) + 1;
            }
            
            // Check entry points
            const basename = path.basename(file);
            if (ENTRY_POINT_PATTERNS.includes(basename)) {
                entryPoints.push(file);
            }
        }
        
        return {
            files,
            folders: Array.from(folders),
            languages,
            entryPoints
        };
    }
    
    private getLanguage(ext: string): string | null {
        const langMap: Record<string, string> = {
            '.py': 'Python',
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.jsx': 'JavaScript',
            '.tsx': 'TypeScript',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.go': 'Go',
            '.rs': 'Rust',
            '.rb': 'Ruby',
            '.php': 'PHP'
        };
        return langMap[ext] || null;
    }
}

export type QueryIntent = 'blast_radius' | 'central_functions' | 'important_files' | 'find_function' | 'unknown';

export interface QueryPlan {
    intent: QueryIntent;
    functionName?: string;
    functionId?: string;
}

export class QueryPlanner {
    /**
     * Map natural language questions to query intents
     * This is deterministic - NO LLM
     * Unknown queries will be handled by Gemini reading the codebase
     */
    plan(question: string): QueryPlan {
        const lowerQuestion = question.toLowerCase();
        
        // Blast radius patterns
        if (this.matchesPattern(lowerQuestion, [
            'what breaks',
            'what would break',
            'what happens if i change',
            'what if i modify',
            'impact of changing',
            'affect if',
            'dependencies of',
            'what calls',
            'who calls'
        ])) {
            const functionName = this.extractFunctionName(question);
            return {
                intent: 'blast_radius',
                functionName
            };
        }
        
        // Central functions patterns
        if (this.matchesPattern(lowerQuestion, [
            'most central',
            'most important function',
            'key functions',
            'core functions',
            'central functions',
            'most used',
            'most called'
        ])) {
            return {
                intent: 'central_functions'
            };
        }
        
        // Important files patterns
        if (this.matchesPattern(lowerQuestion, [
            'important files',
            'key files',
            'core files',
            'what should i read',
            'where to start',
            'entry point',
            'main files'
        ])) {
            return {
                intent: 'important_files'
            };
        }
        
        // Find function patterns
        if (this.matchesPattern(lowerQuestion, [
            'find function',
            'where is',
            'show me',
            'locate'
        ])) {
            const functionName = this.extractFunctionName(question);
            return {
                intent: 'find_function',
                functionName
            };
        }
        
        // Everything else goes to Gemini for general query handling
        return {
            intent: 'unknown'
        };
    }
    
    private matchesPattern(text: string, patterns: string[]): boolean {
        return patterns.some(pattern => text.includes(pattern));
    }
    
    private extractFunctionName(question: string): string | undefined {
        // Simple extraction - look for quoted strings or function-like patterns
        const quotedMatch = question.match(/['"]([^'"]+)['"]/);
        if (quotedMatch) {
            return quotedMatch[1];
        }
        
        // Look for function-like patterns: "function X" or "X()"
        const funcMatch = question.match(/(?:function\s+)?(\w+)\s*\(/);
        if (funcMatch) {
            return funcMatch[1];
        }
        
        // Look for "change X" or "modify X"
        const changeMatch = question.match(/(?:change|modify|update)\s+(\w+)/i);
        if (changeMatch) {
            return changeMatch[1];
        }
        
        return undefined;
    }
}

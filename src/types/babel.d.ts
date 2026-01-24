declare module '@babel/traverse' {
    import { Node } from '@babel/types';
    export interface NodePath<T = Node> {
        node: T;
        get(key: string): NodePath;
        traverse(visitor: any): void;
    }
    export default function traverse(ast: Node, visitor: any): void;
}

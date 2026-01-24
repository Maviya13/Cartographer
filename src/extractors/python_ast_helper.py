import ast
import json
import sys

def extract_function_calls(node):
    """Extract function calls from an AST node."""
    calls = []
    for child in ast.walk(node):
        if isinstance(child, ast.Call):
            if isinstance(child.func, ast.Name):
                calls.append(child.func.id)
            elif isinstance(child.func, ast.Attribute):
                # Method calls - extract method name
                calls.append(child.func.attr)
    return calls

def extract_functions(tree, file_path):
    """Extract all function definitions from AST."""
    functions = []
    
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
            calls = extract_function_calls(node)
            functions.append({
                'name': node.name,
                'start_line': node.lineno,
                'end_line': node.end_lineno if hasattr(node, 'end_lineno') else node.lineno,
                'calls': list(set(calls))  # Remove duplicates
            })
    
    return functions

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        file_path = input_data['file']
        content = input_data['content']
        
        # Parse AST
        tree = ast.parse(content, filename=file_path)
        
        # Extract functions
        functions = extract_functions(tree, file_path)
        
        # Output JSON
        print(json.dumps(functions))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

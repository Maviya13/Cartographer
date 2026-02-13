import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';

const root = process.cwd();

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function safeCopyFile(source, destination) {
  if (!existsSync(source)) {
    return false;
  }
  ensureDir(path.dirname(destination));
  copyFileSync(source, destination);
  return true;
}

function copyHtmlAssets() {
  const sourceDir = path.join(root, 'src', 'ui');
  const targetDir = path.join(root, 'out', 'ui');
  ensureDir(targetDir);

  if (!existsSync(sourceDir)) {
    return 0;
  }

  const htmlFiles = readdirSync(sourceDir).filter((file) => file.endsWith('.html'));
  for (const file of htmlFiles) {
    safeCopyFile(path.join(sourceDir, file), path.join(targetDir, file));
  }
  return htmlFiles.length;
}

const pythonCopied = safeCopyFile(
  path.join(root, 'src', 'extractors', 'python_ast_helper.py'),
  path.join(root, 'out', 'extractors', 'python_ast_helper.py')
);

const htmlCount = copyHtmlAssets();

console.log(
  `postcompile complete: python_helper=${pythonCopied ? 'copied' : 'missing'}, html_files=${htmlCount}`
);

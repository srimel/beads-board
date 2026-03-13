/**
 * Maps file extensions and special filenames to icon identifiers.
 * Used by the file explorer to display appropriate icons.
 */

const EXTENSION_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',

  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.less': 'css',
  '.svg': 'image',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.ico': 'image',
  '.webp': 'image',

  // Data
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'config',
  '.xml': 'xml',
  '.csv': 'data',

  // Docs
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.txt': 'text',
  '.pdf': 'document',

  // Config
  '.env': 'config',
  '.gitignore': 'config',
  '.editorconfig': 'config',

  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.bat': 'shell',
  '.cmd': 'shell',
  '.ps1': 'shell',

  // Other languages
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
}

const FILENAME_MAP: Record<string, string> = {
  'package.json': 'npm',
  'package-lock.json': 'npm',
  'tsconfig.json': 'typescript',
  'vite.config.ts': 'vite',
  'vite.config.js': 'vite',
  'tailwind.config.js': 'tailwind',
  'tailwind.config.ts': 'tailwind',
  'postcss.config.js': 'config',
  'postcss.config.cjs': 'config',
  '.gitignore': 'git',
  '.eslintrc': 'eslint',
  '.eslintrc.js': 'eslint',
  '.eslintrc.json': 'eslint',
  'eslint.config.js': 'eslint',
  'Dockerfile': 'docker',
  'docker-compose.yml': 'docker',
  'README.md': 'readme',
  'LICENSE': 'license',
  'Makefile': 'config',
}

export function getFileIconType(filename: string): string {
  // Check exact filename match first
  if (FILENAME_MAP[filename]) {
    return FILENAME_MAP[filename]
  }

  // Check extension
  const lastDot = filename.lastIndexOf('.')
  if (lastDot !== -1) {
    const ext = filename.slice(lastDot).toLowerCase()
    if (EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext]
    }
  }

  return 'file'
}

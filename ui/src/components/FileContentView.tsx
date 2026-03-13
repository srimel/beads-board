import { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useFileContent } from '@/hooks/useBeadsApi'
import { ArrowLeft } from 'lucide-react'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

interface FileContentViewProps {
  file: string
  onBack: () => void
}

// Fine-grained imports — only these grammars/themes get bundled
const LANG_IMPORTS: Record<string, () => Promise<unknown>> = {
  'angular-html': () => import('shiki/langs/angular-html.mjs'),
  'angular-ts': () => import('shiki/langs/angular-ts.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  dotenv: () => import('shiki/langs/dotenv.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  http: () => import('shiki/langs/http.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  jsonc: () => import('shiki/langs/jsonc.mjs'),
  jsonl: () => import('shiki/langs/jsonl.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  kusto: () => import('shiki/langs/kusto.mjs'),
  latex: () => import('shiki/langs/latex.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  mdc: () => import('shiki/langs/mdc.mjs'),
  mdx: () => import('shiki/langs/mdx.mjs'),
  mermaid: () => import('shiki/langs/mermaid.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  sass: () => import('shiki/langs/sass.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  shell: () => import('shiki/langs/shellscript.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  svelte: () => import('shiki/langs/svelte.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  zig: () => import('shiki/langs/zig.mjs'),
}

// Lazy-load a shared highlighter core instance (starts with just the theme, no langs)
let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import('shiki/themes/github-dark.mjs')],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighterPromise
}

async function highlightCode(content: string, language: string): Promise<string> {
  const highlighter = await getHighlighter()

  // Load the language grammar on demand if we support it
  const langImport = LANG_IMPORTS[language]
  if (langImport && !highlighter.getLoadedLanguages().includes(language)) {
    const mod = await langImport()
    await highlighter.loadLanguage(mod as Parameters<typeof highlighter.loadLanguage>[0])
  }

  const lang = highlighter.getLoadedLanguages().includes(language) ? language : 'text'

  return highlighter.codeToHtml(content, { lang, theme: 'github-dark' })
}

export function FileContentView({ file, onBack }: FileContentViewProps) {
  const { data, loading } = useFileContent(file)
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

  const fileName = file

  useEffect(() => {
    if (!data?.content) {
      setHighlightedHtml(null)
      return
    }

    let cancelled = false

    highlightCode(data.content, data.language).then((html) => {
      if (!cancelled) setHighlightedHtml(html)
    }).catch(() => {
      if (!cancelled) setHighlightedHtml(null)
    })

    return () => { cancelled = true }
  }, [data])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Back to file list"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-mono text-foreground truncate" title={file}>
          {fileName}
        </span>
        {data?.language && data.language !== 'text' && (
          <span className="text-xs text-muted-foreground ml-auto">{data.language}</span>
        )}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {loading && !data ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 mx-3 mb-1 rounded" />
          ))
        ) : highlightedHtml ? (
          <div
            className="text-xs leading-5 [&_pre]:!bg-transparent [&_pre]:p-3 [&_pre]:m-0 [&_code]:!bg-transparent"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : data?.content ? (
          <div className="text-xs font-mono leading-5 p-3 whitespace-pre-wrap break-all text-foreground/80">
            {data.content}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">Unable to load file</p>
        )}
      </ScrollArea>
    </div>
  )
}

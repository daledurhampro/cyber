import { Highlight, themes } from 'prism-react-renderer';
import { CodeInputProps } from '@/types/security';
import FileUpload from './FileUpload';

// Map file extensions to Prism languages bundled with prism-react-renderer.
// The analyzer targets Python, so anything unrecognised falls back to it.
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  py: 'python',
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  go: 'go',
  rs: 'rust',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  sql: 'sql',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
};

function languageFor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_BY_EXTENSION[ext] ?? 'python';
}

/**
 * Code input section with file upload and syntax-highlighted code display
 */
export default function CodeInput({
  codeContent,
  fileName,
  onFileUpload,
  onLoadSample,
  onAnalyzeCode,
  isAnalyzing
}: CodeInputProps) {
  return (
    <div className="bg-white rounded-lg border border-border shadow-sm p-6 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 id="code-input-label" className="text-lg font-semibold text-foreground">
          Code to analyze
        </h2>

        <FileUpload
          fileName={fileName}
          onFileUpload={onFileUpload}
          onLoadSample={onLoadSample}
          onAnalyzeCode={onAnalyzeCode}
          isAnalyzing={isAnalyzing}
          hasCode={!!codeContent}
        />
      </div>

      <div
        role="region"
        aria-labelledby="code-input-label"
        tabIndex={0}
        className="flex-1 min-h-0 overflow-auto border border-border rounded-lg bg-input-bg focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        {codeContent ? (
          <Highlight theme={themes.github} code={codeContent} language={languageFor(fileName)}>
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={`${className} p-4 font-mono text-sm min-w-fit`}
                style={{ ...style, backgroundColor: 'transparent' }}
              >
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })} className="table-row">
                    <span className="table-cell pr-4 text-right select-none text-gray-400">
                      {i + 1}
                    </span>
                    <span className="table-cell">
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        ) : (
          <p className="p-4 font-mono text-sm text-gray-400">
            Select a code file to display its contents here...
          </p>
        )}
      </div>
    </div>
  );
}

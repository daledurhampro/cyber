import { FileUploadProps } from '@/types/security';

/**
 * File upload button component for selecting files
 */
export default function FileUpload({ 
  fileName, 
  onFileUpload,
  onLoadSample,
  onAnalyzeCode,
  isAnalyzing, 
  hasCode 
}: FileUploadProps) {
  return (
    <div className="flex items-center gap-4">
      {fileName && (
        <span className="text-sm text-accent bg-secondary/20 px-3 py-1 rounded-full">
          {fileName}
        </span>
      )}
      
      <input
        type="file"
        accept=".py,.js,.jsx,.ts,.tsx,.java,.c,.cpp,.cs,.rb,.go,.php,.html,.css,.json,.xml"
        onChange={onFileUpload}
        className="hidden"
        id="file-upload"
      />
      
      <div className="flex flex-col items-stretch gap-2">
        <label
          htmlFor="file-upload"
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors font-medium text-center"
        >
          Open code file...
        </label>

        <button
          type="button"
          onClick={onLoadSample}
          disabled={isAnalyzing}
          className="border border-primary text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors font-medium"
        >
          Load sample file
        </button>
      </div>
      
      <button
        onClick={onAnalyzeCode}
        disabled={!hasCode || isAnalyzing}
        className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors font-medium"
      >
        {isAnalyzing && (
          <span
            aria-hidden="true"
            className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin"
          />
        )}
        {isAnalyzing ? 'Analyzing...' : 'Analyze code'}
      </button>
    </div>
  );
}
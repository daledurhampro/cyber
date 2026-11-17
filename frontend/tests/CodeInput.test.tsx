import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CodeInput from '@/components/CodeInput';

const baseProps = {
  fileName: '',
  onFileUpload: vi.fn(),
  onLoadSample: vi.fn(),
  onAnalyzeCode: vi.fn(),
  isAnalyzing: false,
};

describe('CodeInput', () => {
  it('shows the code with syntax highlighting', () => {
    render(<CodeInput {...baseProps} fileName="issues.py" codeContent="import os" />);

    const region = screen.getByRole('region', { name: 'Code to analyze' });
    expect(region).toHaveTextContent('import os');
    expect(region.querySelector('.token.keyword')).toHaveTextContent('import');
  });

  it('shows a placeholder when no code is loaded', () => {
    render(<CodeInput {...baseProps} codeContent="" />);

    expect(screen.getByText(/Select a code file/)).toBeInTheDocument();
  });

  it('disables Analyze when there is no code', () => {
    render(<CodeInput {...baseProps} codeContent="" />);

    expect(screen.getByRole('button', { name: 'Analyze code' })).toBeDisabled();
  });

  it('enables Analyze once code is loaded', () => {
    render(<CodeInput {...baseProps} codeContent="x = 1" />);

    expect(screen.getByRole('button', { name: 'Analyze code' })).toBeEnabled();
  });
});

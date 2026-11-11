import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CodeInput from '@/components/CodeInput';

const baseProps = {
  fileName: '',
  onFileUpload: vi.fn(),
  onAnalyzeCode: vi.fn(),
  isAnalyzing: false,
};

describe('CodeInput', () => {
  it('shows the code in a read-only textarea', () => {
    render(<CodeInput {...baseProps} codeContent="import os" />);

    const textarea = screen.getByLabelText('Code to analyze');
    expect(textarea).toHaveValue('import os');
    expect(textarea).toHaveAttribute('readonly');
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

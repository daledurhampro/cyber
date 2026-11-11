import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FileUpload from '@/components/FileUpload';
import { FileUploadProps } from '@/types/security';

function setup(overrides: Partial<FileUploadProps> = {}) {
  const props: FileUploadProps = {
    fileName: '',
    onFileUpload: vi.fn(),
    onAnalyzeCode: vi.fn(),
    isAnalyzing: false,
    hasCode: true,
    ...overrides,
  };
  render(<FileUpload {...props} />);
  return props;
}

describe('FileUpload', () => {
  it('disables Analyze when there is no code', () => {
    setup({ hasCode: false });

    expect(screen.getByRole('button', { name: 'Analyze code' })).toBeDisabled();
  });

  it('enables Analyze when code is loaded and calls the handler on click', async () => {
    const props = setup();

    const button = screen.getByRole('button', { name: 'Analyze code' });
    expect(button).toBeEnabled();
    await userEvent.click(button);

    expect(props.onAnalyzeCode).toHaveBeenCalledOnce();
  });

  it('shows a disabled "Analyzing..." button while analysis runs', () => {
    setup({ isAnalyzing: true });

    expect(screen.getByRole('button', { name: 'Analyzing...' })).toBeDisabled();
  });

  it('shows the selected file name', () => {
    setup({ fileName: 'issues.py' });

    expect(screen.getByText('issues.py')).toBeInTheDocument();
  });

  it('passes chosen files to onFileUpload', async () => {
    const props = setup();
    const file = new File(['print(1)'], 'app.py', { type: 'text/x-python' });

    await userEvent.upload(screen.getByLabelText('Open code file...'), file);

    expect(props.onFileUpload).toHaveBeenCalledOnce();
  });

  it('accepts Python files', () => {
    setup();

    expect(screen.getByLabelText('Open code file...')).toHaveAttribute(
      'accept',
      expect.stringContaining('.py'),
    );
  });
});

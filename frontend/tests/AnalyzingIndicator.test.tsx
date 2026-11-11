import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyzingIndicator from '@/components/AnalyzingIndicator';

describe('AnalyzingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (seconds: number) =>
    act(() => {
      vi.advanceTimersByTime(seconds * 1000);
    });

  it('is an accessible live status region', () => {
    render(<AnalyzingIndicator />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('starts at the first stage with 0s elapsed', () => {
    render(<AnalyzingIndicator />);

    expect(screen.getByText('Starting the Semgrep MCP server…')).toBeInTheDocument();
    expect(screen.getByText(/Elapsed 0s/)).toBeInTheDocument();
  });

  it('advances through stages as time passes', () => {
    render(<AnalyzingIndicator />);

    advance(5);
    expect(screen.getByText('Scanning code with Semgrep rules…')).toBeInTheDocument();

    advance(15); // 20s
    expect(screen.getByText('AI agent reviewing Semgrep findings…')).toBeInTheDocument();

    advance(60); // 80s
    expect(screen.getByText(/Still working/)).toBeInTheDocument();
  });

  it('formats elapsed time as minutes and zero-padded seconds after a minute', () => {
    render(<AnalyzingIndicator />);

    advance(65);

    expect(screen.getByText(/Elapsed 1m 05s/)).toBeInTheDocument();
  });

  it('stops its timer on unmount', () => {
    const { unmount } = render(<AnalyzingIndicator />);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

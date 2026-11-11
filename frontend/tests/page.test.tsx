import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';

const CODE = 'import os\nos.system(input())';

async function uploadCode(content = CODE, name = 'app.py') {
  const file = new File([content], name, { type: 'text/x-python' });
  await userEvent.upload(screen.getByLabelText('Open code file...'), file);
  await waitFor(() => expect(screen.getByLabelText('Code to analyze')).toHaveValue(content));
}

describe('Home page', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('loads an uploaded file into the code box', async () => {
    render(<Home />);

    await uploadCode();

    expect(screen.getByText('app.py')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze code' })).toBeEnabled();
  });

  it('posts the code to /api/analyze and shows the results', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: 'Analyzed 29 characters. Semgrep found 1 issues.',
        issues: [
          {
            title: 'Command Injection',
            description: 'os.system with user input',
            code: 'os.system(input())',
            fix: 'Use subprocess.run with a list',
            cvss_score: 9.8,
            severity: 'critical',
          },
        ],
      }),
    });
    render(<Home />);
    await uploadCode();

    await userEvent.click(screen.getByRole('button', { name: 'Analyze code' }));

    expect(await screen.findByText('Command Injection')).toBeInTheDocument();
    expect(screen.getByText('Analyzed 29 characters. Semgrep found 1 issues.')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/analyze');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ code: CODE });
  });

  it('shows the analyzing state while the request is in flight', async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<Home />);
    await uploadCode();

    await userEvent.click(screen.getByRole('button', { name: 'Analyze code' }));

    expect(screen.getByRole('button', { name: 'Analyzing...' })).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();

    resolve({ ok: true, json: async () => ({ summary: 'done', issues: [] }) });
    expect(await screen.findByText('done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze code' })).toBeEnabled();
  });

  it('shows an error when the API returns a non-OK status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<Home />);
    await uploadCode();

    await userEvent.click(screen.getByRole('button', { name: 'Analyze code' }));

    expect(await screen.findByText('HTTP error! status: 500')).toBeInTheDocument();
  });

  it('shows an error when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));
    render(<Home />);
    await uploadCode();

    await userEvent.click(screen.getByRole('button', { name: 'Analyze code' }));

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
  });

  it('clears previous results when a new file is loaded', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ summary: 'first run', issues: [] }) });
    render(<Home />);
    await uploadCode();
    await userEvent.click(screen.getByRole('button', { name: 'Analyze code' }));
    expect(await screen.findByText('first run')).toBeInTheDocument();

    await uploadCode('x = 1', 'other.py');

    expect(screen.queryByText('first run')).not.toBeInTheDocument();
    expect(screen.getByText(/upload and analyze code/i)).toBeInTheDocument();
  });
});

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AnalysisResults from '@/components/AnalysisResults';
import { AnalysisResponse, SecurityIssue } from '@/types/security';

const issue = (overrides: Partial<SecurityIssue> = {}): SecurityIssue => ({
  title: 'SQL Injection',
  description: 'User input concatenated into a query',
  code: 'cursor.execute("SELECT * FROM t WHERE id=" + uid)',
  fix: 'cursor.execute("SELECT * FROM t WHERE id=%s", (uid,))',
  cvss_score: 9.1,
  severity: 'critical',
  ...overrides,
});

describe('AnalysisResults', () => {
  it('shows the empty-state prompt before any analysis', () => {
    render(<AnalysisResults analysisResults={null} isAnalyzing={false} error={null} />);

    expect(screen.getByText(/upload and analyze code/i)).toBeInTheDocument();
  });

  it('shows the analyzing indicator while analysis runs', () => {
    render(<AnalysisResults analysisResults={null} isAnalyzing={true} error={null} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/upload and analyze code/i)).not.toBeInTheDocument();
  });

  it('hides stale results and errors while analyzing', () => {
    const results: AnalysisResponse = { summary: 'Old summary', issues: [issue()] };
    render(<AnalysisResults analysisResults={results} isAnalyzing={true} error="old error" />);

    expect(screen.queryByText('Old summary')).not.toBeInTheDocument();
    expect(screen.queryByText('old error')).not.toBeInTheDocument();
  });

  it('shows an error message', () => {
    render(<AnalysisResults analysisResults={null} isAnalyzing={false} error="HTTP error! status: 500" />);

    expect(screen.getByText('HTTP error! status: 500')).toBeInTheDocument();
    expect(screen.queryByText(/upload and analyze code/i)).not.toBeInTheDocument();
  });

  it('shows the summary without a table when there are no issues', () => {
    render(
      <AnalysisResults
        analysisResults={{ summary: 'No issues found.', issues: [] }}
        isAnalyzing={false}
        error={null}
      />,
    );

    expect(screen.getByText('No issues found.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders one row per issue with all fields', () => {
    const results: AnalysisResponse = {
      summary: 'Semgrep found 1 issues, and I identified 1 additional issues.',
      issues: [issue(), issue({ title: 'Weak hash', severity: 'low', cvss_score: 3.1 })],
    };
    render(<AnalysisResults analysisResults={results} isAnalyzing={false} error={null} />);

    expect(screen.getByText('Security Issues Found (2)')).toBeInTheDocument();

    const rows = screen.getAllByRole('row').slice(1); // skip header row
    expect(rows).toHaveLength(2);

    const first = within(rows[0]);
    expect(first.getByText('SQL Injection')).toBeInTheDocument();
    expect(first.getByText('CRITICAL')).toBeInTheDocument();
    expect(first.getByText('9.1')).toBeInTheDocument();
    expect(first.getByText('User input concatenated into a query')).toBeInTheDocument();
    expect(first.getByText(/SELECT \* FROM t WHERE id=" \+ uid/)).toBeInTheDocument();
    expect(first.getByText(/id=%s/)).toBeInTheDocument();

    expect(within(rows[1]).getByText('Weak hash')).toBeInTheDocument();
  });

  it.each([
    ['critical', 'text-red-700'],
    ['high', 'text-orange-700'],
    ['medium', 'text-yellow-700'],
    ['low', 'text-green-700'],
  ] as const)('colors the %s severity badge', (severity, cls) => {
    render(
      <AnalysisResults
        analysisResults={{ summary: 's', issues: [issue({ severity })] }}
        isAnalyzing={false}
        error={null}
      />,
    );

    expect(screen.getByText(severity.toUpperCase())).toHaveClass(cls);
  });

  it('falls back to a gray badge for an unknown severity', () => {
    const odd = issue({ severity: 'info' as SecurityIssue['severity'] });
    render(<AnalysisResults analysisResults={{ summary: 's', issues: [odd] }} isAnalyzing={false} error={null} />);

    expect(screen.getByText('INFO')).toHaveClass('text-gray-700');
  });
});

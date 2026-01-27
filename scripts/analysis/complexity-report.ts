#!/usr/bin/env npx tsx
/**
 * complexity-report.ts - Generate human-readable complexity report
 *
 * Consumes file-stats.ts output and produces:
 * - Files sorted by line count (flags: >300 warning, >500 critical)
 * - Files sorted by function count (flags: >10 warning, >20 critical)
 * - Average metrics across codebase
 * - Statistical outliers (>2 standard deviations from mean)
 */

interface FileStats {
  path: string;
  lineCount: number;
  namedExports: number;
  defaultExports: number;
  totalExports: number;
  functionDeclarations: number;
  arrowFunctions: number;
  totalFunctions: number;
  classCount: number;
}

interface AnalysisResult {
  timestamp: string;
  rootDir: string;
  files: FileStats[];
  summary: {
    totalFiles: number;
    totalLines: number;
    totalExports: number;
    totalFunctions: number;
    totalClasses: number;
  };
}

type Severity = 'critical' | 'high' | 'medium' | 'info';

interface Finding {
  severity: Severity;
  file: string;
  metric: string;
  value: number;
  threshold?: number;
  message: string;
}

// Thresholds
const LINE_WARNING = 300;
const LINE_CRITICAL = 500;
const FUNCTION_WARNING = 10;
const FUNCTION_CRITICAL = 20;
const EXPORT_WARNING = 15;
const EXPORT_CRITICAL = 25;

function calculateStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

function severityIcon(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return '[CRITICAL]';
    case 'high':
      return '[HIGH]';
    case 'medium':
      return '[MEDIUM]';
    case 'info':
      return '[INFO]';
  }
}

function analyzeFiles(data: AnalysisResult): Finding[] {
  const findings: Finding[] = [];
  const { files } = data;

  // Calculate statistics
  const lineStats = calculateStats(files.map(f => f.lineCount));
  const funcStats = calculateStats(files.map(f => f.totalFunctions));
  const exportStats = calculateStats(files.map(f => f.totalExports));

  for (const file of files) {
    // Line count checks
    if (file.lineCount > LINE_CRITICAL) {
      findings.push({
        severity: 'critical',
        file: file.path,
        metric: 'lineCount',
        value: file.lineCount,
        threshold: LINE_CRITICAL,
        message: `${file.lineCount} lines - exceeds critical threshold of ${LINE_CRITICAL}`,
      });
    } else if (file.lineCount > LINE_WARNING) {
      findings.push({
        severity: 'high',
        file: file.path,
        metric: 'lineCount',
        value: file.lineCount,
        threshold: LINE_WARNING,
        message: `${file.lineCount} lines - exceeds warning threshold of ${LINE_WARNING}`,
      });
    }

    // Function count checks
    if (file.totalFunctions > FUNCTION_CRITICAL) {
      findings.push({
        severity: 'critical',
        file: file.path,
        metric: 'functionCount',
        value: file.totalFunctions,
        threshold: FUNCTION_CRITICAL,
        message: `${file.totalFunctions} functions - exceeds critical threshold of ${FUNCTION_CRITICAL}`,
      });
    } else if (file.totalFunctions > FUNCTION_WARNING) {
      findings.push({
        severity: 'high',
        file: file.path,
        metric: 'functionCount',
        value: file.totalFunctions,
        threshold: FUNCTION_WARNING,
        message: `${file.totalFunctions} functions - exceeds warning threshold of ${FUNCTION_WARNING}`,
      });
    }

    // Export count checks
    if (file.totalExports > EXPORT_CRITICAL) {
      findings.push({
        severity: 'high',
        file: file.path,
        metric: 'exportCount',
        value: file.totalExports,
        threshold: EXPORT_CRITICAL,
        message: `${file.totalExports} exports - possible god module`,
      });
    } else if (file.totalExports > EXPORT_WARNING) {
      findings.push({
        severity: 'medium',
        file: file.path,
        metric: 'exportCount',
        value: file.totalExports,
        threshold: EXPORT_WARNING,
        message: `${file.totalExports} exports - monitor for growth`,
      });
    }

    // Statistical outliers (>2 std dev from mean)
    if (lineStats.stdDev > 0) {
      const lineZScore = (file.lineCount - lineStats.mean) / lineStats.stdDev;
      if (lineZScore > 2 && file.lineCount <= LINE_WARNING) {
        findings.push({
          severity: 'medium',
          file: file.path,
          metric: 'lineCount',
          value: file.lineCount,
          message: `Statistical outlier: ${lineZScore.toFixed(1)} std dev above mean (${lineStats.mean.toFixed(0)} lines)`,
        });
      }
    }

    if (funcStats.stdDev > 0) {
      const funcZScore = (file.totalFunctions - funcStats.mean) / funcStats.stdDev;
      if (funcZScore > 2 && file.totalFunctions <= FUNCTION_WARNING) {
        findings.push({
          severity: 'medium',
          file: file.path,
          metric: 'functionCount',
          value: file.totalFunctions,
          message: `Statistical outlier: ${funcZScore.toFixed(1)} std dev above mean (${funcStats.mean.toFixed(0)} functions)`,
        });
      }
    }
  }

  return findings;
}

function printReport(data: AnalysisResult, findings: Finding[]) {
  const { files, summary } = data;

  console.log('='.repeat(80));
  console.log('CODEBASE COMPLEXITY REPORT');
  console.log(`Generated: ${data.timestamp}`);
  console.log(`Root: ${data.rootDir}`);
  console.log('='.repeat(80));
  console.log();

  // Summary statistics
  console.log('SUMMARY');
  console.log('-'.repeat(40));
  console.log(`Total files:     ${summary.totalFiles}`);
  console.log(`Total lines:     ${summary.totalLines}`);
  console.log(`Total functions: ${summary.totalFunctions}`);
  console.log(`Total exports:   ${summary.totalExports}`);
  console.log(`Total classes:   ${summary.totalClasses}`);
  console.log();

  // Averages
  const avgLines = (summary.totalLines / summary.totalFiles).toFixed(1);
  const avgFunctions = (summary.totalFunctions / summary.totalFiles).toFixed(1);
  const avgExports = (summary.totalExports / summary.totalFiles).toFixed(1);

  console.log('AVERAGES');
  console.log('-'.repeat(40));
  console.log(`Avg lines/file:     ${avgLines}`);
  console.log(`Avg functions/file: ${avgFunctions}`);
  console.log(`Avg exports/file:   ${avgExports}`);
  console.log();

  // Top files by line count
  console.log('FILES BY LINE COUNT (descending)');
  console.log('-'.repeat(40));
  const byLines = [...files].sort((a, b) => b.lineCount - a.lineCount);
  for (const f of byLines.slice(0, 10)) {
    const flag =
      f.lineCount > LINE_CRITICAL ? ' [CRITICAL]' : f.lineCount > LINE_WARNING ? ' [WARNING]' : '';
    console.log(`  ${f.lineCount.toString().padStart(4)} lines  ${f.path}${flag}`);
  }
  console.log();

  // Top files by function count
  console.log('FILES BY FUNCTION COUNT (descending)');
  console.log('-'.repeat(40));
  const byFuncs = [...files].sort((a, b) => b.totalFunctions - a.totalFunctions);
  for (const f of byFuncs.slice(0, 10)) {
    const flag =
      f.totalFunctions > FUNCTION_CRITICAL
        ? ' [CRITICAL]'
        : f.totalFunctions > FUNCTION_WARNING
          ? ' [WARNING]'
          : '';
    console.log(`  ${f.totalFunctions.toString().padStart(4)} funcs   ${f.path}${flag}`);
  }
  console.log();

  // Findings by severity
  if (findings.length === 0) {
    console.log('FINDINGS');
    console.log('-'.repeat(40));
    console.log('  No issues found. Codebase is within acceptable thresholds.');
    console.log();
    return;
  }

  const critical = findings.filter(f => f.severity === 'critical');
  const high = findings.filter(f => f.severity === 'high');
  const medium = findings.filter(f => f.severity === 'medium');

  console.log('FINDINGS');
  console.log('-'.repeat(40));
  console.log(`  Critical: ${critical.length}`);
  console.log(`  High:     ${high.length}`);
  console.log(`  Medium:   ${medium.length}`);
  console.log();

  if (critical.length > 0) {
    console.log('CRITICAL');
    console.log('-'.repeat(40));
    for (const f of critical) {
      console.log(`  ${f.file}`);
      console.log(`    ${f.message}`);
    }
    console.log();
  }

  if (high.length > 0) {
    console.log('HIGH');
    console.log('-'.repeat(40));
    for (const f of high) {
      console.log(`  ${f.file}`);
      console.log(`    ${f.message}`);
    }
    console.log();
  }

  if (medium.length > 0) {
    console.log('MEDIUM');
    console.log('-'.repeat(40));
    for (const f of medium) {
      console.log(`  ${f.file}`);
      console.log(`    ${f.message}`);
    }
    console.log();
  }

  // Actionable recommendations
  console.log('RECOMMENDATIONS');
  console.log('-'.repeat(40));

  const uniqueCriticalFiles = new Set(critical.map(f => f.file));
  const uniqueHighFiles = new Set(high.map(f => f.file));

  if (uniqueCriticalFiles.size > 0) {
    console.log('  Immediate action required:');
    for (const file of uniqueCriticalFiles) {
      console.log(`    - Split ${file} into focused modules`);
    }
  }

  if (uniqueHighFiles.size > 0) {
    console.log('  Schedule refactoring:');
    for (const file of uniqueHighFiles) {
      console.log(`    - Review ${file} for extraction opportunities`);
    }
  }

  console.log();
}

function main() {
  let input = '';

  process.stdin.setEncoding('utf-8');

  process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
      input += chunk;
    }
  });

  process.stdin.on('end', () => {
    try {
      const data: AnalysisResult = JSON.parse(input);
      const findings = analyzeFiles(data);
      printReport(data, findings);
    } catch (err) {
      console.error('Error parsing input JSON:', err);
      process.exit(1);
    }
  });
}

main();

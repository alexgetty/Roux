#!/usr/bin/env npx tsx

/**
 * Autolink script: adds [[wikilinks]] to orphan docs that mention known concepts.
 *
 * Usage:
 *   npx tsx scripts/autolink.ts           # Apply changes
 *   npx tsx scripts/autolink.ts --dry-run # Preview without writing
 */

import * as fs from "node:fs";
import * as path from "node:path";

const DOCS_ROOT = path.resolve(import.meta.dirname, "../docs");
const ORPHAN_DIRS = ["roadmap", "issues"];

interface LinkResult {
  file: string;
  linksAdded: string[];
}

interface Replacement {
  start: number;
  end: number;
  title: string;
}

function getTitlesFromFilenames(dir: string): Set<string> {
  const titles = new Set<string>();

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const title = entry.name.replace(/\.md$/, "");
        if (title.length >= 2) {
          titles.add(title);
        }
      }
    }
  }

  walk(dir);
  return titles;
}

function getOrphanFiles(): string[] {
  const files: string[] = [];
  for (const subdir of ORPHAN_DIRS) {
    const dir = path.join(DOCS_ROOT, subdir);
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(path.join(dir, entry.name));
      }
    }
  }
  return files;
}

function extractProtectedRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];

  // Frontmatter (must be at start)
  const frontmatterMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---/);
  if (frontmatterMatch) {
    ranges.push([0, frontmatterMatch[0].length]);
  }

  // Fenced code blocks: ```...```
  const fencedBlockRegex = /```[\s\S]*?```/g;
  let match: RegExpExecArray | null;
  while ((match = fencedBlockRegex.exec(content)) !== null) {
    ranges.push([match.index, match.index + match[0].length]);
  }

  // Inline code: `...`
  const inlineCodeRegex = /`[^`]+`/g;
  while ((match = inlineCodeRegex.exec(content)) !== null) {
    ranges.push([match.index, match.index + match[0].length]);
  }

  // Existing wikilinks: [[...]]
  const wikilinkRegex = /\[\[[^\]]+\]\]/g;
  while ((match = wikilinkRegex.exec(content)) !== null) {
    ranges.push([match.index, match.index + match[0].length]);
  }

  // Standard markdown links: [text](url)
  const mdLinkRegex = /\[[^\]]*\]\([^)]*\)/g;
  while ((match = mdLinkRegex.exec(content)) !== null) {
    ranges.push([match.index, match.index + match[0].length]);
  }

  return ranges.sort((a, b) => a[0] - b[0]);
}

function isProtected(pos: number, length: number, ranges: Array<[number, number]>): boolean {
  const end = pos + length;
  for (const [start, rangeEnd] of ranges) {
    if (pos >= start && end <= rangeEnd) {
      return true;
    }
    if (start > end) break;
  }
  return false;
}

function overlaps(r1: Replacement, r2: Replacement): boolean {
  return !(r1.end <= r2.start || r2.end <= r1.start);
}

function addLinks(content: string, titles: Set<string>, selfTitle: string): { newContent: string; added: string[] } {
  const protectedRanges = extractProtectedRanges(content);

  // Sort titles by length descending to prefer longer matches
  const sortedTitles = Array.from(titles)
    .filter((t) => t.toLowerCase() !== selfTitle.toLowerCase())
    .sort((a, b) => b.length - a.length);

  // Collect all potential replacements
  const allReplacements: Replacement[] = [];

  for (const title of sortedTitles) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "gi");

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const pos = match.index;
      const matchLen = match[0].length;

      if (!isProtected(pos, matchLen, protectedRanges)) {
        allReplacements.push({
          start: pos,
          end: pos + matchLen,
          title: title,
        });
      }
    }
  }

  // Sort by start position, then prefer longer matches
  allReplacements.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  // Remove overlapping replacements (keep the first one at each position, which is longer)
  const finalReplacements: Replacement[] = [];
  for (const rep of allReplacements) {
    const hasOverlap = finalReplacements.some((existing) => overlaps(existing, rep));
    if (!hasOverlap) {
      finalReplacements.push(rep);
    }
  }

  if (finalReplacements.length === 0) {
    return { newContent: content, added: [] };
  }

  // Apply replacements in reverse order to preserve positions
  finalReplacements.sort((a, b) => b.start - a.start);

  let result = content;
  const addedTitles = new Set<string>();

  for (const rep of finalReplacements) {
    result = result.slice(0, rep.start) + `[[${rep.title}]]` + result.slice(rep.end);
    addedTitles.add(rep.title);
  }

  return { newContent: result, added: Array.from(addedTitles) };
}

function processFile(filePath: string, titles: Set<string>, dryRun: boolean): LinkResult | null {
  const content = fs.readFileSync(filePath, "utf-8");
  const fileName = path.basename(filePath, ".md");

  const { newContent, added } = addLinks(content, titles, fileName);

  if (added.length === 0) {
    return null;
  }

  if (!dryRun) {
    fs.writeFileSync(filePath, newContent, "utf-8");
  }

  return {
    file: path.relative(DOCS_ROOT, filePath),
    linksAdded: added,
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    console.log("DRY RUN - no files will be modified\n");
  }

  const titles = getTitlesFromFilenames(DOCS_ROOT);
  console.log(`Found ${titles.size} linkable targets\n`);

  const orphanFiles = getOrphanFiles();
  console.log(`Processing ${orphanFiles.length} orphan files in: ${ORPHAN_DIRS.join(", ")}\n`);

  const results: LinkResult[] = [];

  for (const file of orphanFiles) {
    const result = processFile(file, titles, dryRun);
    if (result) {
      results.push(result);
    }
  }

  if (results.length === 0) {
    console.log("No links added.");
    return;
  }

  console.log("Changes:");
  for (const result of results) {
    console.log(`\n  ${result.file}`);
    for (const link of result.linksAdded) {
      console.log(`    + [[${link}]]`);
    }
  }

  console.log(`\nTotal: ${results.length} files, ${results.reduce((sum, r) => sum + r.linksAdded.length, 0)} unique link targets`);
}

main();

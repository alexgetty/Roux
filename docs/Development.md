# Development

Local development workflow for Roux and projects that depend on it.

## Setup

```bash
# Clone and install
git clone <repo-url>
cd Roux
npm install

# Link globally (once)
npm link
```

## Using Roux in Another Project

```bash
cd /path/to/other-project
npm link roux
```

This creates a symlink — the other project now uses your local Roux source.

## Development Cycle

Roux compiles TypeScript to `dist/`. After making changes:

```bash
# In Roux directory
npm run build
```

Linked projects see changes immediately — no reinstall needed.

### Watch Mode

For active development:

```bash
npm run dev
```

Rebuilds automatically on file changes.

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run typecheck     # Type check without emitting
```

## Common Issues

### EMFILE: too many open files

macOS file watcher limit. Fix:

```bash
# Temporary (this session)
ulimit -n 65536

# Permanent
sudo launchctl limit maxfiles 65536 200000
```

### Changes Not Reflecting

1. Did you rebuild? `npm run build`
2. Is it linked? Check with `npm ls roux` in the consuming project
3. Cached? Try `npm cache clean --force` in consuming project

### Re-linking After npm install

Running `npm install` in a linked project can break the symlink. Re-run:

```bash
npm link roux
```

## Unlinking

```bash
# In consuming project
npm unlink roux

# Remove global link (in Roux directory)
npm unlink
```

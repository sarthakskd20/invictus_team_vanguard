---
description: Comprehensive Git repository management - sync, analyze, compare local/remote, and push/pull changes flawlessly
---

# Git Manager Skill

This skill provides a complete workflow for managing Git repositories with automatic conflict resolution, divergence detection, and safe synchronization between local and remote repositories.

## Features

- **Repository Analysis**: Compare local and remote branch states
- **Smart Sync**: Automatic pull with rebase and conflict detection
- **Safe Push**: Pre-push validation and automatic retry logic
- **Divergence Detection**: Identify uncommitted changes and branch differences
- **Conflict Resolution**: Guided conflict resolution workflow
- **History Tracking**: Analyze commit history and file changes

## Usage

### 1. Sync Repository (Pull Latest Changes)

```bash
python .agent/skills/git_manager/sync_repo.py --action pull
```

This will:
- Fetch latest changes from remote
- Analyze divergence between local and remote
- Automatically rebase local commits
- Detect and report any conflicts

### 2. Push Changes to Remote

```bash
python .agent/skills/git_manager/sync_repo.py --action push
```

This will:
- Verify all changes are committed
- Pull latest remote changes first
- Push local commits to remote
- Retry automatically on failure

### 3. Full Analysis (Status Check)

```bash
python .agent/skills/git_manager/sync_repo.py --action status
```

This will:
- Show current branch and tracking info
- List uncommitted changes
- Compare local/remote commit history
- Identify divergence and suggest actions

### 4. Full Sync (Pull + Push)

```bash
python .agent/skills/git_manager/sync_repo.py --action sync
```

This will:
- Pull latest changes with rebase
- Resolve any conflicts (interactive)
- Push local commits to remote
- Verify synchronization success

## Arguments

- `--action`: Operation to perform (`pull`, `push`, `status`, `sync`)
- `--branch`: Target branch (default: current branch)
- `--remote`: Remote name (default: `origin`)
- `--force`: Force push (use with caution)
- `--verbose`: Show detailed output

## Examples

**Check repository status:**
```bash
python .agent/skills/git_manager/sync_repo.py --action status --verbose
```

**Sync main branch:**
```bash
python .agent/skills/git_manager/sync_repo.py --action sync --branch main
```

**Force push (dangerous):**
```bash
python .agent/skills/git_manager/sync_repo.py --action push --force
```

## Output

The script returns JSON with:
- `success`: Boolean indicating operation success
- `action`: Action performed
- `branch`: Current branch
- `message`: Human-readable status message
- `commits_ahead`: Number of local commits not pushed
- `commits_behind`: Number of remote commits not pulled
- `uncommitted_files`: List of modified files
- `conflicts`: List of conflict files (if any)

## Requirements

- Python 3.8+
- Git 2.0+
- Repository must have a remote configured

## Safety Features

- Never force-pushes without explicit flag
- Always pulls before pushing
- Detects and prevents destructive operations
- Preserves local changes during conflicts
- Provides rollback information

## Conflict Resolution

If conflicts occur:
1. Script will halt and report conflicting files
2. User must manually resolve conflicts in files
3. After resolution, run sync again
4. Script will complete the merge/rebase

## Notes

- Always commit changes before pulling/pushing
- Use `--verbose` for debugging
- The script will fail safely rather than risk data loss

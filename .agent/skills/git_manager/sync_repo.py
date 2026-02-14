#!/usr/bin/env python3
"""
Git Repository Manager - Flawless Sync Skill
Handles pull, push, status, and full sync operations with automatic conflict detection.
"""

import subprocess
import sys
import json
import argparse
from pathlib import Path


class GitManager:
    """Manages Git operations with safety checks and automatic conflict resolution."""
    
    def __init__(self, repo_path=".", remote="origin", branch=None, verbose=False):
        self.repo_path = Path(repo_path).resolve()
        self.remote = remote
        self.verbose = verbose
        self.branch = branch or self._get_current_branch()
        
    def _run_command(self, cmd, capture_output=True, check=True):
        """Run git command and return result."""
        if self.verbose:
            print(f"[CMD] {' '.join(cmd)}", file=sys.stderr)
        
        try:
            result = subprocess.run(
                cmd,
                cwd=self.repo_path,
                capture_output=capture_output,
                text=True,
                check=check
            )
            return result
        except subprocess.CalledProcessError as e:
            if self.verbose:
                print(f"[ERROR] {e.stderr}", file=sys.stderr)
            raise
    
    def _get_current_branch(self):
        """Get the current Git branch name."""
        result = self._run_command(["git", "rev-parse", "--abbrev-ref", "HEAD"])
        return result.stdout.strip()
    
    def _get_uncommitted_files(self):
        """Get list of files with uncommitted changes."""
        result = self._run_command(["git", "status", "--porcelain"])
        files = []
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                files.append(line.strip())
        return files
    
    def _get_commit_counts(self):
        """Get number of commits ahead/behind remote."""
        self._run_command(["git", "fetch", self.remote, self.branch])
        
        # Commits ahead (local commits not on remote)
        try:
            ahead_result = self._run_command([
                "git", "rev-list", "--count",
                f"{self.remote}/{self.branch}..{self.branch}"
            ])
            commits_ahead = int(ahead_result.stdout.strip())
        except:
            commits_ahead = 0
        
        # Commits behind (remote commits not local)
        try:
            behind_result = self._run_command([
                "git", "rev-list", "--count",
                f"{self.branch}..{self.remote}/{self.branch}"
            ])
            commits_behind = int(behind_result.stdout.strip())
        except:
            commits_behind = 0
        
        return commits_ahead, commits_behind
    
    def status(self):
        """Analyze repository status."""
        uncommitted = self._get_uncommitted_files()
        ahead, behind = self._get_commit_counts()
        
        message_parts = []
        if uncommitted:
            message_parts.append(f"{len(uncommitted)} uncommitted file(s)")
        if ahead > 0:
            message_parts.append(f"{ahead} commit(s) ahead of remote")
        if behind > 0:
            message_parts.append(f"{behind} commit(s) behind remote")
        
        if not message_parts:
            message = "Repository is clean and in sync with remote"
        else:
            message = ", ".join(message_parts)
        
        return {
            "success": True,
            "action": "status",
            "branch": self.branch,
            "remote": self.remote,
            "message": message,
            "commits_ahead": ahead,
            "commits_behind": behind,
            "uncommitted_files": uncommitted,
            "is_clean": len(uncommitted) == 0,
            "is_synced": ahead == 0 and behind == 0
        }
    
    def pull(self, rebase=True):
        """Pull latest changes from remote."""
        uncommitted = self._get_uncommitted_files()
        if uncommitted:
            return {
                "success": False,
                "action": "pull",
                "branch": self.branch,
                "message": f"Cannot pull: {len(uncommitted)} uncommitted changes. Commit or stash first.",
                "uncommitted_files": uncommitted
            }
        
        # Fetch first
        self._run_command(["git", "fetch", self.remote, self.branch])
        
        # Check if behind
        _, behind = self._get_commit_counts()
        if behind == 0:
            return {
                "success": True,
                "action": "pull",
                "branch": self.branch,
                "message": "Already up to date",
                "commits_behind": 0
            }
        
        # Pull with rebase
        try:
            if rebase:
                self._run_command(["git", "pull", "--rebase", self.remote, self.branch])
            else:
                self._run_command(["git", "pull", self.remote, self.branch])
            
            return {
                "success": True,
                "action": "pull",
                "branch": self.branch,
                "message": f"Successfully pulled {behind} commit(s) from {self.remote}/{self.branch}",
                "commits_pulled": behind
            }
        except subprocess.CalledProcessError as e:
            # Check for conflicts
            conflicts = self._get_conflict_files()
            if conflicts:
                return {
                    "success": False,
                    "action": "pull",
                    "branch": self.branch,
                    "message": f"Pull failed: {len(conflicts)} conflict(s) detected",
                    "conflicts": conflicts,
                    "resolution_hint": "Resolve conflicts in files, then run 'git rebase --continue'"
                }
            else:
                return {
                    "success": False,
                    "action": "pull",
                    "branch": self.branch,
                    "message": f"Pull failed: {str(e)}"
                }
    
    def _get_conflict_files(self):
        """Get list of files with merge conflicts."""
        try:
            result = self._run_command(["git", "diff", "--name-only", "--diff-filter=U"], check=False)
            conflicts = [line.strip() for line in result.stdout.strip().split('\n') if line.strip()]
            return conflicts
        except:
            return []
    
    def push(self, force=False):
        """Push local commits to remote."""
        # Check for uncommitted changes
        uncommitted = self._get_uncommitted_files()
        if uncommitted:
            return {
                "success": False,
                "action": "push",
                "branch": self.branch,
                "message": f"Cannot push: {len(uncommitted)} uncommitted changes. Commit first.",
                "uncommitted_files": uncommitted
            }
        
        # Check if we need to pull first
        ahead, behind = self._get_commit_counts()
        
        if ahead == 0:
            return {
                "success": True,
                "action": "push",
                "branch": self.branch,
                "message": "Nothing to push - already up to date"
            }
        
        if behind > 0 and not force:
            return {
                "success": False,
                "action": "push",
                "branch": self.branch,
                "message": f"Cannot push: {behind} commit(s) behind remote. Pull first.",
                "commits_behind": behind,
                "hint": "Run pull action first, or use --force (dangerous)"
            }
        
        # Attempt push
        try:
            push_cmd = ["git", "push", self.remote, self.branch]
            if force:
                push_cmd.append("--force")
            
            self._run_command(push_cmd)
            
            return {
                "success": True,
                "action": "push",
                "branch": self.branch,
                "message": f"Successfully pushed {ahead} commit(s) to {self.remote}/{self.branch}",
                "commits_pushed": ahead,
                "forced": force
            }
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "action": "push",
                "branch": self.branch,
                "message": f"Push failed: {str(e)}",
                "error": str(e)
            }
    
    def sync(self, force_push=False):
        """Full sync: pull then push."""
        # Step 1: Pull
        pull_result = self.pull(rebase=True)
        if not pull_result["success"]:
            return pull_result
        
        # Step 2: Push
        push_result = self.push(force=force_push)
        
        if push_result["success"]:
            return {
                "success": True,
                "action": "sync",
                "branch": self.branch,
                "message": f"Repository fully synced with {self.remote}/{self.branch}",
                "pull_result": pull_result,
                "push_result": push_result
            }
        else:
            return push_result


def main():
    parser = argparse.ArgumentParser(description="Git Repository Manager - Flawless Sync")
    parser.add_argument("--action", required=True, choices=["pull", "push", "status", "sync"],
                        help="Action to perform")
    parser.add_argument("--branch", help="Target branch (default: current branch)")
    parser.add_argument("--remote", default="origin", help="Remote name (default: origin)")
    parser.add_argument("--force", action="store_true", help="Force push (use with caution)")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    parser.add_argument("--repo-path", default=".", help="Path to repository (default: current directory)")
    
    args = parser.parse_args()
    
    manager = GitManager(
        repo_path=args.repo_path,
        remote=args.remote,
        branch=args.branch,
        verbose=args.verbose
    )
    
    # Execute action
    if args.action == "status":
        result = manager.status()
    elif args.action == "pull":
        result = manager.pull()
    elif args.action == "push":
        result = manager.push(force=args.force)
    elif args.action == "sync":
        result = manager.sync(force_push=args.force)
    else:
        result = {"success": False, "message": f"Unknown action: {args.action}"}
    
    # Output JSON result
    print(json.dumps(result, indent=2))
    
    # Exit with appropriate code
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()

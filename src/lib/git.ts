import { execSync } from "node:child_process";

export interface GitStatus {
	branch: string;
	hasChanges: boolean;
	ahead: number;
	behind: number;
	staged: {
		added: number;
		deleted: number;
		files: number;
	};
	unstaged: {
		added: number;
		deleted: number;
		files: number;
	};
}

function exec(cmd: string): { stdout: string; exitCode: number } {
	try {
		return {
			stdout: execSync(cmd, {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			}),
			exitCode: 0,
		};
	} catch (e: any) {
		return { stdout: e.stdout ?? "", exitCode: e.status ?? 1 };
	}
}

export function getGitStatus(): GitStatus {
	try {
		const isGitRepo = exec("git rev-parse --git-dir");
		if (isGitRepo.exitCode !== 0) {
			return {
				branch: "no-git",
				hasChanges: false,
				ahead: 0,
				behind: 0,
				staged: { added: 0, deleted: 0, files: 0 },
				unstaged: { added: 0, deleted: 0, files: 0 },
			};
		}

		const branch =
			exec("git branch --show-current").stdout.trim() || "detached";

		// Commits ahead/behind remote
		let ahead = 0;
		let behind = 0;
		try {
			const abResult = exec(
				"git rev-list --left-right --count HEAD...@{u}",
			);
			if (abResult.exitCode === 0 && abResult.stdout.trim()) {
				const [a, b] = abResult.stdout
					.trim()
					.split(/\s+/)
					.map(Number);
				ahead = a || 0;
				behind = b || 0;
			}
		} catch {
			// No upstream configured
		}

		const diffCheck = exec("git diff-index --quiet HEAD --");
		const cachedCheck = exec("git diff-index --quiet --cached HEAD --");

		if (diffCheck.exitCode !== 0 || cachedCheck.exitCode !== 0) {
			const unstagedDiff = exec("git diff --numstat").stdout;
			const stagedDiff = exec("git diff --cached --numstat").stdout;
			const stagedFilesResult = exec(
				"git diff --cached --name-only",
			).stdout;
			const unstagedFilesResult = exec("git diff --name-only").stdout;

			const parseStats = (diff: string) => {
				let added = 0;
				let deleted = 0;
				for (const line of diff.split("\n")) {
					if (!line.trim()) continue;
					const [a, d] = line
						.split("\t")
						.map((n) => Number.parseInt(n, 10) || 0);
					added += a;
					deleted += d;
				}
				return { added, deleted };
			};

			const unstagedStats = parseStats(unstagedDiff);
			const stagedStats = parseStats(stagedDiff);

			const stagedFilesCount = stagedFilesResult
				.split("\n")
				.filter((f) => f.trim()).length;
			const unstagedFilesCount = unstagedFilesResult
				.split("\n")
				.filter((f) => f.trim()).length;

			return {
				branch,
				hasChanges: true,
				ahead,
				behind,
				staged: {
					added: stagedStats.added,
					deleted: stagedStats.deleted,
					files: stagedFilesCount,
				},
				unstaged: {
					added: unstagedStats.added,
					deleted: unstagedStats.deleted,
					files: unstagedFilesCount,
				},
			};
		}

		return {
			branch,
			hasChanges: false,
			ahead,
			behind,
			staged: { added: 0, deleted: 0, files: 0 },
			unstaged: { added: 0, deleted: 0, files: 0 },
		};
	} catch {
		return {
			branch: "no-git",
			hasChanges: false,
			ahead: 0,
			behind: 0,
			staged: { added: 0, deleted: 0, files: 0 },
			unstaged: { added: 0, deleted: 0, files: 0 },
		};
	}
}

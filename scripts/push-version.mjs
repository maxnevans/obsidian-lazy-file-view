import { execFileSync } from 'node:child_process';

import { validateVersionFiles } from './version-utils.mjs';

function git(...args) {
	return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

const version = validateVersionFiles();
let branch;

try {
	branch = git('symbolic-ref', '--quiet', '--short', 'HEAD');
} catch {
	throw new Error('A release must be pushed from a branch, not a detached HEAD.');
}

if (!branch) {
	throw new Error('A release must be pushed from a branch, not a detached HEAD.');
}

git('check-ref-format', '--branch', branch);
git('remote', 'get-url', 'origin');

const headCommit = git('rev-parse', 'HEAD');
const tagCommit = git('rev-parse', '--verify', `refs/tags/${version}^{commit}`);

if (tagCommit !== headCommit) {
	throw new Error(`Tag ${version} does not point to HEAD (${headCommit}).`);
}

execFileSync(
	'git',
	[
		'push',
		'--atomic',
		'origin',
		`HEAD:refs/heads/${branch}`,
		`refs/tags/${version}:refs/tags/${version}`,
	],
	{ stdio: 'inherit' },
);

console.log(`Pushed ${branch} and tag ${version} to origin atomically.`);

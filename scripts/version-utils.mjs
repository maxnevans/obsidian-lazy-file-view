import { readFileSync } from 'node:fs';

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

export function assertValidSemver(version, label = 'Version') {
	if (typeof version !== 'string' || !SEMVER_PATTERN.test(version)) {
		throw new Error(`${label} must be a valid semantic version without a "v" prefix; received ${JSON.stringify(version)}.`);
	}
}

export function validateVersionFiles(expectedVersion) {
	const packageJson = readJson('package.json');
	const packageLock = readJson('package-lock.json');
	const manifest = readJson('manifest.json');
	const versions = readJson('versions.json');
	const version = packageJson.version;

	assertValidSemver(version, 'package.json version');
	if (typeof manifest.minAppVersion !== 'string' || manifest.minAppVersion.length === 0) {
		throw new Error('manifest.json minAppVersion must be a non-empty string.');
	}

	const checks = [
		['package-lock.json version', packageLock.version],
		['package-lock.json root package version', packageLock.packages?.['']?.version],
		['manifest.json version', manifest.version],
	];

	if (expectedVersion !== undefined) {
		assertValidSemver(expectedVersion, 'Release tag');
		checks.push(['release tag', expectedVersion]);
	}

	for (const [label, actual] of checks) {
		if (actual !== version) {
			throw new Error(`${label} must be ${version}; received ${JSON.stringify(actual)}.`);
		}
	}

	if (versions[version] !== manifest.minAppVersion) {
		throw new Error(
			`versions.json must map ${version} to manifest.json minAppVersion ${manifest.minAppVersion}; ` +
				`received ${JSON.stringify(versions[version])}.`,
		);
	}

	return version;
}

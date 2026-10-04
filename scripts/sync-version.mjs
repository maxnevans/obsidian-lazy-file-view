import { writeFileSync } from 'node:fs';

import { assertValidSemver, readJson } from './version-utils.mjs';

const packageJson = readJson('package.json');
const manifest = readJson('manifest.json');
const versions = readJson('versions.json');
const version = packageJson.version;

assertValidSemver(version, 'package.json version');
if (typeof manifest.minAppVersion !== 'string' || manifest.minAppVersion.length === 0) {
	throw new Error('manifest.json minAppVersion must be a non-empty string.');
}

manifest.version = version;
versions[version] = manifest.minAppVersion;

writeFileSync('manifest.json', `${JSON.stringify(manifest, null, '\t')}\n`);
writeFileSync('versions.json', `${JSON.stringify(versions, null, '\t')}\n`);

console.log(`Synchronized Obsidian metadata for ${version}.`);

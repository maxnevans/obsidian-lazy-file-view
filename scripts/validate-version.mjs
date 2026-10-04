import { validateVersionFiles } from './version-utils.mjs';

const expectedVersion = process.argv[2];
const version = validateVersionFiles(expectedVersion);

console.log(`Version metadata is consistent for ${version}.`);

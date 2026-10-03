import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	normalizeExtensions,
	normalizeFolders,
	parseSettings,
} from '../src/settings-model';

const normalizePath = (path: string): string =>
	path.replaceAll('\\', '/').replace(/\/{2,}/g, '/');

describe('settings normalization', () => {
	const configDir = '.obsidian';

	it('normalizes and deduplicates folder paths', () => {
		expect(
			normalizeFolders(
				[' /Documents/ ', 'Documents', 'Nested\\Files', '', '/', '.'],
				normalizePath,
			),
		).toEqual(['Documents', 'Nested/Files', '/']);
	});

	it('normalizes extensions, including types that can be protected separately', () => {
		expect(
			normalizeExtensions(['.PDF', 'pdf', ' JPG ', '.*', '*', '.md', 'canvas', '']),
		).toEqual(['pdf', 'jpg', '*', 'md', 'canvas']);
	});

	it('merges missing and malformed data with defaults', () => {
		expect(parseSettings(null, normalizePath, configDir)).toEqual({
			...DEFAULT_SETTINGS,
			protectedFolders: [configDir],
		});
		expect(
			parseSettings(
				{ mode: 'invalid', folders: 'Documents', extensions: 12 },
				normalizePath,
				configDir,
			),
		).toEqual({
			...DEFAULT_SETTINGS,
			protectedFolders: [configDir],
		});
	});

	it('preserves explicit empty lists', () => {
		expect(
			parseSettings(
				{
					mode: 'extensions',
					folders: [],
					extensions: [],
					protectedFolders: [],
					protectedExtensions: [],
				},
				normalizePath,
				configDir,
			),
		).toEqual({
			mode: 'extensions',
			folders: [],
			extensions: [],
			protectedFolders: [],
			protectedExtensions: [],
		});
	});

	it('migrates protected defaults using the active vault configuration folder', () => {
		expect(
			parseSettings(
				{ mode: 'folders', folders: ['Documents'], extensions: ['pdf'] },
				normalizePath,
				'.config/obsidian',
			),
		).toEqual({
			mode: 'folders',
			folders: ['Documents'],
			extensions: ['pdf'],
			protectedFolders: ['.config/obsidian'],
			protectedExtensions: ['md', 'canvas', 'base'],
		});
	});

	it('replaces malformed protected settings with safe defaults', () => {
		expect(
			parseSettings(
				{
					protectedFolders: 'Private',
					protectedExtensions: 12,
				},
				normalizePath,
				configDir,
			),
		).toEqual({
			...DEFAULT_SETTINGS,
			protectedFolders: [configDir],
		});
	});
});

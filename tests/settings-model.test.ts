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
	it('normalizes and deduplicates folder paths', () => {
		expect(
			normalizeFolders(
				[' /Documents/ ', 'Documents', 'Nested\\Files', '', '/', '.'],
				normalizePath,
			),
		).toEqual(['Documents', 'Nested/Files']);
	});

	it('normalizes extensions and removes protected types', () => {
		expect(normalizeExtensions(['.PDF', 'pdf', ' JPG ', '.md', 'canvas', ''])).toEqual([
			'pdf',
			'jpg',
		]);
	});

	it('merges missing and malformed data with defaults', () => {
		expect(parseSettings(null, normalizePath)).toEqual(DEFAULT_SETTINGS);
		expect(
			parseSettings(
				{ mode: 'invalid', folders: 'Documents', extensions: 12 },
				normalizePath,
			),
		).toEqual(DEFAULT_SETTINGS);
	});

	it('preserves explicit empty lists', () => {
		expect(
			parseSettings(
				{ mode: 'extensions', folders: [], extensions: [] },
				normalizePath,
			),
		).toEqual({ mode: 'extensions', folders: [], extensions: [] });
	});
});

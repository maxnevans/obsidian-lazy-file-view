import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	createEmptyRule,
	normalizeExtensions,
	normalizeFilePaths,
	normalizeFolders,
	parseSettings,
	validateFolderPath,
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

	it('validates folder paths using Obsidian folder-name restrictions', () => {
		expect(validateFolderPath('Documents/Reports')).toBeUndefined();
		expect(validateFolderPath('/')).toBeUndefined();
		expect(validateFolderPath('Documents:Reports')).toBe(
			'File name cannot contain any of these characters: * " \\ / < > : | ?',
		);
		expect(validateFolderPath('.private')).toBe(
			'File name must not start with a dot.',
		);
		expect(validateFolderPath('Documents/.private')).toBe(
			'File name must not start with a dot.',
		);
		expect(validateFolderPath('Documents//Reports')).toBe(
			'Folder path cannot contain empty segments.',
		);
	});

	it('normalizes extensions and vault-relative file paths', () => {
		expect(normalizeExtensions(['.PDF', 'pdf', ' JPG ', '.*', '*', ''])).toEqual([
			'pdf',
			'jpg',
			'*',
		]);
		expect(
			normalizeFilePaths(
				[' /Documents/report.pdf ', 'Documents\\report.pdf', '.', ''],
				normalizePath,
			),
		).toEqual(['Documents/report.pdf']);
	});

	it('uses new defaults for missing, malformed, and legacy settings', () => {
		for (const data of [
			null,
			{ rules: 'invalid' },
			{ mode: 'folders', folders: ['Private'], extensions: ['zip'] },
		]) {
			expect(parseSettings(data, normalizePath, configDir)).toEqual(
				DEFAULT_SETTINGS,
			);
		}
	});

	it('returns independent copies of fresh defaults', () => {
		const first = parseSettings(null, normalizePath, configDir);
		first.rules[0]?.extensions.push('changed');
		expect(parseSettings(null, normalizePath, configDir)).toEqual(DEFAULT_SETTINGS);
	});

	it('preserves explicit empty rules', () => {
		expect(parseSettings({ rules: [] }, normalizePath, configDir)).toEqual({
			rules: [],
		});
	});

	it('normalizes rule fields while retaining inactive out-of-folder files', () => {
		expect(
			parseSettings(
				{
					rules: [
						{
							folder: ' /Documents/Some/ ',
							behavior: 'default-app',
							extensions: ['.PDF', 'pdf'],
							files: ['Documents\\Some\\report.docx', 'Other/file.pdf'],
							excludedFiles: ['Documents/Some/skip.pdf'],
						},
					],
				},
				normalizePath,
				configDir,
			),
		).toEqual({
			rules: [
				{
					folder: 'Documents/Some',
					behavior: 'default-app',
					extensions: ['pdf'],
					files: ['Documents/Some/report.docx', 'Other/file.pdf'],
					excludedFiles: ['Documents/Some/skip.pdf'],
				},
			],
		});
	});

	it('keeps malformed rules safe and inactive', () => {
		expect(
			parseSettings(
				{
					rules: [null, { folder: 12, behavior: 'invalid', extensions: 3 }],
				},
				normalizePath,
				configDir,
			),
		).toEqual({
			rules: [
				{
					folder: '',
					behavior: 'obsidian',
					extensions: [],
					files: [],
					excludedFiles: [],
				},
			],
		});
	});

	it('preserves invalid folder text so it remains visible but inactive', () => {
		expect(
			parseSettings(
				{
					rules: [
						{ folder: '.Private', behavior: 'placeholder', extensions: ['*'] },
						{
							folder: 'Documents\\Private',
							behavior: 'default-app',
							extensions: ['pdf'],
						},
					],
				},
				normalizePath,
				configDir,
			),
		).toEqual({
			rules: [
				{
					folder: '.Private',
					behavior: 'placeholder',
					extensions: ['*'],
					files: [],
					excludedFiles: [],
				},
				{
					folder: 'Documents\\Private',
					behavior: 'default-app',
					extensions: ['pdf'],
					files: [],
					excludedFiles: [],
				},
			],
		});
	});

	it('creates a safe editable rule draft', () => {
		expect(createEmptyRule()).toEqual({
			folder: '',
			behavior: 'placeholder',
			extensions: ['*'],
			files: [],
			excludedFiles: [],
		});
	});
});

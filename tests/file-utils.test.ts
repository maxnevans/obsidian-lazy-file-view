import { describe, expect, it } from 'vitest';
import {
	describeFileType,
	formatFileSize,
	isPathInFolder,
	resolveFileOpenBehavior,
} from '../src/file-utils';
import type {
	FileOpenBehavior,
	FileOpenRule,
	LazyFileViewSettings,
} from '../src/types';

describe('resolveFileOpenBehavior', () => {
	it('leaves files outside every configured folder with Obsidian', () => {
		const settings = settingsWith(rule('Documents', 'placeholder', ['*']));
		expect(resolve('Documents/file.pdf', settings)).toBe('placeholder');
		expect(resolve('Documents-old/file.pdf', settings)).toBe('obsidian');
		expect(resolve('Other/file.pdf', settings)).toBe('obsidian');
	});

	it('ignores rules with invalid folder names', () => {
		const settings = settingsWith(
			rule('Documents:Private', 'default-app', ['*']),
			rule('.Private', 'placeholder', ['*']),
			rule('Documents\\Private', 'default-app', ['*']),
		);
		expect(resolve('Documents:Private/file.pdf', settings)).toBe('obsidian');
		expect(resolve('.Private/file.pdf', settings)).toBe('obsidian');
		expect(resolve('Documents/Private/file.pdf', settings)).toBe('obsidian');
	});

	it('uses the nearest folder and blocks parent fallback on a wildcard', () => {
		const settings = settingsWith(
			rule('Documents', 'placeholder', ['pdf']),
			rule('Documents/Some', 'obsidian', ['*']),
			rule('Documents/Some/Other', 'default-app', ['*']),
		);
		expect(resolve('Documents/report.pdf', settings)).toBe('placeholder');
		expect(resolve('Documents/Some/report.pdf', settings)).toBe('obsidian');
		expect(resolve('Documents/Some/Other/report.pdf', settings)).toBe(
			'default-app',
		);
	});

	it('lets exact extensions beat wildcards at the same folder', () => {
		const settings = settingsWith(
			rule('Documents', 'placeholder', ['*']),
			rule('Documents', 'default-app', ['pdf']),
		);
		expect(resolve('Documents/report.pdf', settings)).toBe('default-app');
		expect(resolve('Documents/report.docx', settings)).toBe('placeholder');
		expect(resolve('Documents/README', settings)).toBe('placeholder');
	});

	it('uses visible order to break equal-priority ties', () => {
		const settings = settingsWith(
			rule('Documents', 'default-app', ['pdf']),
			rule('Documents', 'placeholder', ['pdf']),
		);
		expect(resolve('Documents/report.pdf', settings)).toBe('default-app');
	});

	it('lets a parent exact file beat a child extension rule', () => {
		const parent = rule('Documents', 'default-app', []);
		parent.files = ['Documents/Some/report.pdf'];
		const child = rule('Documents/Some', 'placeholder', ['pdf']);
		expect(resolve('Documents/Some/report.pdf', settingsWith(parent, child))).toBe(
			'default-app',
		);
	});

	it('lets the nearest exact-file rule win', () => {
		const parent = rule('Documents', 'placeholder', []);
		parent.files = ['Documents/Some/report.pdf'];
		const child = rule('Documents/Some', 'default-app', []);
		child.files = ['Documents/Some/report.pdf'];
		expect(resolve('Documents/Some/report.pdf', settingsWith(parent, child))).toBe(
			'default-app',
		);
	});

	it('matches exact files independently of extensions', () => {
		const exact = rule('Documents', 'default-app', ['docx']);
		exact.files = ['Documents/report.pdf'];
		expect(resolve('Documents/report.pdf', settingsWith(exact))).toBe(
			'default-app',
		);
	});

	it('supports an all-files wildcard in the exact-files list', () => {
		const parent = rule('Documents', 'default-app', []);
		parent.files = ['*'];
		const child = rule('Documents/Some', 'placeholder', ['pdf']);
		expect(resolve('Documents/Some/report.pdf', settingsWith(parent, child))).toBe(
			'default-app',
		);
	});

	it('excludes only the rule containing the exact exclusion', () => {
		const excluded = rule('Documents/Some', 'default-app', ['pdf']);
		excluded.excludedFiles = ['Documents/Some/report.pdf'];
		const sameFolder = rule('Documents/Some', 'placeholder', ['pdf']);
		const parent = rule('Documents', 'obsidian', ['pdf']);
		expect(
			resolve(
				'Documents/Some/report.pdf',
				settingsWith(excluded, sameFolder, parent),
			),
		).toBe('placeholder');
	});

	it('lets an exclusion override inclusion on the same rule', () => {
		const excluded = rule('Documents', 'default-app', ['pdf']);
		excluded.files = ['Documents/report.pdf'];
		excluded.excludedFiles = ['Documents/report.pdf'];
		const fallback = rule('Documents', 'placeholder', ['pdf']);
		expect(resolve('Documents/report.pdf', settingsWith(excluded, fallback))).toBe(
			'placeholder',
		);
	});

	it('ignores exact paths that are outside their rule folder', () => {
		const outside = rule('Private', 'default-app', []);
		outside.files = ['Documents/report.pdf'];
		expect(resolve('Documents/report.pdf', settingsWith(outside))).toBe('obsidian');
	});

	it('supports the vault-root folder', () => {
		const settings = settingsWith(rule('/', 'placeholder', ['*']));
		expect(resolve('root.pdf', settings)).toBe('placeholder');
		expect(resolve('Nested/file.pdf', settings)).toBe('placeholder');
	});
});

describe('file utilities', () => {
	it('uses folder path boundaries', () => {
		expect(isPathInFolder('file.pdf', '/')).toBe(true);
		expect(isPathInFolder('Nested/file.pdf', '/')).toBe(true);
		expect(isPathInFolder('Documents/file.pdf', 'Documents')).toBe(true);
		expect(isPathInFolder('Documents-old/file.pdf', 'Documents')).toBe(false);
		expect(isPathInFolder('Documents/file.pdf', '/Documents/')).toBe(true);
	});

	it('formats byte sizes without reading file contents', () => {
		expect(formatFileSize(100)).toBe('100 B');
		expect(formatFileSize(1024)).toBe('1.00 KB');
		expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB');
		expect(formatFileSize(-1)).toBe('Unknown size');
	});

	it('describes common and arbitrary extensions', () => {
		expect(describeFileType('pdf')).toBe('PDF document');
		expect(describeFileType('JPG')).toBe('JPG image');
		expect(describeFileType('bin')).toBe('BIN file');
	});
});

function settingsWith(...rules: FileOpenRule[]): LazyFileViewSettings {
	return { rules };
}

function rule(
	folder: string,
	behavior: FileOpenBehavior,
	extensions: string[],
): FileOpenRule {
	return { folder, behavior, extensions, files: [], excludedFiles: [] };
}

function resolve(path: string, settings: LazyFileViewSettings): FileOpenBehavior {
	return resolveFileOpenBehavior(
		{ path, extension: path.includes('.') ? (path.split('.').at(-1) ?? '') : '' },
		settings,
	);
}

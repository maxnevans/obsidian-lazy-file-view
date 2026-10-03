import { describe, expect, it } from 'vitest';
import {
	describeFileType,
	formatFileSize,
	isPathInFolder,
	shouldInterceptFile,
} from '../src/file-utils';
import type { LazyFileViewSettings } from '../src/types';

const baseSettings: LazyFileViewSettings = {
	mode: 'folders',
	folders: ['Documents', 'Attachments'],
	extensions: ['pdf', 'jpg'],
	protectedFolders: ['.obsidian'],
	protectedExtensions: ['md', 'canvas', 'base'],
};

describe('shouldInterceptFile', () => {
	it('matches only configured folder descendants in folder mode', () => {
		expect(shouldInterceptFile(file('Documents/file.pdf'), baseSettings)).toBe(true);
		expect(shouldInterceptFile(file('Documents-old/file.pdf'), baseSettings)).toBe(false);
		expect(shouldInterceptFile(file('Other/file.pdf'), baseSettings)).toBe(false);
	});

	it('matches configured extensions case-insensitively in extension mode', () => {
		const settings = { ...baseSettings, mode: 'extensions' as const };
		expect(shouldInterceptFile(file('Other/file.PDF'), settings)).toBe(true);
		expect(shouldInterceptFile(file('Other/file.zip'), settings)).toBe(false);
	});

	it('matches the vault root folder entry', () => {
		const settings = { ...baseSettings, folders: ['/'] };
		expect(shouldInterceptFile(file('root.pdf'), settings)).toBe(true);
		expect(shouldInterceptFile(file('Nested/file.pdf'), settings)).toBe(true);
	});

	it('matches every non-protected extension with a wildcard', () => {
		const settings = {
			...baseSettings,
			mode: 'extensions' as const,
			extensions: ['*'],
		};
		expect(shouldInterceptFile(file('Other/file.zip'), settings)).toBe(true);
		expect(shouldInterceptFile(file('Other/file.md'), settings)).toBe(false);
	});

	it('matches either condition in either mode', () => {
		const settings = { ...baseSettings, mode: 'either' as const };
		expect(shouldInterceptFile(file('Documents/file.zip'), settings)).toBe(true);
		expect(shouldInterceptFile(file('Other/file.jpg'), settings)).toBe(true);
		expect(shouldInterceptFile(file('Other/file.zip'), settings)).toBe(false);
	});

	it.each(['md', 'canvas', 'base'])('never intercepts .%s files', (extension) => {
		const settings = {
			...baseSettings,
			mode: 'either' as const,
		};
		expect(
			shouldInterceptFile(file(`Documents/file.${extension}`), settings),
		).toBe(false);
	});

	it('never intercepts files inside the vault configuration directory', () => {
		const settings = {
			...baseSettings,
			mode: 'either' as const,
			folders: ['/'],
			extensions: ['json'],
		};
		expect(
			shouldInterceptFile(file('.obsidian/plugins/example/data.json'), settings),
		).toBe(false);
	});

	it('allows protected rules to be edited or cleared', () => {
		const editableSettings = {
			...baseSettings,
			mode: 'extensions' as const,
			extensions: ['*'],
			protectedFolders: ['Private'],
			protectedExtensions: ['secret'],
		};
		expect(shouldInterceptFile(file('Private/file.pdf'), editableSettings)).toBe(false);
		expect(shouldInterceptFile(file('Other/file.secret'), editableSettings)).toBe(false);
		expect(
			shouldInterceptFile(file('Other/file.md'), {
				...editableSettings,
				protectedFolders: [],
				protectedExtensions: [],
			}),
		).toBe(true);
	});

	it('supports a protected-extension wildcard', () => {
		const settings = {
			...baseSettings,
			mode: 'extensions' as const,
			extensions: ['*'],
			protectedExtensions: ['*'],
		};
		expect(shouldInterceptFile(file('Other/file.pdf'), settings)).toBe(false);
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

function file(path: string): { path: string; extension: string } {
	return {
		path,
		extension: path.split('.').at(-1) ?? '',
	};
}

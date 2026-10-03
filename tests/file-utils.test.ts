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
};

describe('shouldInterceptFile', () => {
	it('matches only configured folder descendants in folder mode', () => {
		expect(shouldInterceptFile(file('Documents/file.pdf'), baseSettings, '.obsidian')).toBe(true);
		expect(shouldInterceptFile(file('Documents-old/file.pdf'), baseSettings, '.obsidian')).toBe(false);
		expect(shouldInterceptFile(file('Other/file.pdf'), baseSettings, '.obsidian')).toBe(false);
	});

	it('matches configured extensions case-insensitively in extension mode', () => {
		const settings = { ...baseSettings, mode: 'extensions' as const };
		expect(shouldInterceptFile(file('Other/file.PDF'), settings, '.obsidian')).toBe(true);
		expect(shouldInterceptFile(file('Other/file.zip'), settings, '.obsidian')).toBe(false);
	});

	it('matches either condition in either mode', () => {
		const settings = { ...baseSettings, mode: 'either' as const };
		expect(shouldInterceptFile(file('Documents/file.zip'), settings, '.obsidian')).toBe(true);
		expect(shouldInterceptFile(file('Other/file.jpg'), settings, '.obsidian')).toBe(true);
		expect(shouldInterceptFile(file('Other/file.zip'), settings, '.obsidian')).toBe(false);
	});

	it.each(['md', 'canvas', 'base'])('never intercepts .%s files', (extension) => {
		const settings = {
			mode: 'either' as const,
			folders: ['Documents'],
			extensions: [extension],
		};
		expect(
			shouldInterceptFile(file(`Documents/file.${extension}`), settings, '.obsidian'),
		).toBe(false);
	});

	it('never intercepts files inside the vault configuration directory', () => {
		const settings = {
			mode: 'either' as const,
			folders: ['.obsidian'],
			extensions: ['json'],
		};
		expect(
			shouldInterceptFile(file('.obsidian/plugins/example/data.json'), settings, '.obsidian'),
		).toBe(false);
	});
});

describe('file utilities', () => {
	it('uses folder path boundaries', () => {
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

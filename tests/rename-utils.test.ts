import { describe, expect, it } from 'vitest';
import {
	filenameSelectionEnd,
	renameFilenameError,
	renamedFilePath,
} from '../src/rename-utils';

describe('renamedFilePath', () => {
	it('keeps root files in the vault root', () => {
		expect(renamedFilePath('report.pdf', 'renamed.pdf')).toBe('renamed.pdf');
	});

	it('keeps nested files in their current folder', () => {
		expect(renamedFilePath('Attachments/report.pdf', 'renamed.pdf')).toBe(
			'Attachments/renamed.pdf',
		);
	});

	it('passes the entered filename through unchanged', () => {
		expect(renamedFilePath('Attachments/report.pdf', 'nested/name.pdf')).toBe(
			'Attachments/nested/name.pdf',
		);
	});
});

describe('filenameSelectionEnd', () => {
	it('selects the basename while leaving the final extension unselected', () => {
		expect(filenameSelectionEnd('archive.tar.gz', 'gz')).toBe('archive.tar'.length);
	});

	it('selects the full name when there is no extension', () => {
		expect(filenameSelectionEnd('README', '')).toBe('README'.length);
	});
});

describe('renameFilenameError', () => {
	it('rejects filenames that start with a dot', () => {
		expect(renameFilenameError('.hidden.pdf')).toBe(
			'File name must not start with a dot.',
		);
	});

	it('leaves other filename validation to Obsidian', () => {
		expect(renameFilenameError('report.pdf')).toBeNull();
		expect(renameFilenameError('report:name.pdf')).toBeNull();
	});
});

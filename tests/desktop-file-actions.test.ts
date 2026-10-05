import type { App, TFile } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopFileActions } from '../src/desktop-file-actions';

const shell = vi.hoisted(() => ({
	openPath: vi.fn<(path: string) => Promise<string>>(),
	showItemInFolder: vi.fn<(path: string) => void>(),
}));

vi.mock('electron', () => ({ shell }));

describe('DesktopFileActions', () => {
	beforeEach(() => {
		vi.mocked(shell.openPath).mockReset();
		vi.mocked(shell.showItemInFolder).mockReset();
	});

	it('opens a filesystem-backed file and reports shell errors', async () => {
		const actions = new DesktopFileActions(appWith(filesystemAdapter()));
		vi.mocked(shell.openPath).mockResolvedValueOnce('');
		await expect(actions.openInDefaultApp(file())).resolves.toBeNull();
		expect(shell.openPath).toHaveBeenCalledWith('C:/Vault/Documents/report.pdf');

		vi.mocked(shell.openPath).mockResolvedValueOnce('No associated application');
		await expect(actions.openInDefaultApp(file())).resolves.toBe(
			'No associated application',
		);
	});

	it('converts thrown launch errors to messages', async () => {
		const actions = new DesktopFileActions(appWith(filesystemAdapter()));
		vi.mocked(shell.openPath).mockRejectedValueOnce(new Error('launch failed'));
		await expect(actions.openInDefaultApp(file())).resolves.toBe('launch failed');
	});

	it('rejects vault adapters without desktop filesystem paths', async () => {
		const actions = new DesktopFileActions(appWith({}));
		await expect(actions.openInDefaultApp(file())).resolves.toBe(
			'This vault does not use a desktop filesystem adapter.',
		);
		expect(shell.openPath).not.toHaveBeenCalled();
	});

	it('reveals filesystem-backed files and reports reveal errors', () => {
		const actions = new DesktopFileActions(appWith(filesystemAdapter()));
		expect(actions.revealInSystemExplorer(file())).toBeNull();
		expect(shell.showItemInFolder).toHaveBeenCalledWith(
			'C:/Vault/Documents/report.pdf',
		);

		vi.mocked(shell.showItemInFolder).mockImplementationOnce(() => {
			throw new Error('reveal failed');
		});
		expect(actions.revealInSystemExplorer(file())).toBe('reveal failed');
	});
});

function appWith(adapter: unknown): App {
	return { vault: { adapter } } as unknown as App;
}

function filesystemAdapter(): { getFullPath(path: string): string } {
	return { getFullPath: (path) => `C:/Vault/${path}` };
}

function file(): TFile {
	return {
		path: 'Documents/report.pdf',
		name: 'report.pdf',
		basename: 'report',
		extension: 'pdf',
		parent: null,
		vault: appWith(filesystemAdapter()).vault,
		stat: { ctime: 0, mtime: 0, size: 0 },
	};
}

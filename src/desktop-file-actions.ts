import { shell } from 'electron';
import type { App, TFile } from 'obsidian';

export class DesktopFileActions {
	constructor(private readonly app: App) {}

	async openInDefaultApp(file: TFile): Promise<string | null> {
		const fullPath = this.getSystemPath(file);
		if (typeof fullPath !== 'string') return fullPath.error;

		try {
			const error = await shell.openPath(fullPath);
			return error || null;
		} catch (error) {
			return errorMessage(error);
		}
	}

	revealInSystemExplorer(file: TFile): string | null {
		const fullPath = this.getSystemPath(file);
		if (typeof fullPath !== 'string') return fullPath.error;

		try {
			shell.showItemInFolder(fullPath);
			return null;
		} catch (error) {
			return errorMessage(error);
		}
	}

	private getSystemPath(file: TFile): string | { error: string } {
		const adapter = this.app.vault.adapter;
		if (!hasSystemPath(adapter)) {
			return { error: 'This vault does not use a desktop filesystem adapter.' };
		}
		return adapter.getFullPath(file.path);
	}
}

function hasSystemPath(
	adapter: unknown,
): adapter is { getFullPath(path: string): string } {
	return (
		typeof adapter === 'object' &&
		adapter !== null &&
		'getFullPath' in adapter &&
		typeof adapter.getFullPath === 'function'
	);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

import { shell } from 'electron';
import {
	FileSystemAdapter,
	FileView,
	Notice,
	TFile,
	type ViewStateResult,
	type WorkspaceLeaf,
} from 'obsidian';
import { VIEW_TYPE_PLACEHOLDER } from './constants';
import { describeFileType, formatFileSize } from './file-utils';
import type LazyFileViewPlugin from './main';

export class BinaryPlaceholderView extends FileView {
	allowNoFile = true;
	navigation = true;
	private statePath = '';

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: LazyFileViewPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_PLACEHOLDER;
	}

	getDisplayText(): string {
		return this.file?.name ?? basename(this.statePath) ?? 'File not found';
	}

	getIcon(): string {
		return 'file-box';
	}

	canAcceptExtension(_extension: string): boolean {
		// A delegated open must let Obsidian select its native view. Returning
		// true here would keep reusing this placeholder for Markdown and bypasses.
		return false;
	}

	getState(): Record<string, unknown> {
		return {
			...super.getState(),
			file: this.file?.path ?? this.statePath,
		};
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		if (isRecord(state) && typeof state.file === 'string') {
			this.statePath = state.file;
		}
		await super.setState(state, result);
		this.render();
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.statePath = file.path;
		this.render();
	}

	async onUnloadFile(file: TFile): Promise<void> {
		this.statePath = file.path;
		this.render();
	}

	async onRename(file: TFile): Promise<void> {
		await super.onRename(file);
		this.statePath = file.path;
		this.render();
	}

	handleDeleted(path: string): void {
		if (path !== this.statePath && path !== this.file?.path) {
			return;
		}
		this.statePath = path;
		this.render();
	}

	private render(): void {
		const contentEl = this.contentEl;
		contentEl.empty();
		contentEl.addClass('lazy-file-view');

		const file = this.resolveFile();
		if (!file) {
			this.renderMissing(contentEl);
			return;
		}

		const card = contentEl.createDiv({ cls: 'lazy-file-view__card' });
		card.createEl('h2', {
			cls: 'lazy-file-view__title',
			text: file.name,
		});
		card.createDiv({
			cls: 'lazy-file-view__metadata',
			text: `${describeFileType(file.extension)} · ${formatFileSize(file.stat.size)}`,
		});
		card.createDiv({
			cls: 'lazy-file-view__path',
			text: file.path,
		});

		const actions = card.createDiv({ cls: 'lazy-file-view__actions' });
		this.createAction(actions, 'Open with Obsidian', 'mod-cta', async () => {
			await this.plugin.openNatively(this.leaf, file);
		});
		this.createAction(actions, 'Open with default app', '', async () => {
			await this.openInDefaultApp(file);
		});
		this.createAction(actions, 'Reveal in system explorer', '', () => {
			this.revealInSystemExplorer(file);
		});
	}

	private renderMissing(contentEl: HTMLElement): void {
		const card = contentEl.createDiv({ cls: 'lazy-file-view__card' });
		card.createEl('h2', { text: 'File not found' });
		card.createDiv({
			cls: 'lazy-file-view__path',
			text: this.statePath || 'Unknown file',
		});
		this.createAction(card, 'Close tab', 'mod-cta', () => {
			this.leaf.detach();
		});
	}

	private resolveFile(): TFile | null {
		const path = this.file?.path ?? this.statePath;
		if (!path) return null;
		return this.app.vault.getFileByPath(path);
	}

	private getSystemPath(file: TFile): string | null {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			new Notice('This vault does not use a desktop filesystem adapter.');
			return null;
		}
		return adapter.getFullPath(file.path);
	}

	private async openInDefaultApp(file: TFile): Promise<void> {
		const fullPath = this.getSystemPath(file);
		if (!fullPath) return;

		try {
			const error = await shell.openPath(fullPath);
			if (error) {
				new Notice(`Couldn't open the file using the default application: ${error}`);
			}
		} catch (error) {
			new Notice(`Couldn't open the file using the default application: ${errorMessage(error)}`);
		}
	}

	private revealInSystemExplorer(file: TFile): void {
		const fullPath = this.getSystemPath(file);
		if (!fullPath) return;

		try {
			shell.showItemInFolder(fullPath);
		} catch (error) {
			new Notice(`Couldn't reveal the file: ${errorMessage(error)}`);
		}
	}

	private createAction(
		container: HTMLElement,
		label: string,
		modifierClass: string,
		action: () => Promise<void> | void,
	): HTMLButtonElement {
		const button = container.createEl('button', { text: label });
		if (modifierClass) button.addClass(modifierClass);
		button.addEventListener('click', () => {
			void action();
		});
		return button;
	}
}

function basename(path: string): string | null {
	if (!path) return null;
	return path.split('/').at(-1) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

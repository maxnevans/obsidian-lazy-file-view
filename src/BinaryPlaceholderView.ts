import { shell } from 'electron';
import {
	FileSystemAdapter,
	FileView,
	Notice,
	setIcon,
	TFile,
	type ViewStateResult,
	type WorkspaceLeaf,
} from 'obsidian';
import { VIEW_TYPE_PLACEHOLDER } from './constants';
import { describeFileType, formatFileSize } from './file-utils';
import type LazyFileViewPlugin from './main';
import {
	filenameSelectionEnd,
	renameFilenameError,
	renamedFilePath,
} from './rename-utils';

export class BinaryPlaceholderView extends FileView {
	allowNoFile = true;
	navigation = true;
	private statePath = '';
	private removeRenameOutsideClick: (() => void) | null = null;
	private renamePending = false;

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

	async onClose(): Promise<void> {
		this.clearRenameOutsideClick();
		await super.onClose();
	}

	handleDeleted(path: string): void {
		if (path !== this.statePath && path !== this.file?.path) {
			return;
		}
		this.statePath = path;
		this.render();
	}

	beginRename(): boolean {
		const file = this.resolveFile();
		const titleArea = this.contentEl.querySelector<HTMLElement>(
			'.lazy-file-view__title-area',
		);
		if (!file || !titleArea) return false;

		const existingInput = titleArea.querySelector<HTMLInputElement>(
			'.lazy-file-view__rename-input',
		);
		if (existingInput) {
			existingInput.focus();
			return true;
		}

		this.renderRenameEditor(titleArea, file);
		return true;
	}

	private render(): void {
		this.clearRenameOutsideClick();
		this.renamePending = false;

		const contentEl = this.contentEl;
		contentEl.empty();
		contentEl.addClass('lazy-file-view');

		const file = this.resolveFile();
		if (!file) {
			this.renderMissing(contentEl);
			return;
		}

		const card = contentEl.createDiv({ cls: 'lazy-file-view__card' });
		const titleArea = card.createDiv({ cls: 'lazy-file-view__title-area' });
		this.renderFilename(titleArea, file);
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

	private renderFilename(container: HTMLElement, file: TFile): void {
		this.clearRenameOutsideClick();
		this.renamePending = false;
		container.empty();

		const titleRow = container.createDiv({ cls: 'lazy-file-view__title-row' });
		const title = titleRow.createEl('h2', {
			cls: 'lazy-file-view__title',
			text: file.name,
		});
		title.addEventListener('dblclick', () => {
			this.renderRenameEditor(container, file);
		});

		const renameButton = titleRow.createEl('button', {
			cls: 'lazy-file-view__rename-trigger clickable-icon',
			attr: {
				type: 'button',
				'aria-label': 'Rename file',
				title: 'Rename file',
			},
		});
		setIcon(renameButton, 'pencil');
		renameButton.addEventListener('click', () => {
			this.renderRenameEditor(container, file);
		});
	}

	private renderRenameEditor(container: HTMLElement, file: TFile): void {
		this.clearRenameOutsideClick();
		this.renamePending = false;
		container.empty();

		const controls = container.createDiv({ cls: 'lazy-file-view__rename-controls' });
		const input = controls.createEl('input', {
			cls: 'lazy-file-view__rename-input',
			attr: {
				type: 'text',
				value: file.name,
				'aria-label': 'File name',
			},
		});
		const renameButton = controls.createEl('button', {
			text: 'Rename',
			cls: 'mod-cta',
			attr: { type: 'button' },
		});
		const cancelButton = controls.createEl('button', {
			text: 'Cancel',
			attr: { type: 'button' },
		});
		const errorEl = container.createDiv({ cls: 'lazy-file-view__rename-error' });
		errorEl.hidden = true;

		const cancel = (): void => {
			if (this.renamePending) return;
			this.renderFilename(container, file);
		};
		const submit = async (): Promise<void> => {
			if (this.renamePending) return;
			const validationError = renameFilenameError(input.value);
			if (validationError) {
				errorEl.setText(validationError);
				errorEl.hidden = false;
				input.focus();
				return;
			}
			if (input.value === file.name) {
				this.renderFilename(container, file);
				return;
			}

			this.renamePending = true;
			input.disabled = true;
			renameButton.disabled = true;
			cancelButton.disabled = true;
			errorEl.hidden = true;

			try {
				await this.app.fileManager.renameFile(
					file,
					renamedFilePath(file.path, input.value),
				);
			} catch (error) {
				this.renamePending = false;
				input.disabled = false;
				renameButton.disabled = false;
				cancelButton.disabled = false;
				errorEl.setText(errorMessage(error));
				errorEl.hidden = false;
				input.focus();
			}
		};

		input.addEventListener('input', () => {
			errorEl.hidden = true;
		});
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void submit();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				cancel();
			}
		});
		renameButton.addEventListener('click', () => {
			void submit();
		});
		cancelButton.addEventListener('click', cancel);

		const document = container.ownerDocument;
		const handleOutsideClick = (event: MouseEvent): void => {
			if (
				this.renamePending ||
				(event.target && container.contains(event.target as Node))
			) {
				return;
			}
			cancel();
		};
		document.addEventListener('click', handleOutsideClick, true);
		this.removeRenameOutsideClick = () => {
			document.removeEventListener('click', handleOutsideClick, true);
		};

		input.focus();
		input.setSelectionRange(0, filenameSelectionEnd(file.name, file.extension));
	}

	private clearRenameOutsideClick(): void {
		this.removeRenameOutsideClick?.();
		this.removeRenameOutsideClick = null;
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

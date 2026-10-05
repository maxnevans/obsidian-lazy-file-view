import {
	normalizePath,
	Notice,
	Plugin,
	TFile,
	type WorkspaceLeaf,
} from 'obsidian';
import { BinaryPlaceholderView } from './BinaryPlaceholderView';
import { VIEW_TYPE_PLACEHOLDER } from './constants';
import { DesktopFileActions } from './desktop-file-actions';
import { resolveFileOpenBehavior } from './file-utils';
import { OpenInterceptor } from './open-interceptor';
import { RenameCommandInterceptor } from './rename-command-interceptor';
import { LazyFileViewSettingTab } from './settings';
import { parseSettings } from './settings-model';
import type { LazyFileViewSettings } from './types';

export default class LazyFileViewPlugin extends Plugin {
	settings!: LazyFileViewSettings;
	private interceptor!: OpenInterceptor;
	private desktopFileActions!: DesktopFileActions;

	async onload(): Promise<void> {
		this.settings = parseSettings(
			await this.loadData(),
			normalizePath,
			this.app.vault.configDir,
		);
		this.desktopFileActions = new DesktopFileActions(this.app);
		this.interceptor = new OpenInterceptor(
			(file) => resolveFileOpenBehavior(file, this.settings),
			(file) => this.desktopFileActions.openInDefaultApp(file),
			(error) =>
				new Notice(
					`Couldn't open the file using the default application: ${error}`,
				),
		);

		this.registerView(
			VIEW_TYPE_PLACEHOLDER,
			(leaf) => new BinaryPlaceholderView(leaf, this),
		);
		this.register(this.interceptor.install());
		this.register(new RenameCommandInterceptor(this.app).install());
		this.addSettingTab(new LazyFileViewSettingTab(this.app, this));

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (!(file instanceof TFile)) return;
				this.app.workspace.iterateAllLeaves((leaf) => {
					if (leaf.view instanceof BinaryPlaceholderView) {
						leaf.view.handleDeleted(file.path);
					}
				});
			}),
		);
	}

	async saveSettings(): Promise<void> {
		this.settings = parseSettings(
			this.settings,
			normalizePath,
			this.app.vault.configDir,
		);
		await this.saveData(this.settings);
	}

	async openNatively(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
		try {
			await this.interceptor.openNatively(leaf, file);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Couldn't load the file in Obsidian: ${message}`);
		}
	}

	async openInDefaultApp(file: TFile): Promise<void> {
		const error = await this.desktopFileActions.openInDefaultApp(file);
		if (error) {
			new Notice(`Couldn't open the file using the default application: ${error}`);
		}
	}

	revealInSystemExplorer(file: TFile): void {
		const error = this.desktopFileActions.revealInSystemExplorer(file);
		if (error) new Notice(`Couldn't reveal the file: ${error}`);
	}
}

import {
	normalizePath,
	Notice,
	Plugin,
	TFile,
	type WorkspaceLeaf,
} from 'obsidian';
import { BinaryPlaceholderView } from './BinaryPlaceholderView';
import { VIEW_TYPE_PLACEHOLDER } from './constants';
import { shouldInterceptFile } from './file-utils';
import { OpenInterceptor } from './open-interceptor';
import { RenameCommandInterceptor } from './rename-command-interceptor';
import { LazyFileViewSettingTab } from './settings';
import { parseSettings } from './settings-model';
import type { LazyFileViewSettings } from './types';

export default class LazyFileViewPlugin extends Plugin {
	settings!: LazyFileViewSettings;
	private interceptor!: OpenInterceptor;

	async onload(): Promise<void> {
		this.settings = parseSettings(
			await this.loadData(),
			normalizePath,
			this.app.vault.configDir,
		);
		this.interceptor = new OpenInterceptor((file) =>
			shouldInterceptFile(file, this.settings),
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
}

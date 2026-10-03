import {
	normalizePath,
	PluginSettingTab,
	type App,
	type SettingDefinitionItem,
} from 'obsidian';
import {
	normalizeExtensions,
	normalizeFolders,
	splitSettingLines,
} from './settings-model';
import type LazyFileViewPlugin from './main';
import type { InterceptionMode } from './types';

type SettingsKey =
	| 'mode'
	| 'folders'
	| 'extensions'
	| 'protectedFolders'
	| 'protectedExtensions';

export class LazyFileViewSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: LazyFileViewPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingsKey>[] {
		return [
			{
				name: 'Interception mode',
				desc: 'Choose which directly opened files use the lightweight placeholder.',
				control: {
					type: 'dropdown',
					key: 'mode',
					options: {
						folders: 'Files inside configured folders',
						extensions: 'Configured extensions',
						either: 'Either condition',
					},
				},
			},
			{
				name: 'Folders',
				desc: 'One vault-relative folder per line. Subfolders are included. Use / to include the vault root.',
				control: {
					type: 'textarea',
					key: 'folders',
					placeholder: 'documents\nattachments',
					rows: 5,
				},
			},
			{
				name: 'Extensions',
				desc: 'One extension per line, without a leading dot. Use * for every extension. Protected rules below take precedence.',
				control: {
					type: 'textarea',
					key: 'extensions',
					placeholder: 'pdf\npng\ndocx',
					rows: 12,
				},
			},
			{
				name: 'Protected folders',
				desc: 'Files in these vault-relative folders are never intercepted. The vault configuration folder is added here during migration. Use / to protect the entire vault.',
				control: {
					type: 'textarea',
					key: 'protectedFolders',
					placeholder: this.app.vault.configDir,
					rows: 5,
				},
			},
			{
				name: 'Protected extensions',
				desc: 'These extensions are never intercepted. Keep Obsidian native types such as md, canvas, and base protected unless you accept broken navigation. Use * to protect every extension.',
				control: {
					type: 'textarea',
					key: 'protectedExtensions',
					placeholder: 'md\ncanvas\nbase',
					rows: 5,
				},
			},
		];
	}

	getControlValue(key: string): unknown {
		switch (key) {
			case 'mode':
				return this.plugin.settings.mode;
			case 'folders':
				return this.plugin.settings.folders.join('\n');
			case 'extensions':
				return this.plugin.settings.extensions.join('\n');
			case 'protectedFolders':
				return this.plugin.settings.protectedFolders.join('\n');
			case 'protectedExtensions':
				return this.plugin.settings.protectedExtensions.join('\n');
			default:
				return undefined;
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (typeof value !== 'string') return;

		switch (key) {
			case 'mode':
				if (isMode(value)) this.plugin.settings.mode = value;
				break;
			case 'folders':
				this.plugin.settings.folders = normalizeFolders(
					splitSettingLines(value),
					normalizePath,
				);
				break;
			case 'extensions':
				this.plugin.settings.extensions = normalizeExtensions(
					splitSettingLines(value),
				);
				break;
			case 'protectedFolders':
				this.plugin.settings.protectedFolders = normalizeFolders(
					splitSettingLines(value),
					normalizePath,
				);
				break;
			case 'protectedExtensions':
				this.plugin.settings.protectedExtensions = normalizeExtensions(
					splitSettingLines(value),
				);
				break;
			default:
				return;
		}

		await this.plugin.saveSettings();
	}
}

function isMode(value: string): value is InterceptionMode {
	return value === 'folders' || value === 'extensions' || value === 'either';
}

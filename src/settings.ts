import {
	normalizePath,
	PluginSettingTab,
	type App,
	type ButtonComponent,
	type SettingDefinition,
	type SettingDefinitionItem,
} from 'obsidian';
import { isPathInFolder } from './file-utils';
import type LazyFileViewPlugin from './main';
import {
	createEmptyRule,
	normalizeExtensions,
	normalizeFilePaths,
	normalizeFolder,
	splitSettingLines,
	validateFolderPath,
} from './settings-model';
import type { FileOpenBehavior, FileOpenRule } from './types';

type RuleField =
	| 'folder'
	| 'behavior'
	| 'extensions'
	| 'files'
	| 'excludedFiles';

const BEHAVIOR_LABELS: Record<FileOpenBehavior, string> = {
	obsidian: 'Open in Obsidian',
	placeholder: 'Show dialog',
	'default-app': 'Open in the default app',
};

export class LazyFileViewSettingTab extends PluginSettingTab {
	private confirmingRemoveButton: ButtonComponent | null = null;
	private editingRuleIndex: number | null = null;
	private editorTitle: HTMLElement | null = null;

	constructor(
		app: App,
		private readonly plugin: LazyFileViewPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem<string>[] {
		this.confirmingRemoveButton = null;
		this.editorTitle = null;
		const sortedRules = this.plugin.settings.rules
			.map((rule, index) => ({ rule, index }))
			.sort(compareRuleFolders);
		const editingRule = this.editingRuleIndex === null
			? undefined
			: this.plugin.settings.rules[this.editingRuleIndex];
		if (editingRule && this.editingRuleIndex !== null) {
			return [
				{
					name: 'Back to file opening rules',
					render: (setting) => {
						setting.settingEl.addClass('lazy-file-view-settings__back');
						setting.setName(editingRule.folder || 'Choose a folder');
						this.editorTitle = setting.nameEl;
						setting.addExtraButton((button) => {
							button
								.setIcon('chevron-left')
								.setTooltip('Back to file opening rules')
								.onClick(() => {
									this.editingRuleIndex = null;
									this.update();
								});
						});
					},
				},
				{
					type: 'group',
					items: this.createRuleEditor(editingRule, this.editingRuleIndex),
				},
			];
		}
		const definitions: SettingDefinitionItem<string>[] = [
			{
				name: 'How rules are resolved',
				desc: 'Exact files have highest priority. Otherwise, the nearest folder wins, exact extensions beat *, and the first rule wins a tie. Files outside every rule folder open normally in Obsidian.',
			},
			{
				type: 'list',
				heading: 'Rules',
				cls: 'lazy-file-view-settings__rules',
				emptyState:
					'No rules are configured. Every file opens normally in Obsidian.',
				items: sortedRules.map(({ rule, index }) =>
					this.createRuleListItem(rule, index),
				),
				addItem: {
					name: 'Add file opening rule',
					action: () => {
						this.plugin.settings.rules.push(createEmptyRule());
						void this.persistAndRefresh();
					},
				},
			},
		];
		return definitions;
	}

	getControlValue(key: string): unknown {
		const parsed = parseRuleKey(key);
		if (!parsed) return undefined;
		const rule = this.plugin.settings.rules[parsed.index];
		if (!rule) return undefined;

		switch (parsed.field) {
			case 'folder':
				return rule.folder;
			case 'behavior':
				return rule.behavior;
			case 'extensions':
				return rule.extensions.join('\n');
			case 'files':
				return rule.files.join('\n');
			case 'excludedFiles':
				return rule.excludedFiles.join('\n');
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const parsed = parseRuleKey(key);
		if (!parsed || typeof value !== 'string') return;
		const rule = this.plugin.settings.rules[parsed.index];
		if (!rule) return;

		switch (parsed.field) {
			case 'folder':
				rule.folder = normalizeFolder(value, normalizePath) ?? '';
				break;
			case 'behavior':
				if (!isBehavior(value)) return;
				rule.behavior = value;
				break;
			case 'extensions':
				rule.extensions = normalizeExtensions(splitSettingLines(value));
				break;
			case 'files':
				rule.files = normalizeFilePaths(
					splitSettingLines(value),
					normalizePath,
				);
				break;
			case 'excludedFiles':
				rule.excludedFiles = normalizeFilePaths(
					splitSettingLines(value),
					normalizePath,
				);
				break;
		}

		await this.plugin.saveSettings();
		if (parsed.field === 'folder') {
			this.editorTitle?.setText(rule.folder || 'Choose a folder');
		}
	}

	private createRuleListItem(rule: FileOpenRule, index: number): SettingDefinition<string> {
		const summary = createRuleSummary(rule);
		const warnings = getRuleWarnings(rule, index, this.plugin.settings.rules);
		return {
			name: rule.folder || 'Choose a folder',
			desc: summary.fragment.textContent ?? '',
			render: (setting) => {
				setting.setName(rule.folder || 'Choose a folder');
				setting.setDesc(createRuleSummary(rule).fragment);
				const action = setting.controlEl.createSpan({
					cls: 'lazy-file-view-settings__action',
					text: BEHAVIOR_LABELS[rule.behavior],
				});
				action.setAttr('title', BEHAVIOR_LABELS[rule.behavior]);
				if (warnings.length > 0) {
					setting.nameEl.createSpan({
						cls: 'lazy-file-view-settings__rule-warning',
						text: ' ⚠',
						attr: { title: warnings.join(' ') },
					});
				}
				setting.addButton((button) => {
					button.setClass('lazy-file-view-settings__remove')
						.setIcon('trash-2').setTooltip('Remove rule')
						.onClick(() => this.requestRuleRemoval(rule, button));
				});
				setting.addButton((button) => {
					button.setIcon('pencil').setTooltip('Edit rule')
						.onClick(() => {
							this.editingRuleIndex = index;
							this.update();
						});
				});
			},
		};
	}

	private createRuleEditor(
		rule: FileOpenRule,
		index: number,
	): SettingDefinition<string>[] {
		const warnings = getRuleWarnings(
			rule,
			index,
			this.plugin.settings.rules,
		);
		const items: SettingDefinition<string>[] = [];
		if (warnings.length > 0) {
			items.push({
				name: 'Rule needs attention',
				desc: warnings.join(' '),
				render: (setting) => {
					setting.setName('Rule needs attention');
					setting.setDesc(warnings.join(' '));
					setting.settingEl.addClass('lazy-file-view-settings__warning');
				},
			});
		}
		items.push(
			{
				name: 'Folder',
				desc: 'Vault-relative folder. Subfolders are included; use / for the vault root.',
				control: {
					type: 'folder',
					key: ruleKey(index, 'folder'),
					defaultValue: rule.folder,
					placeholder: 'Documents',
					includeRoot: true,
					validate: validateFolderPath,
				},
			},
			{
				name: 'Action',
				desc: 'What happens when this rule wins.',
				control: {
					type: 'dropdown',
					key: ruleKey(index, 'behavior'),
					defaultValue: rule.behavior,
					options: BEHAVIOR_LABELS,
				},
			},
			{
				name: 'Extensions',
				desc: 'One extension per line, without a leading dot. Use * for every file, including extensionless files.',
				control: {
					type: 'textarea',
					key: ruleKey(index, 'extensions'),
					defaultValue: rule.extensions.join('\n'),
					placeholder: 'pdf\ndocx',
					rows: 5,
				},
			},
			{
				name: 'Exact files',
				desc: 'Optional vault-relative files. These match independently of the extension list and outrank extension rules in child folders. Use * for every file.',
				control: {
					type: 'textarea',
					key: ruleKey(index, 'files'),
					defaultValue: rule.files.join('\n'),
					placeholder: 'Documents/Quarterly report.pdf',
					rows: 5,
				},
			},
			{
				name: 'Files excluded from this rule',
				desc: 'Optional vault-relative files that cannot match this rule. Other rules at this folder and parent folders remain eligible.',
				control: {
					type: 'textarea',
					key: ruleKey(index, 'excludedFiles'),
					defaultValue: rule.excludedFiles.join('\n'),
					placeholder: 'Documents/Keep in Obsidian.pdf',
					rows: 5,
				},
			},
		);

		return items;
	}

	private requestRuleRemoval(
		rule: FileOpenRule,
		button: ButtonComponent,
	): void {
		if (this.confirmingRemoveButton !== button) {
			this.resetRemoveConfirmation();
			button
				.setDestructive()
				.setIcon('trash-2')
				.setButtonText('Click again to remove')
				.setTooltip('Click again to remove');
			button.buttonEl.addClass('is-confirming');
			this.confirmingRemoveButton = button;
			return;
		}

		const index = this.plugin.settings.rules.indexOf(rule);
		if (index === -1) return;
		button.setDisabled(true);
		this.confirmingRemoveButton = null;
		this.plugin.settings.rules.splice(index, 1);
		void this.persistAndRefresh();
	}

	private resetRemoveConfirmation(): void {
		this.confirmingRemoveButton?.buttonEl.removeClass('is-confirming');
		this.confirmingRemoveButton
			?.removeDestructive()
			.setButtonText('')
			.setIcon('trash-2')
			.setTooltip('Remove rule');
		this.confirmingRemoveButton = null;
	}

	private async persistAndRefresh(): Promise<void> {
		await this.plugin.saveSettings();
		this.update();
	}
}

function getRuleWarnings(
	rule: FileOpenRule,
	index: number,
	rules: FileOpenRule[],
): string[] {
	const warnings: string[] = [];
	const folderError = validateFolderPath(rule.folder);
	if (folderError) warnings.push(folderError);
	if (rule.extensions.length === 0 && rule.files.length === 0) {
		warnings.push('Add an extension, *, or an exact file.');
	}

	const includedAndExcluded = rule.files.filter((file) =>
		rule.excludedFiles.includes(file),
	);
	if (includedAndExcluded.length > 0) {
		warnings.push(
			`${formatCount(includedAndExcluded.length, 'file')} listed as both exact and excluded; exclusion wins.`,
		);
	}

	const outsideFiles = [...rule.files, ...rule.excludedFiles].filter(
		(file) => file !== '*' && rule.folder && !isPathInFolder(file, rule.folder),
	);
	if (outsideFiles.length > 0) {
		warnings.push(
			`${formatCount(new Set(outsideFiles).size, 'file')} outside this folder and inactive.`,
		);
	}

	const earlierRules = rules.slice(0, index).filter(
		(other) => other.folder === rule.folder,
	);
	const overlappingExtensions = rule.extensions.filter((extension) =>
		earlierRules.some((other) => other.extensions.includes(extension)),
	);
	const overlappingFiles = rule.files.filter((file) =>
		earlierRules.some((other) => other.files.includes(file)),
	);
	if (overlappingExtensions.length > 0 || overlappingFiles.length > 0) {
		warnings.push('An earlier rule wins one or more equal-priority matches.');
	}

	return warnings;
}

function createRuleSummary(rule: FileOpenRule): {
	fragment: DocumentFragment;
	element: HTMLElement;
	content: HTMLElement;
} {
	const fragment = createFragment();
	const summary = fragment.createDiv({ cls: 'lazy-file-view-settings__summary' });
	const content = summary.createDiv({
		cls: 'lazy-file-view-settings__summary-content',
	});
	renderRuleSummary(content, rule);
	return { fragment, element: summary, content };
}

function renderRuleSummary(summary: HTMLElement, rule: FileOpenRule): void {
	summary.empty();
	const matchesAllFiles =
		rule.extensions.includes('*') || rule.files.includes('*');
	const details = [
		!matchesAllFiles && rule.files.length > 0
			? formatCount(rule.files.length, 'exact file')
			: null,
		rule.excludedFiles.length > 0
			? formatCount(rule.excludedFiles.length, 'exclusion')
			: null,
	].filter((value): value is string => value !== null);
	let visibleLines = 0;

	if (matchesAllFiles) {
		summary.createDiv({
			cls: 'lazy-file-view-settings__summary-extensions',
			text: 'All files',
		});
		visibleLines += 1;
	} else if (rule.extensions.length > 0) {
		summary.createDiv({
			cls: 'lazy-file-view-settings__summary-extensions',
			text: rule.extensions.join(', '),
		});
		visibleLines += 1;
	}
	if (details.length > 0) {
		summary.createDiv({
			cls: 'lazy-file-view-settings__summary-details',
			text: details.join('; '),
		});
		visibleLines += 1;
	}
	if (visibleLines === 0) {
		summary.createDiv({
			cls: 'lazy-file-view-settings__summary-details',
			text: 'No matchers',
		});
		visibleLines = 1;
	}
	while (visibleLines < 2) {
		summary.createDiv({
			cls: 'lazy-file-view-settings__summary-spacer',
			text: '\u00a0',
		});
		visibleLines += 1;
	}
}

function compareRuleFolders(
	left: { rule: FileOpenRule; index: number },
	right: { rule: FileOpenRule; index: number },
): number {
	const leftFolder = left.rule.folder.trim();
	const rightFolder = right.rule.folder.trim();
	if (!leftFolder && rightFolder) return 1;
	if (leftFolder && !rightFolder) return -1;
	return (
		leftFolder.localeCompare(rightFolder, undefined, {
			sensitivity: 'base',
			numeric: true,
		}) || left.index - right.index
	);
}

function formatCount(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function ruleKey(index: number, field: RuleField): string {
	return `rule:${index}:${field}`;
}

function parseRuleKey(
	key: string,
): { index: number; field: RuleField } | null {
	const match = /^rule:(\d+):(folder|behavior|extensions|files|excludedFiles)$/u.exec(
		key,
	);
	if (!match) return null;
	const index = Number(match[1]);
	const field = match[2] as RuleField;
	return { index, field };
}

function isBehavior(value: string): value is FileOpenBehavior {
	return value === 'obsidian' || value === 'placeholder' || value === 'default-app';
}

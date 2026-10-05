import type {
	FileOpenBehavior,
	FileOpenRule,
	InterceptableFile,
	LazyFileViewSettings,
} from './types';
import { validateFolderPath } from './settings-model';

export function resolveFileOpenBehavior(
	file: InterceptableFile,
	settings: LazyFileViewSettings,
): FileOpenBehavior {
	const path = normalizeComparablePath(file.path);
	const extension = file.extension.toLowerCase();
	const scopedRules = settings.rules
		.map((rule, index) => ({ rule, index }))
		.filter(
			({ rule }) =>
				!validateFolderPath(rule.folder) && isPathInFolder(path, rule.folder),
		);
	if (scopedRules.length === 0) return 'obsidian';

	const eligibleRules = scopedRules.filter(
		({ rule }) => !rule.excludedFiles.includes(path),
	);
	const exactFileRule = eligibleRules
		.filter(
			({ rule }) => rule.files.includes('*') || rule.files.includes(path),
		)
		.sort(compareRulePriority)[0];
	if (exactFileRule) return exactFileRule.rule.behavior;

	const folders = uniqueFoldersByDepth(eligibleRules.map(({ rule }) => rule));
	for (const folder of folders) {
		const rulesAtFolder = eligibleRules.filter(
			({ rule }) => rule.folder === folder,
		);
		const exactExtensionRule = rulesAtFolder.find(({ rule }) =>
			rule.extensions.includes(extension),
		);
		if (exactExtensionRule) return exactExtensionRule.rule.behavior;

		const wildcardRule = rulesAtFolder.find(({ rule }) =>
			rule.extensions.includes('*'),
		);
		if (wildcardRule) return wildcardRule.rule.behavior;
	}

	return 'obsidian';
}

export function isPathInFolder(path: string, folder: string): boolean {
	if (/^\/+$/u.test(folder)) {
		return path.length > 0;
	}
	const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');
	return normalizedFolder.length > 0 && path.startsWith(`${normalizedFolder}/`);
}

function compareRulePriority(
	left: { rule: FileOpenRule; index: number },
	right: { rule: FileOpenRule; index: number },
): number {
	return folderDepth(right.rule.folder) - folderDepth(left.rule.folder) ||
		left.index - right.index;
}

function uniqueFoldersByDepth(rules: FileOpenRule[]): string[] {
	return [...new Set(rules.map((rule) => rule.folder))].sort(
		(left, right) => folderDepth(right) - folderDepth(left),
	);
}

function folderDepth(folder: string): number {
	if (/^\/+$/u.test(folder)) return 0;
	return folder.split('/').filter(Boolean).length;
}

function normalizeComparablePath(path: string): string {
	return path.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
}

export function formatFileSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) {
		return 'Unknown size';
	}
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	const units = ['KB', 'MB', 'GB', 'TB'] as const;
	let value = bytes / 1024;
	let unit: string = units[0];
	for (let index = 1; index < units.length && value >= 1024; index += 1) {
		value /= 1024;
		unit = units[index] ?? unit;
	}
	return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
}

export function describeFileType(extension: string): string {
	const normalized = extension.toLowerCase();
	if (normalized === 'pdf') return 'PDF document';
	if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'svg'].includes(normalized)) {
		return `${normalized.toUpperCase()} image`;
	}
	if (['mp3', 'wav', 'flac', 'm4a', 'ogg'].includes(normalized)) {
		return `${normalized.toUpperCase()} audio`;
	}
	if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(normalized)) {
		return `${normalized.toUpperCase()} video`;
	}
	if (['doc', 'docx', 'odt', 'rtf'].includes(normalized)) return 'Document';
	if (['xls', 'xlsx', 'ods', 'csv'].includes(normalized)) return 'Spreadsheet';
	if (['ppt', 'pptx', 'odp'].includes(normalized)) return 'Presentation';
	if (['zip', '7z', 'rar'].includes(normalized)) return 'Archive';
	return normalized.length > 0 ? `${normalized.toUpperCase()} file` : 'File';
}

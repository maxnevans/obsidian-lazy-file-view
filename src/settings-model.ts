import { DEFAULT_PROTECTED_EXTENSIONS } from './constants';
import type {
	FileOpenBehavior,
	FileOpenRule,
	LazyFileViewSettings,
} from './types';

export type PathNormalizer = (path: string) => string;

const INVALID_FILE_NAME_CHARACTERS = /[*"\\<>:|?]/u;

export const DEFAULT_SETTINGS: Readonly<LazyFileViewSettings> = {
	rules: ['Documents', 'Attachments'].flatMap((folder) => [
		{
			folder,
			behavior: 'obsidian' as const,
			extensions: [...DEFAULT_PROTECTED_EXTENSIONS],
			files: [],
			excludedFiles: [],
		},
		{
			folder,
			behavior: 'placeholder' as const,
			extensions: ['*'],
			files: [],
			excludedFiles: [],
		},
	]),
};

const BEHAVIORS = new Set<FileOpenBehavior>([
	'obsidian',
	'placeholder',
	'default-app',
]);

export function normalizeFolder(
	value: string,
	normalizePath: PathNormalizer,
): string | null {
	const slashNormalized = value.trim().replaceAll('\\', '/');
	if (/^\/+$/u.test(slashNormalized)) {
		return '/';
	}

	const trimmed = slashNormalized.replace(/^\/+|\/+$/g, '');
	if (trimmed.length === 0 || trimmed === '.') {
		return null;
	}

	const normalized = normalizePath(trimmed).replace(/^\/+|\/+$/g, '');
	return normalized.length > 0 && normalized !== '.' ? normalized : null;
}

export function validateFolderPath(value: string): string | void {
	const trimmed = value.trim();
	if (trimmed.length === 0) return 'Choose a folder before this rule can run.';
	if (/^\/+$/u.test(trimmed)) return;
	if (INVALID_FILE_NAME_CHARACTERS.test(trimmed)) {
		return 'File name cannot contain any of these characters: * " \\ / < > : | ?';
	}

	const segments = trimmed.replace(/^\/+|\/+$/g, '').split('/');
	if (segments.some((segment) => segment.length === 0)) {
		return 'Folder path cannot contain empty segments.';
	}
	if (segments.some((segment) => segment.startsWith('.'))) {
		return 'File name must not start with a dot.';
	}
}

export function normalizeFolders(
	values: readonly string[],
	normalizePath: PathNormalizer,
): string[] {
	return unique(
		values
			.map((value) => normalizeFolder(value, normalizePath))
			.filter((value): value is string => value !== null),
	);
}

export function normalizeExtension(value: string): string | null {
	const normalized = value.trim().toLowerCase().replace(/^\.+/, '');
	return normalized.length > 0 ? normalized : null;
}

export function normalizeExtensions(values: readonly string[]): string[] {
	return unique(
		values
			.map(normalizeExtension)
			.filter((value): value is string => value !== null),
	);
}

export function normalizeFilePath(
	value: string,
	normalizePath: PathNormalizer,
): string | null {
	const slashNormalized = value.trim().replaceAll('\\', '/');
	const trimmed = slashNormalized.replace(/^\/+|\/+$/g, '');
	if (trimmed.length === 0 || trimmed === '.') return null;

	const normalized = normalizePath(trimmed).replace(/^\/+|\/+$/g, '');
	return normalized.length > 0 && normalized !== '.' ? normalized : null;
}

export function normalizeFilePaths(
	values: readonly string[],
	normalizePath: PathNormalizer,
): string[] {
	return unique(
		values
			.map((value) => normalizeFilePath(value, normalizePath))
			.filter((value): value is string => value !== null),
	);
}

export function parseSettings(
	data: unknown,
	normalizePath: PathNormalizer,
	_configDir: string,
): LazyFileViewSettings {
	const record = isRecord(data) ? data : {};
	if (!Array.isArray(record.rules)) return cloneDefaultSettings();

	return {
		rules: record.rules
			.filter(isRecord)
			.map((rule) => normalizeRule(rule, normalizePath)),
	};
}

export function createEmptyRule(): FileOpenRule {
	return {
		folder: '',
		behavior: 'placeholder',
		extensions: ['*'],
		files: [],
		excludedFiles: [],
	};
}

export function splitSettingLines(value: string): string[] {
	return value.split(/\r?\n/);
}

function unique(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function normalizeRule(
	rule: Record<string, unknown>,
	normalizePath: PathNormalizer,
): FileOpenRule {
	const rawFolder = isString(rule.folder) ? rule.folder.trim() : '';
	const folder = validateFolderPath(rawFolder)
		? rawFolder
		: (normalizeFolder(rawFolder, normalizePath) ?? '');
	return {
		folder,
		behavior: isBehavior(rule.behavior) ? rule.behavior : 'obsidian',
		extensions: normalizeStringArray(rule.extensions, normalizeExtensions),
		files: normalizeStringArray(rule.files, (values) =>
			normalizeFilePaths(values, normalizePath),
		),
		excludedFiles: normalizeStringArray(rule.excludedFiles, (values) =>
			normalizeFilePaths(values, normalizePath),
		),
	};
}

function normalizeStringArray(
	value: unknown,
	normalize: (values: string[]) => string[],
): string[] {
	return Array.isArray(value) ? normalize(value.filter(isString)) : [];
}

function cloneDefaultSettings(): LazyFileViewSettings {
	return {
		rules: DEFAULT_SETTINGS.rules.map((rule) => ({
			...rule,
			extensions: [...rule.extensions],
			files: [...rule.files],
			excludedFiles: [...rule.excludedFiles],
		})),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isBehavior(value: unknown): value is FileOpenBehavior {
	return (
		typeof value === 'string' && BEHAVIORS.has(value as FileOpenBehavior)
	);
}

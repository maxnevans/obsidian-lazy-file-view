import {
	DEFAULT_EXTENSION_LIST,
	DEFAULT_PROTECTED_EXTENSIONS,
} from './constants';
import type { InterceptionMode, LazyFileViewSettings } from './types';

export type PathNormalizer = (path: string) => string;

export const DEFAULT_SETTINGS: Readonly<LazyFileViewSettings> = {
	mode: 'folders',
	folders: ['Documents', 'Attachments'],
	extensions: [...DEFAULT_EXTENSION_LIST],
	protectedFolders: [],
	protectedExtensions: [...DEFAULT_PROTECTED_EXTENSIONS],
};

const MODES = new Set<InterceptionMode>(['folders', 'extensions', 'either']);

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

export function parseSettings(
	data: unknown,
	normalizePath: PathNormalizer,
	configDir: string,
): LazyFileViewSettings {
	const record = isRecord(data) ? data : {};
	const mode = isMode(record.mode) ? record.mode : DEFAULT_SETTINGS.mode;
	const folders = Array.isArray(record.folders)
		? normalizeFolders(record.folders.filter(isString), normalizePath)
		: [...DEFAULT_SETTINGS.folders];
	const extensions = Array.isArray(record.extensions)
		? normalizeExtensions(record.extensions.filter(isString))
		: [...DEFAULT_SETTINGS.extensions];
	const protectedFolders = Array.isArray(record.protectedFolders)
		? normalizeFolders(record.protectedFolders.filter(isString), normalizePath)
		: normalizeFolders([configDir], normalizePath);
	const protectedExtensions = Array.isArray(record.protectedExtensions)
		? normalizeExtensions(record.protectedExtensions.filter(isString))
		: [...DEFAULT_SETTINGS.protectedExtensions];

	return {
		mode,
		folders,
		extensions,
		protectedFolders,
		protectedExtensions,
	};
}

export function splitSettingLines(value: string): string[] {
	return value.split(/\r?\n/);
}

function unique(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isMode(value: unknown): value is InterceptionMode {
	return typeof value === 'string' && MODES.has(value as InterceptionMode);
}

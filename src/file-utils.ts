import type { InterceptableFile, LazyFileViewSettings } from './types';

export function shouldInterceptFile(
	file: InterceptableFile,
	settings: LazyFileViewSettings,
): boolean {
	const extension = file.extension.toLowerCase();
	const isProtectedExtension =
		extension.length > 0 &&
		(settings.protectedExtensions.includes('*') ||
			settings.protectedExtensions.includes(extension));
	const isProtectedFolder = settings.protectedFolders.some((folder) =>
		isPathInFolder(file.path, folder),
	);
	if (isProtectedExtension || isProtectedFolder) {
		return false;
	}

	const matchesFolder = settings.folders.some((folder) =>
		isPathInFolder(file.path, folder),
	);
	const matchesExtension =
		extension.length > 0 &&
		(settings.extensions.includes('*') || settings.extensions.includes(extension));

	switch (settings.mode) {
		case 'folders':
			return matchesFolder;
		case 'extensions':
			return matchesExtension;
		case 'either':
			return matchesFolder || matchesExtension;
	}
}

export function isPathInFolder(path: string, folder: string): boolean {
	if (/^\/+$/u.test(folder)) {
		return path.length > 0;
	}
	const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');
	return normalizedFolder.length > 0 && path.startsWith(`${normalizedFolder}/`);
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

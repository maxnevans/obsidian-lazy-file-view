export function renamedFilePath(currentPath: string, newName: string): string {
	const separatorIndex = currentPath.lastIndexOf('/');
	return `${currentPath.slice(0, separatorIndex + 1)}${newName}`;
}

export function filenameSelectionEnd(filename: string, extension: string): number {
	if (!extension) return filename.length;
	return Math.max(0, filename.length - extension.length - 1);
}

export function renameFilenameError(filename: string): string | null {
	return filename.startsWith('.') ? 'File name must not start with a dot.' : null;
}

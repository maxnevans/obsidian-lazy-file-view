export type FileOpenBehavior = 'obsidian' | 'placeholder' | 'default-app';

export interface FileOpenRule {
	folder: string;
	behavior: FileOpenBehavior;
	extensions: string[];
	files: string[];
	excludedFiles: string[];
}

export interface LazyFileViewSettings {
	rules: FileOpenRule[];
}

export interface PlaceholderViewState extends Record<string, unknown> {
	file: string;
}

export interface InterceptableFile {
	path: string;
	extension: string;
}

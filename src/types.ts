export type InterceptionMode = 'folders' | 'extensions' | 'either';

export interface LazyFileViewSettings {
	mode: InterceptionMode;
	folders: string[];
	extensions: string[];
}

export interface PlaceholderViewState extends Record<string, unknown> {
	file: string;
}

export interface InterceptableFile {
	path: string;
	extension: string;
}

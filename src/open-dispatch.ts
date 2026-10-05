import type { FileOpenBehavior } from './types';

export type OpenDispatchResult =
	| { target: 'obsidian' }
	| { target: 'placeholder'; defaultAppError?: string }
	| { target: 'default-app' };

export async function dispatchOpenBehavior(
	behavior: FileOpenBehavior,
	openInDefaultApp: () => Promise<string | null>,
): Promise<OpenDispatchResult> {
	if (behavior === 'obsidian') return { target: 'obsidian' };
	if (behavior === 'placeholder') return { target: 'placeholder' };

	const error = await openInDefaultApp();
	return error
		? { target: 'placeholder', defaultAppError: error }
		: { target: 'default-app' };
}

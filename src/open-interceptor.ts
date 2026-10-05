import { around } from 'monkey-around';
import {
	normalizePath,
	WorkspaceLeaf,
	type OpenViewState,
	type TFile,
	type ViewState,
} from 'obsidian';
import { VIEW_TYPE_PLACEHOLDER } from './constants';
import { dispatchOpenBehavior } from './open-dispatch';
import { OneShotBypass } from './one-shot-bypass';
import type { FileOpenBehavior } from './types';

/**
 * There is no cancellable public hook for a standalone file open. This wrapper
 * is deliberately limited to WorkspaceLeaf.openFile and must remain isolated
 * here so it can be removed cleanly if Obsidian changes its navigation API.
 */
export class OpenInterceptor {
	private readonly bypass = new OneShotBypass<WorkspaceLeaf>();

	constructor(
		private readonly resolveBehavior: (file: TFile) => FileOpenBehavior,
		private readonly openInDefaultApp: (file: TFile) => Promise<string | null>,
		private readonly reportDefaultAppError: (error: string) => void,
	) {}

	install(): () => void {
		const bypass = this.bypass;
		const resolveBehavior = this.resolveBehavior;
		const openInDefaultApp = this.openInDefaultApp;
		const reportDefaultAppError = this.reportDefaultAppError;

		return around(WorkspaceLeaf.prototype, {
			openFile(next) {
				return async function (
					this: WorkspaceLeaf,
					file: TFile,
					openState?: OpenViewState,
				): Promise<void> {
					const normalizedPath = normalizePath(file.path);
					if (bypass.consume(this, normalizedPath)) {
						return next.call(this, file, openState);
					}

					const dispatch = await dispatchOpenBehavior(
						resolveBehavior(file),
						() => openInDefaultApp(file),
					);
					if (dispatch.target === 'obsidian') {
						return next.call(this, file, openState);
					}
					if (dispatch.target === 'default-app') return;
					if (dispatch.defaultAppError) {
						reportDefaultAppError(dispatch.defaultAppError);
					}

					const viewState: ViewState = {
						type: VIEW_TYPE_PLACEHOLDER,
						state: {
							...openState?.state,
							file: file.path,
						},
						active: openState?.active,
						group: openState?.group,
					};

					await this.setViewState(viewState, openState?.eState);
				};
			},
		});
	}

	async openNatively(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
		const normalizedPath = normalizePath(file.path);
		this.bypass.arm(leaf, normalizedPath);
		try {
			await leaf.openFile(file, { active: true });
		} finally {
			this.bypass.clear(leaf, normalizedPath);
		}
	}
}

import { around } from 'monkey-around';
import type { App, Command } from 'obsidian';
import { BinaryPlaceholderView } from './BinaryPlaceholderView';

const RENAME_FILE_COMMAND_ID = 'workspace:edit-file-title';

interface CommandRegistry {
	commands: Record<string, Command | undefined>;
}

type AppWithCommands = App & { commands: CommandRegistry };

/**
 * Obsidian's Rename file command is unavailable for custom FileView instances.
 * Extend that command's existing availability check so all hotkeys assigned to
 * it, as well as command-palette invocation, use this view's inline editor.
 */
export class RenameCommandInterceptor {
	constructor(private readonly app: App) {}

	install(): () => void {
		const command = (this.app as AppWithCommands).commands.commands[
			RENAME_FILE_COMMAND_ID
		];
		if (!command?.checkCallback) return () => undefined;

		const app = this.app;
		return around(command, {
			checkCallback(next) {
				if (!next) return undefined;
				return function (this: Command, checking: boolean): boolean | void {
					const view = app.workspace.getActiveViewOfType(BinaryPlaceholderView);
					if (view) {
						if (!checking) view.beginRename();
						return true;
					}
					return next.call(this, checking);
				};
			},
		});
	}
}

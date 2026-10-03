# Lazy File View

Lazy File View is a desktop-only Obsidian plugin that replaces selected direct file opens with a lightweight placeholder. Markdown embeds continue to use Obsidian's normal renderers.

The placeholder shows file metadata without reading the file and provides actions to:

- open the file in its default desktop application;
- reveal it in the system file manager;
- load it through Obsidian's normal file-opening path.

## Compatibility note

Obsidian currently has no documented, cancellable event for standalone file opens. The plugin therefore wraps the public `WorkspaceLeaf.openFile()` method. The wrapper is isolated, cooperates with other wrappers through `monkey-around`, and is removed when the plugin unloads. A future Obsidian update could require this integration to change.

Navigation paths that bypass `WorkspaceLeaf.openFile()` are not intercepted. The `file-open` event and `registerExtensions()` are intentionally not used because they cannot provide the required folder-sensitive distinction between a standalone view and an embed.

## Development

```sh
npm install
npm test
npm run lint
npm run build
npm run test-vault
```

Open `.test-vault` as an Obsidian vault, enable community plugins, and enable Lazy File View. Never use a personal vault for development testing.

## Feasibility gate

Before relying on the plugin, verify on the target Obsidian version:

1. Opening `Documents/small.pdf` from File Explorer, Quick Switcher, and the normal link in `Test.md` shows the placeholder.
2. The embedded PDF in `Test.md` uses Obsidian's native PDF renderer.
3. Embedded image, audio, and video files remain native.
4. Disabling the plugin restores ordinary direct opens.

The generated Office fixtures are valid lightweight documents. Replace the files named `large.*` with representative large files before performance testing.

If `ffmpeg` is not on `PATH`, set `FFMPEG_PATH` to its executable before running `npm run test-vault`; otherwise the generator omits the video fixture instead of creating an invalid placeholder.

## Scope

The plugin does not read, parse, hash, index, upload, preview, or move file contents. It provides no mobile support and performs no networking.

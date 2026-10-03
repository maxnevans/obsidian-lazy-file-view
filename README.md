# Lazy File View

Lazy File View is a desktop-only Obsidian plugin that replaces selected direct file opens with a lightweight placeholder. Markdown embeds continue to use Obsidian's normal renderers.

The placeholder shows file metadata without reading the file and provides actions to:

- open the file in its default desktop application;
- reveal it in the system file manager;
- load it through Obsidian's normal file-opening path.

In settings, use `/` as a folder entry to include the vault root, or `*` as an extension entry to include every extension. Protected folders and protected extensions are separate, visible lists that always take precedence over interception rules. Existing installations are migrated with the vault's current configuration folder plus `md`, `canvas`, and `base` protected by default. You can edit these lists as Obsidian evolves without updating the plugin.

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

## Deploy to an existing vault

Build the plugin in WSL, then copy its three runtime files into the vault. Replace the example vault path with the path to your vault:

```sh
cd /mnt/d/Source/obsidian-lazy-file-view
source "$HOME/.nvm/nvm.sh"
npm run build

VAULT="/mnt/c/path/to/your/vault"
PLUGIN="$VAULT/.obsidian/plugins/lazy-file-view"

mkdir -p "$PLUGIN"
cp main.js manifest.json styles.css "$PLUGIN/"
```

If the vault uses a configuration directory other than `.obsidian`, replace `.obsidian` in `PLUGIN` with that directory name.

In Obsidian, open **Settings → Community plugins** and enable **Lazy File View**. If it was already enabled, disable and re-enable it to load the new build.

Plugin settings are stored in:

```text
<Vault>/.obsidian/plugins/lazy-file-view/data.json
```

For normal updates, copy only `main.js`, `manifest.json`, and `styles.css`. Do not delete or overwrite `data.json`; this preserves the configured folders, extensions, and protected rules. A new installation does not need a `data.json` file. Obsidian creates it after settings are saved through **Settings → Lazy File View**.

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

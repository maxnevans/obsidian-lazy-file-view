import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const pluginDir = resolve(
	projectRoot,
	'.test-vault',
	'.obsidian',
	'plugins',
	'lazy-file-view',
);

await mkdir(pluginDir, { recursive: true });
await Promise.all(
	['main.js', 'manifest.json', 'styles.css'].map((file) =>
		copyFile(resolve(projectRoot, file), resolve(pluginDir, file)),
	),
);

console.log(`Deployed Lazy File View to ${pluginDir}`);

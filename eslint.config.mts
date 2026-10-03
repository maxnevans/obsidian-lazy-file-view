import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'.test-vault',
		'main.js',
		'esbuild.config.mjs',
		'scripts',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'versions.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['tests/**/*.ts'],
		rules: {
			'obsidianmd/hardcoded-config-path': 'off',
		},
	},
);

import tsParser from '@typescript-eslint/parser';
import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';

export default [
	{ ignores: ['dist/**', 'scripts/**', 'index.js', 'examples/**'] },
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: { project: './tsconfig.json', sourceType: 'module' },
		},
	},
	n8nCommunityNodesPlugin.configs.recommended,
];

import nx from '@nx/eslint-plugin';
import { maxLinesBaseline } from './tools/eslint/max-lines-baseline.mjs';
import {
    MAX_LINES_OPTIONS,
    MAX_LINES_PROD,
    MAX_LINES_TEST,
    TEST_FILE_GLOBS,
} from './tools/eslint/max-lines-config.mjs';

const legacyBareAliases = [
    'components',
    'm3u-state',
    'm3u-utils',
    'services',
    'shared-interfaces',
    'shared-portals',
    'remote-control',
    'database',
    'database-schema',
    'database-path-utils',
    'workspace-dashboard-feature',
    'workspace-dashboard-data-access',
];

export default [
    ...nx.configs['flat/base'],
    ...nx.configs['flat/typescript'],
    ...nx.configs['flat/javascript'],
    {
        ignores: ['**/dist', '**/.pnpm-cli'],
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        rules: {
            '@nx/enforce-module-boundaries': [
                'error',
                {
                    enforceBuildableLibDependency: true,
                    allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
                    depConstraints: [
                        {
                            sourceTag: 'type:app',
                            onlyDependOnLibsWithTags: [
                                'type:data-access',
                                'type:util',
                            ],
                        },
                        {
                            sourceTag: 'type:data-access',
                            onlyDependOnLibsWithTags: [
                                'type:data-access',
                                'type:util',
                            ],
                        },
                        {
                            sourceTag: 'type:util',
                            onlyDependOnLibsWithTags: ['type:util'],
                        },
                        {
                            sourceTag: 'domain:web',
                            onlyDependOnLibsWithTags: [
                                'domain:shared-contracts',
                                'domain:m3u',
                                'scope:shared',
                            ],
                        },
                        {
                            sourceTag: 'domain:electron-main',
                            onlyDependOnLibsWithTags: [
                                'domain:m3u',
                                'domain:shared-contracts',
                                'domain:shared-runtime',
                                'scope:shared',
                            ],
                        },
                        {
                            sourceTag: 'domain:m3u',
                            onlyDependOnLibsWithTags: [
                                'domain:m3u',
                                'domain:shared-contracts',
                                'domain:shared-runtime',
                                'scope:shared',
                            ],
                        },
                        {
                            sourceTag: 'domain:shared-contracts',
                            onlyDependOnLibsWithTags: [
                                'domain:shared-contracts',
                                'scope:shared',
                            ],
                        },
                        {
                            sourceTag: 'domain:shared-runtime',
                            onlyDependOnLibsWithTags: [
                                'domain:m3u',
                                'domain:shared-contracts',
                                'domain:shared-runtime',
                                'scope:shared',
                            ],
                        },
                    ],
                },
            ],
            'no-restricted-imports': [
                'error',
                {
                    paths: legacyBareAliases.map((name) => ({
                        name,
                        message:
                            'Use the scoped @iptvnator/* path alias instead of the legacy bare alias.',
                    })),
                    patterns: legacyBareAliases.map((name) => ({
                        group: [`${name}/*`],
                        message:
                            'Use the scoped @iptvnator/* path alias instead of the legacy bare alias.',
                    })),
                },
            ],
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        ignores: TEST_FILE_GLOBS,
        rules: {
            'max-lines': [
                'error',
                { max: MAX_LINES_PROD, ...MAX_LINES_OPTIONS },
            ],
        },
    },
    {
        files: TEST_FILE_GLOBS,
        rules: {
            'max-lines': [
                'error',
                { max: MAX_LINES_TEST, ...MAX_LINES_OPTIONS },
            ],
        },
    },
    {
        files: maxLinesBaseline,
        rules: {
            'max-lines': 'off',
        },
    },
    {
        files: ['apps/electron-backend/src/app/events/player.events.ts'],
        rules: {
            'no-console': ['warn', { allow: ['debug', 'warn', 'error'] }],
        },
    },
];

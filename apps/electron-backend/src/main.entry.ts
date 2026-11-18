import './app/services/tvnest-early-init';
import { app } from 'electron';
import * as nodeModule from 'node:module';
import {
    enableStartupCompileCache,
    publishCompileCacheOutcome,
    type CompileCacheModule,
} from './app/services/compile-cache';

declare const __non_webpack_require__: NodeJS.Require;

publishCompileCacheOutcome(
    enableStartupCompileCache({
        module: nodeModule as CompileCacheModule,
        userDataPath: () => app.getPath('userData'),
    })
);

// Resolved next to this file at run time; webpack must not inline it.
__non_webpack_require__('./main.app.js');

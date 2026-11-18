/**
 * Frame pump for the frame-copy embedded MPV engine (preload isolated world).
 * Copies the newest BGRA frame from the helper's shared-memory ring once per
 * animation frame and uploads it into a WebGL2 texture on `<canvas data-embedded-mpv-frame>`.
 */
import { ipcRenderer } from 'electron';
import {
    EMBEDDED_MPV_FRAME_SOURCE_CHANGED,
    EMBEDDED_MPV_GET_FRAME_SOURCE,
    EmbeddedMpvFrameSource,
} from '@iptvnator/shared/interfaces';

interface FrameReaderInfo {
    width: number;
    height: number;
    stride: number;
    frameBytes: number;
    generation: number;
}

interface FrameCopyResult {
    seq: number;
    ageMs: number;
    torn: boolean;
}

interface FrameReaderAddon {
    open(shmName: string): FrameReaderInfo;
    latestSeq(): number;
    copyLatest(buffer: ArrayBuffer): FrameCopyResult | null;
    producerAliveMs(): number;
    close(): void;
}

declare const __non_webpack_require__: NodeRequire | undefined;
const nodeRequire: NodeRequire =
    typeof __non_webpack_require__ === 'function'
        ? __non_webpack_require__
        : require;

const CANVAS_SELECTOR = 'canvas[data-embedded-mpv-frame]';
const ATTACH_TIMEOUT_MS = 5000;
const ATTACH_POLL_MS = 100;

const VERTEX_SHADER = `#version 300 es
out vec2 v_uv;
void main() {
    vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    v_uv = corner;
    gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
in vec2 v_uv;
out vec4 o_color;
void main() {
    vec4 c = texture(u_tex, v_uv);
    o_color = vec4(c.b, c.g, c.r, 1.0);
}`;

interface GlResources {
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
    texture: WebGLTexture;
}

interface PumpState extends GlResources {
    sessionId: string;
    canvas: HTMLCanvasElement;
    reader: FrameReaderAddon;
    frame: Uint8Array;
    width: number;
    height: number;
    lastSeq: number;
    rafHandle: number;
}

let pump: PumpState | null = null;
let sourceListenerRegistered = false;
let attachEpoch = 0;

export function copyStableLatestFrame(
    reader: Pick<FrameReaderAddon, 'latestSeq' | 'copyLatest'>,
    buffer: ArrayBuffer,
    lastSeq: number
): FrameCopyResult | null {
    if (reader.latestSeq() <= lastSeq) return null;
    const result = reader.copyLatest(buffer);
    return result && !result.torn ? result : null;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCanvas(): Promise<HTMLCanvasElement | null> {
    const deadline = Date.now() + ATTACH_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const canvas =
            document.querySelector<HTMLCanvasElement>(CANVAS_SELECTOR);
        if (canvas) return canvas;
        await delay(ATTACH_POLL_MS);
    }
    return null;
}

async function waitForFrameSource(
    sessionId: string
): Promise<EmbeddedMpvFrameSource | null> {
    const deadline = Date.now() + ATTACH_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const source = (await ipcRenderer.invoke(
            EMBEDDED_MPV_GET_FRAME_SOURCE,
            sessionId
        )) as EmbeddedMpvFrameSource | null;
        if (source?.shmName) return source;
        await delay(ATTACH_POLL_MS);
    }
    return null;
}

function destroyGlResources(res: Partial<GlResources> & { gl: WebGL2RenderingContext }): void {
    const { gl, texture, vao, program } = res;
    try {
        if (texture) gl.deleteTexture(texture);
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
    } catch {
        // Ignore lost WebGL context errors on teardown.
    }
}

function createGl(canvas: HTMLCanvasElement): GlResources | null {
    const gl = canvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: false,
    });
    if (!gl) return null;

    const program = gl.createProgram();
    if (!program) return null;

    const shaders: WebGLShader[] = [];
    for (const [type, source] of [
        [gl.VERTEX_SHADER, VERTEX_SHADER],
        [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
    ] as const) {
        const shader = gl.createShader(type);
        if (!shader) {
            shaders.forEach((s) => gl.deleteShader(s));
            gl.deleteProgram(program);
            return null;
        }
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(
                '[embedded-mpv-pump] shader error:',
                gl.getShaderInfoLog(shader)
            );
            gl.deleteShader(shader);
            shaders.forEach((s) => gl.deleteShader(s));
            gl.deleteProgram(program);
            return null;
        }
        gl.attachShader(program, shader);
        shaders.push(shader);
    }

    gl.linkProgram(program);
    shaders.forEach((s) => {
        gl.detachShader(program, s);
        gl.deleteShader(s);
    });
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(
            '[embedded-mpv-pump] program link error:',
            gl.getProgramInfoLog(program)
        );
        gl.deleteProgram(program);
        return null;
    }

    gl.useProgram(program);
    const vao = gl.createVertexArray();
    const texture = gl.createTexture();
    if (!vao || !texture) {
        destroyGlResources({ gl, program, vao: vao ?? undefined, texture: texture ?? undefined });
        return null;
    }
    gl.bindVertexArray(vao);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { gl, program, vao, texture };
}

function applySource(state: PumpState, source: EmbeddedMpvFrameSource): boolean {
    try {
        const info = state.reader.open(source.shmName);
        state.width = info.width;
        state.height = info.height;
        state.frame = new Uint8Array(info.frameBytes);
        state.lastSeq = 0;
        state.canvas.width = info.width;
        state.canvas.height = info.height;
        state.gl.viewport(0, 0, info.width, info.height);
        state.gl.texImage2D(
            state.gl.TEXTURE_2D,
            0,
            state.gl.RGBA,
            info.width,
            info.height,
            0,
            state.gl.RGBA,
            state.gl.UNSIGNED_BYTE,
            null
        );
        return true;
    } catch (error) {
        console.error('[embedded-mpv-pump] failed to open frame ring:', error);
        return false;
    }
}

function pumpTick(): void {
    if (!pump) return;
    pump.rafHandle = requestAnimationFrame(pumpTick);

    const { gl, reader, frame } = pump;
    const result = copyStableLatestFrame(
        reader,
        frame.buffer as ArrayBuffer,
        pump.lastSeq
    );
    if (result) {
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            pump.width,
            pump.height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            frame
        );
        pump.lastSeq = result.seq;
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
}

function ensureSourceListener(): void {
    if (sourceListenerRegistered) return;
    sourceListenerRegistered = true;
    ipcRenderer.on(
        EMBEDDED_MPV_FRAME_SOURCE_CHANGED,
        (_event, payload: { sessionId: string; source: EmbeddedMpvFrameSource }) => {
            if (!pump || payload.sessionId !== pump.sessionId) return;
            applySource(pump, payload.source);
        }
    );
}

export async function attachEmbeddedMpvFrameView(
    sessionId: string
): Promise<boolean> {
    detachEmbeddedMpvFrameView();
    const epoch = ++attachEpoch;
    ensureSourceListener();

    const canvas = await waitForCanvas();
    if (epoch !== attachEpoch || !canvas) return false;

    const source = await waitForFrameSource(sessionId);
    if (epoch !== attachEpoch || !source) return false;

    let reader: FrameReaderAddon;
    try {
        reader = nodeRequire(source.readerPath) as FrameReaderAddon;
    } catch (error) {
        console.error('[embedded-mpv-pump] failed to load reader:', error);
        return false;
    }

    const glSetup = createGl(canvas);
    if (!glSetup) return false;

    const state: PumpState = {
        ...glSetup,
        sessionId,
        canvas,
        reader,
        frame: new Uint8Array(0),
        width: 0,
        height: 0,
        lastSeq: 0,
        rafHandle: 0,
    };
    if (!applySource(state, source)) {
        destroyGlResources(state);
        reader.close();
        return false;
    }

    pump = state;
    pump.rafHandle = requestAnimationFrame(pumpTick);
    return true;
}

export function detachEmbeddedMpvFrameView(): void {
    attachEpoch++;
    if (!pump) return;
    cancelAnimationFrame(pump.rafHandle);
    destroyGlResources(pump);
    try {
        pump.reader.close();
    } catch {
        // Reader may already be gone with the helper.
    }
    pump = null;
}

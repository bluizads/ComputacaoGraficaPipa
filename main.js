import vertShaderSrc from './pipa.vert.js';
import fragShaderSrc from './pipa.frag.js';
import WebGPU from './lib/webgpu.js';
import {
    multiplyMat4,
    createTranslationMat4,
    createRotationZMat4,
    createLookAtMat4,
    createOrthographicMat4,
} from './lib/utils.js';

const LARGURA = 1024;
const ALTURA = 768;

const METADE_ALTURA = 1.25;
const METADE_LARGURA = METADE_ALTURA * LARGURA / ALTURA;

const OMEGA_ALTURA = 1.3;
const OMEGA_ROTACAO = 1.9;
const AMPLITUDE_PIPA = 0.4;
const INCLINACAO_PIPA = 0.18;
const ACOMPANHAMENTO_CAMERA = 0.5;
const DESLOCAMENTO_CAMERA_Y = 0.25;

const JUNTA_CAUDA = [0, -0.125, 0];

class Scene {
    constructor(gpu) {
        this.programa = gpu.createProgram(vertShaderSrc, fragShaderSrc);

        this.triangle1 = gpu.createShape([
            [
                0.0, 0.0, 0.0, 1.0,
                -0.18, 0.45, 0.0, 1.0,
                0.0, 0.7, 0.0, 1.0,
            ],
            [
                1.0, 0.0, 0.0, 1.0,
                1.0, 0.0, 0.0, 1.0,
                1.0, 0.0, 0.0, 1.0,
            ],
        ], 3);

        this.triangle2 = gpu.createShape([
            [
                0.0, 0.0, 0.0, 1.0,
                0.18, 0.45, 0.0, 1.0,
                0.0, 0.7, 0.0, 1.0,
            ],
            [
                1.0, 1.0, 0.0, 1.0,
                1.0, 1.0, 0.0, 1.0,
                1.0, 1.0, 0.0, 1.0,
            ],
        ], 3);

        this.tail1 = gpu.createShape([
            [
                0.0, 0.0, 0.0, 1.0,
                -0.05, -0.0625, 0.0, 1.0,
                0.0, -0.125, 0.0, 1.0,
            ],
            [
                0.5, 0.0, 0.8, 1.0,
                0.5, 0.0, 0.8, 1.0,
                0.5, 0.0, 0.8, 1.0,
            ]
        ], 3);

        this.tail2 = gpu.createShape([
            [
                0.0, -0.125, 0.0, 1.0,
                0.05, -0.1875, 0.0, 1.0,
                0.0, -0.25, 0.0, 1.0,
            ],
            [
                0.2, 0.5, 0.9, 1.0,
                0.2, 0.5, 0.9, 1.0,
                0.2, 0.5, 0.9, 1.0,
            ]
        ], 3);

        this.uniformTriangle1 = gpu.createUniform(this.programa, new Float32Array(16));
        this.uniformTriangle2 = gpu.createUniform(this.programa, new Float32Array(16));
        this.uniformTail1 = gpu.createUniform(this.programa, new Float32Array(16));
        this.uniformTail2 = gpu.createUniform(this.programa, new Float32Array(16));

        this.projecao = createOrthographicMat4(
            -METADE_LARGURA, METADE_LARGURA, -METADE_ALTURA, METADE_ALTURA, 0.1, 10);
    }

    draw(gpu) {
        const t = performance.now() / 1000;

        const alturaPipa = AMPLITUDE_PIPA * Math.sin(OMEGA_ALTURA * t);
        const anguloPipa = INCLINACAO_PIPA * Math.sin(OMEGA_ROTACAO * t);
        const modelPipa = multiplyMat4(
            createTranslationMat4(0, alturaPipa, 0),
            createRotationZMat4(anguloPipa));

        const balanco1 = 0.12 * Math.sin(2.1 * OMEGA_ALTURA * t - 0.6) - 0.5 * anguloPipa;
        const balanco2 = 0.22 * Math.sin(1.7 * OMEGA_ALTURA * t - 2.0) - 0.5 * anguloPipa;

        const modelTail1 = multiplyMat4(modelPipa, createRotationZMat4(balanco1));

        const paraJunta = createTranslationMat4(...JUNTA_CAUDA);
        const daJunta = createTranslationMat4(-JUNTA_CAUDA[0], -JUNTA_CAUDA[1], -JUNTA_CAUDA[2]);
        const balanco2Pivotado = multiplyMat4(paraJunta, multiplyMat4(createRotationZMat4(balanco2), daJunta));
        const modelTail2 = multiplyMat4(modelTail1, balanco2Pivotado);

        const alturaCamera = ACOMPANHAMENTO_CAMERA * alturaPipa - DESLOCAMENTO_CAMERA_Y;
        const camera = createLookAtMat4([0, alturaCamera, 1], [0, alturaCamera, 0], [0, 1, 0], true);
        const visaoProjecao = multiplyMat4(this.projecao, camera);

        this.uniformTriangle1.data.set(multiplyMat4(visaoProjecao, modelPipa));
        this.uniformTriangle2.data.set(multiplyMat4(visaoProjecao, modelPipa));
        this.uniformTail1.data.set(multiplyMat4(visaoProjecao, modelTail1));
        this.uniformTail2.data.set(multiplyMat4(visaoProjecao, modelTail2));

        gpu.writeBuffer(this.uniformTriangle1.buffer, this.uniformTriangle1.data);
        gpu.writeBuffer(this.uniformTriangle2.buffer, this.uniformTriangle2.data);
        gpu.writeBuffer(this.uniformTail1.buffer, this.uniformTail1.data);
        gpu.writeBuffer(this.uniformTail2.buffer, this.uniformTail2.data);

        gpu.draw(this.programa, this.tail1, [this.uniformTail1.bindGroup]);
        gpu.draw(this.programa, this.tail2, [this.uniformTail2.bindGroup]);
        gpu.draw(this.programa, this.triangle1, [this.uniformTriangle1.bindGroup]);
        gpu.draw(this.programa, this.triangle2, [this.uniformTriangle2.bindGroup]);
    }
}

class Main {
    async init() {
        this.gpu = await WebGPU.createCanvas('#glcanvas', LARGURA, ALTURA, {
            clearColor: { r: 167 / 255, g: 199 / 255, b: 231 / 255, a: 1 }});

        this.scene = new Scene(this.gpu);
    }

    draw() {
        this.gpu.start();
        this.scene.draw(this.gpu);
        this.gpu.finish();

        requestAnimationFrame(this.draw.bind(this));
    }
}

try {
    const app = new Main();
    await app.init();
    app.draw();

} catch (error) {
    console.error(error);
    document.body.insertAdjacentHTML('beforeend', `<p>${error.message}</p>`);
}
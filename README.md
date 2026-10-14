# Pipa - Computação Gráfica

Cena 2D animada de uma pipa voando sobre um céu de cor sólida, implementada em WebGPU com shaders WGSL. O código usa como base os utilitários `lib/webgpu.js` e `lib/utils.js`, de https://github.com/mlage/curso-cg.

## Como executar

A extensão *Live Server* do VS Code precisa ser utilizada. Abra `main.html` num navegador com suporte a WebGPU (Chrome ou Edge recentes), clicando com o botão direito e selecionando 'Open with Live Server'.

## Estrutura dos arquivos

| Arquivo | Conteúdo |
|---|---|
| `main.html` / `main.css` | Página com o canvas de 1024×768 |
| `main.js` | Modelagem da cena, matrizes de transformação, câmera, projeção e laço de animação |
| `pipa.vert.js` | Shader de vértice WGSL: aplica a matriz MVP a cada vértice |
| `pipa.frag.js` | Shader de fragmento WGSL: devolve a cor interpolada do vértice |
| `lib/webgpu.js` | Wrapper do WebGPU visto em sala (pipeline, buffers, bind groups, render pass) |
| `lib/utils.js` | Funções de matrizes 4×4 em ordem *column-major* (translação, rotação, lookAt, ortográfica) |

## 1. Modelagem da cena

A cena tem **exatamente quatro triângulos**, cada um desenhado com `topology: 'triangle-list'` e 3 vértices. Não há texturas, imagens nem outras primitivas. O céu é a cor de limpeza do render pass (`clearColor` = RGB(167, 199, 231)).

Cada triângulo é um *shape* com dois **vertex buffers**: posição (`vec4f`, `@location(0)`) e cor (`vec4f`, `@location(1)`). Todos os vértices ficam no plano z = 0, em coordenadas do modelo.

### Pipa (dois triângulos de cores diferentes)

A origem do sistema do modelo é a **ponta inferior da pipa**, onde a cauda se prende.

| Triângulo | Vértices (x, y) | Cor |
|---|---|---|
| `triangle1` (metade esquerda) | (0, 0), (−0.18, 0.45), (0, 0.7) | vermelho (1, 0, 0) |
| `triangle2` (metade direita) | (0, 0), (0.18, 0.45), (0, 0.7) | amarelo (1, 1, 0) |

As duas metades compartilham a aresta central (0, 0)–(0, 0.7) e formam juntas o losango clássico de uma pipa, com 0.36 de largura e 0.7 de altura.

### Cauda (dois triângulos)

As fitas são triângulos finos, um embaixo do outro, abaixo da ponta da pipa:

| Triângulo | Vértices (x, y) | Cor |
|---|---|---|
| `tail1` | (0, 0), (−0.05, −0.0625), (0, −0.125) | roxo (0.5, 0, 0.8) |
| `tail2` | (0, −0.125), (0.05, −0.1875), (0, −0.25) | azul (0.2, 0.5, 0.9) |

A primeira fita se prende à pipa na origem. A segunda se prende à primeira no ponto `JUNTA_CAUDA = (0, −0.125)`. As pontas laterais ficam em lados opostos, o que dá à cauda um aspecto de zigue-zague.

## 2. Transformações (matrizes de modelagem)

As matrizes são 4×4, em ordem *column-major* (a mesma do WGSL), e se compõem como `M = A · B`: primeiro aplica-se `B`, depois `A`. Funções usadas de `lib/utils.js`: `createTranslationMat4`, `createRotationZMat4` e `multiplyMat4`.

### Pipa: subida/descida e rotação

```
y(t) = 0.4 · sin(1.3 · t)          // movimento vertical
θ(t) = 0.18 · sin(1.9 · t)         // rotação leve (≈ ±10°)

M_pipa = T(0, y(t), 0) · Rz(θ(t))
```

Primeiro a pipa gira em torno da própria origem (a ponta inferior), depois é transladada na vertical. As frequências de translação e rotação são diferentes, então a inclinação não fica presa à altura e o movimento parece mais natural.

### Cauda: modelagem hierárquica

A cauda herda a transformação da pipa e soma rotações próprias:

```
b1(t) = 0.12 · sin(2.73 · t − 0.6) − 0.5 · θ(t)
b2(t) = 0.22 · sin(2.21 · t − 2.0) − 0.5 · θ(t)

M_fita1 = M_pipa · Rz(b1)
M_fita2 = M_fita1 · T(junta) · Rz(b2) · T(−junta)
```

- **Coerência com a pipa:** como `M_fita1` e `M_fita2` partem de `M_pipa`, as fitas sobem, descem e giram junto com ela, sempre presas à ponta inferior.
- **Movimento diferente:** cada fita tem frequência, amplitude e fase próprias. O termo `−0.5 · θ(t)` gira a fita no sentido contrário ao da pipa, como se a fita resistisse por inércia: quando a pipa inclina para um lado, a cauda fica para trás.
- **Rotação em torno da junta:** a segunda fita gira em torno do ponto onde se prende à primeira, e não da origem. Para isso usa-se `T(junta) · Rz · T(−junta)`: leva-se a junta para a origem, gira-se, e devolve-se a junta ao lugar. Como `M_fita2` parte de `M_fita1`, as rotações se acumulam, e a ponta da cauda balança mais que a base, como numa corrente.

## 3. Câmera (matriz de visão)

A câmera é criada com `createLookAtMat4(eye, at, up, true)`:

```
y_cam(t) = 0.5 · y(t) − 0.25

eye = (0, y_cam(t), 1)
at  = (0, y_cam(t), 0)
up  = (0, 1, 0)
```

- **Acompanhamento parcial:** a câmera percorre só 50% (`ACOMPANHAMENTO_CAMERA = 0.5`) do deslocamento vertical da pipa. Assim a pipa se move ±0.4 no mundo e só ±0.2 na tela. A câmera suaviza o movimento, mas ele continua visível.
- **Deslocamento fixo:** `DESLOCAMENTO_CAMERA_Y = −0.25` baixa a câmera para enquadrar pipa e cauda no campo de visão.
- A câmera fica em z = +1 olhando para a origem, então a base da visão é `x = (1, 0, 0)`, `y = (0, 1, 0)`, `z = (0, 0, 1)`.

## 4. Projeção ortográfica

```
METADE_ALTURA  = 1.25
METADE_LARGURA = 1.25 · (1024 / 768) ≈ 1.667

P = createOrthographicMat4(−1.667, 1.667, −1.25, 1.25, near = 0.1, far = 10)
```

- A largura do volume de visão é proporcional à razão de aspecto do canvas (4:3), então a pipa não fica deformada.
- A matriz leva x e y para [−1, 1] e a profundidade para o intervalo **[0, 1] do WebGPU**. Os objetos, a 1 unidade da câmera, ficam com z_ndc ≈ 0.09, dentro do volume.
- Por ser ortográfica, não há perspectiva: tamanhos e formas não dependem da distância, como se espera numa cena 2D.

## 5. Composição final e shaders

A cada quadro, na CPU, calcula-se para cada triângulo:

```
MVP = P · V · M
```

onde `M` é a matriz de modelagem do triângulo (`M_pipa`, `M_fita1` ou `M_fita2`), `V` a câmera e `P` a projeção. Cada triângulo tem seu próprio **uniform buffer** de 64 bytes (uma `mat4x4f`) e seu **bind group**, criados com `gpu.createUniform`. A matriz é enviada à GPU com `gpu.writeBuffer`.

Shader de vértice (`pipa.vert.js`):

```wgsl
@group(0) @binding(0) var<uniform> uniforms : Uniforms;   // mvp : mat4x4f

output.position = uniforms.mvp * position;
output.color = color;
```

O shader de fragmento (`pipa.frag.js`) devolve a cor recebida. Como os três vértices de cada triângulo têm a mesma cor, cada triângulo sai com cor sólida.

As fitas são desenhadas antes da pipa. Todos os triângulos estão no mesmo z e o teste de profundidade é `less`, então nas fronteiras prevalece o primeiro triângulo desenhado.

## 6. Animação

A animação é contínua, controlada por `requestAnimationFrame`. A cada quadro, `Main.draw()`:

1. abre o render pass (`gpu.start()`), limpando a tela com a cor do céu;
2. chama `Scene.draw()`, que lê o tempo `t = performance.now() / 1000` (em segundos), recalcula todas as matrizes, atualiza os uniform buffers e desenha os quatro triângulos;
3. envia os comandos à GPU (`gpu.finish()`);
4. agenda o próximo quadro com `requestAnimationFrame(this.draw.bind(this))`.

O movimento é função do tempo real, e não do número de quadros, então a velocidade é a mesma em qualquer taxa de atualização do monitor.

### Constantes da animação

| Constante | Valor | Papel |
|---|---|---|
| `AMPLITUDE_PIPA` | 0.4 | amplitude do movimento vertical |
| `OMEGA_ALTURA` | 1.3 rad/s | frequência angular da subida/descida |
| `INCLINACAO_PIPA` | 0.18 rad | amplitude da rotação (≈ 10°) |
| `OMEGA_ROTACAO` | 1.9 rad/s | frequência angular da rotação |
| `ACOMPANHAMENTO_CAMERA` | 0.5 | fração do movimento vertical seguida pela câmera |
| `DESLOCAMENTO_CAMERA_Y` | −0.25 | ajuste fixo de enquadramento da câmera |
| `JUNTA_CAUDA` | (0, −0.125, 0) | ponto de articulação entre as duas fitas |

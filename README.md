# Pipa - Computação Gráfica

Cena 2D animada de uma pipa voando sobre um fundo representando o céu, implementado em WebGPU.

## Trabalho em Contrução

### Composição da cena

A cena usa somente quatro triângulos:

- dois triângulos, em cores distintas, para compor a pipa;
- dois triângulos para compor as fitas da cauda.

Não são utilizadas texturas, imagens externas, bibliotecas de renderização ou primitivas diferentes de triângulos.

### Animação e transformações

- A pipa deve subir e descer continuamente, fazendo uma leve rotação.
- As fitas da cauda devem se movimentar de forma diferente, mas coerente, em relação ao movimento da pipa.
- A câmera deve acompanhar parcialmente o movimento vertical, sem eliminar a percepção de movimento da pipa na tela.
- A projeção deve ser ortográfica.

Utilize matrizes de modelagem, câmera e projeção. A aplicação deve usar WebGPU, shaders WGSL, buffers de vértices, uniform buffers e animação contínua por `requestAnimationFrame`.

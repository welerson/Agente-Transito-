
import { Infraction, Natureza } from './types';

export const INITIAL_INFRACTIONS: Infraction[] = [
  {
    id: '523-11',
    artigo: '172',
    codigo_enquadramento: '523-11',
    titulo_curto: 'Atirar do veículo objetos ou substâncias',
    descricao: 'Atirar do veículo ou abandonar na via objetos ou substâncias.',
    natureza: Natureza.MEDIA,
    penalidade: 'Multa',
    pontos: 4,
    medidas_administrativas: [],
    quando_atuar: [
      'Veículo estacionado, parado, imobilizado ou em circulação do qual o condutor e/ou passageiro atira objeto ou substância na via.'
    ],
    quando_nao_atuar: [
      'Quando a substância for atirada por passageiro de transporte coletivo de passageiros.',
      'Veículo estacionado, parado ou imobilizado do qual o condutor e/ou passageiro abandona objeto ou substância na via utilizar enquadramento específico: 538-00, art. 181, I.'
    ],
    definicoes_procedimentos: [
      'VIA - superfície por onde transitam veículos, pessoas e animais, compreendendo a pista, a calçada, o acostamento, ilha e canteiro central.',
      'Exemplos de objetos e substâncias: cigarro, papel, resto de alimento, água, lata de bebida, etc.'
    ],
    exemplos_ait: [
      'O condutor atirou do veículo uma lata de refrigerante.',
      'Passageiro atirou do veículo bituca de cigarro.'
    ],
    tags: ['atirar', 'objeto', 'substância', 'lixo', 'via'],
    fonte_legal: 'CTB Art. 172',
    ultima_atualizacao: '2025-01-01',
    status: 'ativo'
  },
  {
    id: '542-82',
    artigo: '181, V',
    codigo_enquadramento: '542-82',
    titulo_curto: 'Estacionar na pista de rolamento das rodovias',
    descricao: 'Estacionar o veículo na pista de rolamento das estradas, das rodovias, das vias de trânsito rápido e das vias dotadas de acostamento.',
    natureza: Natureza.GRAVISSIMA,
    penalidade: 'Multa',
    pontos: 7,
    medidas_administrativas: ['Remoção do veículo (Vide Parte Geral deste Manual)'],
    quando_atuar: [
      'Veículo estacionado na pista de rolamento da rodovia.'
    ],
    quando_nao_atuar: [
      'Via com sinalização permitindo o estacionamento.',
      'Veículo fazendo reparo sobre a pista de rolamento, salvo nos casos de impedimento absoluto de sua remoção e devidamente sinalizado.',
      'Veículo estacionado no acostamento, utilizar enquadramento específico: 550-90, art. 181, VII.'
    ],
    definicoes_procedimentos: [
      'RODOVIA - via rural pavimentada.',
      'PISTA - parte da via normalmente utilizada para a circulação de veículos.',
      'ESTACIONAMENTO - imobilização de veículo por tempo superior ao necessário para embarque ou desembarque de passageiros.'
    ],
    exemplos_ait: [
      'O veículo estava estacionado na pista de rolamento da Rodovia.'
    ],
    tags: ['estacionar', 'rodovia', 'pista', 'perigo'],
    fonte_legal: 'CTB Art. 181, V',
    ultima_atualizacao: '2025-01-01',
    status: 'ativo'
  }
];

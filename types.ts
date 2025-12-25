
export enum Natureza {
  LEVE = 'Leve',
  MEDIA = 'Média',
  GRAVE = 'Grave',
  GRAVISSIMA = 'Gravíssima',
  NAO_APLICAVEL = 'Não aplicável'
}

export enum UserRole {
  AGENTE = 'AGENTE',
  GESTOR = 'GESTOR'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Infraction {
  id: string;
  artigo: string;
  codigo_enquadramento: string;
  titulo_curto: string; // Tipificação Resumida
  descricao: string;    // Tipificação do Enquadramento
  natureza: Natureza;
  penalidade: string;
  pontos: number | string;
  medidas_administrativas: string[];
  quando_atuar: string[];
  quando_nao_atuar: string[];
  definicoes_procedimentos?: string[];
  exemplos_ait?: string[];
  tags: string[];
  fonte_legal: string;
  ultima_atualizacao: string;
  status: 'ativo' | 'inativo';
  count_atuacoes?: number;
}

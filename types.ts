
export enum Natureza {
  LEVE = 'Leve',
  MEDIA = 'Média',
  GRAVE = 'Grave',
  GRAVISSIMA = 'Gravíssima'
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
  inciso_alinea?: string;
  codigo_enquadramento: string;
  titulo_curto: string; // Tipificação Resumida
  descricao: string;    // Tipificação do Enquadramento
  natureza: Natureza;
  penalidade: string;
  pontos: number;
  medidas_administrativas: string[];
  quando_atuar: string[];
  quando_nao_atuar: string[];
  definicoes_procedimentos?: string[]; // Campo "Definições e Procedimentos"
  exemplos_ait?: string[];            // Campo "Exemplos do Campo de Observações do AIT"
  tags: string[];
  fonte_legal: string;
  ultima_atualizacao: string;
  status: 'ativo' | 'inativo';
  count_atuacoes?: number;           // Contador para relatórios
}

export interface InfractionRecord {
  id: string;
  infraction_id: string;
  infraction_title: string;
  agent_id: string;
  agent_name: string;
  criado_em: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_name: string;
  acao: 'CRIAR' | 'EDITAR' | 'REMOVER';
  entidade: string;
  entidade_id: string;
  detalhes: string;
  criado_em: string;
}

import React from 'react';
import { useParams, Navigate } from 'react-router-dom';

/**
 * Atalho amigável: /operacional/sp | /operacional/praia-grande | /operacional/goiania
 * Mapeia para o slug oficial usado pela edge function de acesso por CPF.
 *
 * Mantemos /operacional/:token (token gerado por técnico) ainda funcionando
 * — este componente só intercepta os 3 slugs fixos das filiais.
 */
const FILIAL_SLUG_MAP: Record<string, string> = {
  sp: 'op-sp',
  matriz: 'op-sp',
  'praia-grande': 'op-pg',
  praia: 'op-pg',
  pg: 'op-pg',
  goiania: 'op-go',
  goiânia: 'op-go',
  go: 'op-go',
};

const AcessoFilialOperacionalPage: React.FC = () => {
  const { filial = '' } = useParams<{ filial: string }>();
  const slug = FILIAL_SLUG_MAP[filial.toLowerCase()];
  if (!slug) return <Navigate to="/" replace />;
  return <Navigate to={`/acesso/${slug}`} replace />;
};

export default AcessoFilialOperacionalPage;

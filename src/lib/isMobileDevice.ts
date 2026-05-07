// Detecção de dispositivo móvel para regras de roteamento de portais.
// Usa user-agent + largura de tela como fallback.
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const narrow = window.innerWidth < 768;
  return uaMobile || narrow;
}

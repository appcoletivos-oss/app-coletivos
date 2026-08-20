import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deixa a navegação e os envios de formulário resilientes a quedas de
  // conexão (comum no Pátio de Compostagem, que depende de 4G e tem áreas
  // de sinal fraco): em vez de dar erro, o Next.js segura a requisição e
  // tenta de novo automaticamente assim que a internet voltar.
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    useOffline: true,
  },
};

export default nextConfig;

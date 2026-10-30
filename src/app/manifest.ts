import type { MetadataRoute } from "next";

// Isso é o que faz o App Coletivo poder ser "instalado" na tela inicial do
// celular (Android e iPhone) como se fosse um aplicativo normal, sem passar
// pela Google Play nem pela App Store.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "App Coletivo",
    short_name: "Coletivo",
    description:
      "Organização e gestão de coletivos comunitários e suas frentes de atuação.",
    // Sprint B (B1): o app instalado abre direto no dia (ponto, depois
    // checklist). /patio/hoje manda consultor pra /patio. No iPhone o
    // start_url fica gravado na instalação: quem já instalou precisa
    // reinstalar pra pegar este valor (o card de / também leva pra lá).
    start_url: "/patio/hoje",
    display: "standalone",
    background_color: "#f4f7f2",
    theme_color: "#2e6b3e",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

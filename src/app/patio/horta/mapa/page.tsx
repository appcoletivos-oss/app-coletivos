import { redirect } from "next/navigation";

// O Mapa virou a tela inicial da Horta (Sprint A.1, item 1). A rota antiga
// continua existindo só pra não quebrar links/favoritos já salvos.
export default function MapaPage() {
  redirect("/patio/horta");
}

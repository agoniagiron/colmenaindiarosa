import { esPromocionDeBanda, listarPromocionesVigentes } from '../../lib/promociones.js';

export async function listarPromocionesBanda() {
  const promociones = await listarPromocionesVigentes();

  return promociones.filter(esPromocionDeBanda).map((promo) => ({
    id: promo.id,
    nombre: promo.nombre,
    tipo: promo.tipo,
    valor: promo.valor,
    bannerTitulo: promo.bannerTitulo,
    bannerTexto: promo.bannerTexto,
    bannerImagenUrl: promo.bannerImagenUrl,
    bannerColorFondo: promo.bannerColorFondo,
  }));
}

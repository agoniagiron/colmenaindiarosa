import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProveedorCarrito } from './contexto/ContextoCarrito.tsx';
import { ProveedorConfiguracion } from './contexto/ContextoConfiguracion.tsx';
import { ProveedorSesion } from './contexto/ContextoSesion.tsx';
import { ProveedorSesionAdmin } from './contexto/ContextoSesionAdmin.tsx';
import { LayoutAdmin } from './layouts/LayoutAdmin.tsx';
import { LayoutTienda } from './layouts/LayoutTienda.tsx';
import { AdminAbastecimiento } from './paginas/admin/AdminAbastecimiento.tsx';
import { AdminAnalitica } from './paginas/admin/AdminAnalitica.tsx';
import { AdminInicio } from './paginas/admin/AdminInicio.tsx';
import { AdminInventario } from './paginas/admin/AdminInventario.tsx';
import { AdminPedidoDetalle } from './paginas/admin/AdminPedidoDetalle.tsx';
import { AdminPedidos } from './paginas/admin/AdminPedidos.tsx';
import { AdminProductoDetalle } from './paginas/admin/AdminProductoDetalle.tsx';
import { AdminProductos } from './paginas/admin/AdminProductos.tsx';
import { AdminProveedores } from './paginas/admin/AdminProveedores.tsx';
import { AdminAcceso } from './paginas/AdminAcceso.tsx';
import { CarritoPagina } from './paginas/CarritoPagina.tsx';
import { Catalogo } from './paginas/Catalogo.tsx';
import { CheckoutPagina } from './paginas/CheckoutPagina.tsx';
import { Cuenta } from './paginas/Cuenta.tsx';
import { Inicio } from './paginas/Inicio.tsx';
import { NoEncontrado } from './paginas/NoEncontrado.tsx';
import { PoliticaPrivacidad } from './paginas/PoliticaPrivacidad.tsx';
import { ProductoDetalle } from './paginas/ProductoDetalle.tsx';
import { ResultadoPedidoPagina } from './paginas/ResultadoPedidoPagina.tsx';

// Sin barra inicial ni final: se arma tal cual como un `path` más de
// react-router, para que solo esa ruta exacta monte AdminAcceso — cualquier
// otra variante (typo, subruta, barra de más) cae en el "*" de siempre.
const RUTA_ADMIN = (import.meta.env.VITE_RUTA_ADMIN ?? '/acceso-interno').replace(/^\//, '');

// Separado de BrowserRouter para que las pruebas puedan montar esto mismo
// dentro de un MemoryRouter con una URL inicial concreta.
export function ArbolRutas() {
  return (
    <ProveedorSesion>
      <ProveedorSesionAdmin>
        <ProveedorConfiguracion>
          <ProveedorCarrito>
            <Routes>
              <Route element={<LayoutTienda />}>
                <Route index element={<Inicio />} />
                <Route path="catalogo" element={<Catalogo />} />
                <Route path="producto/:slug" element={<ProductoDetalle />} />
                <Route path="carrito" element={<CarritoPagina />} />
                <Route path="checkout" element={<CheckoutPagina />} />
                <Route path="pedido/resultado" element={<ResultadoPedidoPagina />} />
                <Route path="cuenta" element={<Cuenta />} />
                <Route path="politica-privacidad" element={<PoliticaPrivacidad />} />
                {/* No enlazada desde ningún lugar del sitio: solo quien conoce
                    la URL exacta llega acá. */}
                <Route path={RUTA_ADMIN} element={<AdminAcceso />} />
                <Route path="*" element={<NoEncontrado />} />
              </Route>

              <Route path="admin" element={<LayoutAdmin />}>
                <Route index element={<AdminInicio />} />
                <Route path="inventario" element={<AdminInventario />} />
                <Route path="abastecimiento" element={<AdminAbastecimiento />} />
                <Route path="proveedores" element={<AdminProveedores />} />
                <Route path="pedidos" element={<AdminPedidos />} />
                <Route path="pedidos/:numero" element={<AdminPedidoDetalle />} />
                <Route path="productos" element={<AdminProductos />} />
                <Route path="productos/:id" element={<AdminProductoDetalle />} />
                <Route path="analitica" element={<AdminAnalitica />} />
              </Route>
            </Routes>
          </ProveedorCarrito>
        </ProveedorConfiguracion>
      </ProveedorSesionAdmin>
    </ProveedorSesion>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ArbolRutas />
    </BrowserRouter>
  );
}

export default App;

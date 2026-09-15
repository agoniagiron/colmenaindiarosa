import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProveedorCarrito } from './contexto/ContextoCarrito.tsx';
import { ProveedorSesion } from './contexto/ContextoSesion.tsx';
import { LayoutAdmin } from './layouts/LayoutAdmin.tsx';
import { LayoutTienda } from './layouts/LayoutTienda.tsx';
import { AdminAbastecimiento } from './paginas/admin/AdminAbastecimiento.tsx';
import { AdminInicio } from './paginas/admin/AdminInicio.tsx';
import { AdminInventario } from './paginas/admin/AdminInventario.tsx';
import { AdminPedidos } from './paginas/admin/AdminPedidos.tsx';
import { AdminProveedores } from './paginas/admin/AdminProveedores.tsx';
import { AdminReportes } from './paginas/admin/AdminReportes.tsx';
import { CarritoPagina } from './paginas/CarritoPagina.tsx';
import { Catalogo } from './paginas/Catalogo.tsx';
import { Cuenta } from './paginas/Cuenta.tsx';
import { Inicio } from './paginas/Inicio.tsx';
import { NoEncontrado } from './paginas/NoEncontrado.tsx';
import { ProductoDetalle } from './paginas/ProductoDetalle.tsx';

// Separado de BrowserRouter para que las pruebas puedan montar esto mismo
// dentro de un MemoryRouter con una URL inicial concreta.
export function ArbolRutas() {
  return (
    <ProveedorSesion>
      <ProveedorCarrito>
        <Routes>
          <Route element={<LayoutTienda />}>
            <Route index element={<Inicio />} />
            <Route path="catalogo" element={<Catalogo />} />
            <Route path="producto/:slug" element={<ProductoDetalle />} />
            <Route path="carrito" element={<CarritoPagina />} />
            <Route path="cuenta" element={<Cuenta />} />
            <Route path="*" element={<NoEncontrado />} />
          </Route>

          <Route path="admin" element={<LayoutAdmin />}>
            <Route index element={<AdminInicio />} />
            <Route path="inventario" element={<AdminInventario />} />
            <Route path="abastecimiento" element={<AdminAbastecimiento />} />
            <Route path="proveedores" element={<AdminProveedores />} />
            <Route path="pedidos" element={<AdminPedidos />} />
            <Route path="reportes" element={<AdminReportes />} />
          </Route>
        </Routes>
      </ProveedorCarrito>
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

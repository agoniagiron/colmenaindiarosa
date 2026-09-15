import { useNavigate } from 'react-router-dom';
import { Boton } from '../componentes/Boton.tsx';

export function NoEncontrado() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
      <h1 className="font-serif text-2xl text-tinta">404</h1>
      <p className="text-texto-secundario">Página no encontrada.</p>
      <Boton variante="rosa" onClick={() => navigate('/')}>
        Volver al inicio
      </Boton>
    </div>
  );
}

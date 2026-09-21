export interface CorreoAEnviar {
  para: string;
  asunto: string;
  texto: string;
}

export interface ServicioCorreo {
  enviar(correo: CorreoAEnviar): Promise<void>;
}

// Implementación de desarrollo: no hay proveedor de correo todavía, así
// que solo se imprime en consola. Cuando exista un proveedor real, se
// reemplaza esta implementación sin tocar quien la usa (misma interfaz).
class ServicioCorreoConsola implements ServicioCorreo {
  async enviar(correo: CorreoAEnviar): Promise<void> {
    console.log(
      `--- correo (dev) ---\nPara: ${correo.para}\nAsunto: ${correo.asunto}\n\n${correo.texto}\n--------------------`,
    );
  }
}

export const servicioCorreo: ServicioCorreo = new ServicioCorreoConsola();

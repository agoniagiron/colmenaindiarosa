import { Router } from 'express';
import { recibirWebhook } from './controlador.js';

// Público, sin autenticación: lo llama Wompi, no un navegador. La
// confianza viene de validar la firma dentro del servicio, no de un
// middleware de auth.
export const rutasWebhookWompi = Router();

rutasWebhookWompi.post('/', recibirWebhook);

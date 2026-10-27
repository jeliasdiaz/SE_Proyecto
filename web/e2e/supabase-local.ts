// Acceso directo al Supabase LOCAL para preparar datos y revisar resultados que la interfaz no
// muestra. Las llaves las pone playwright.config.ts (salen de `supabase status`): no van en el código.
export const API = "http://127.0.0.1:54321"
export const SECRETA = process.env.SUPABASE_SECRET_KEY!
export const PUBLICA = process.env.SUPABASE_PUBLISHABLE_KEY!

// La llave secreta salta RLS: solo para preparar o comprobar, nunca para lo que se está probando.
export const cabecerasSecretas = { apikey: SECRETA, Authorization: `Bearer ${SECRETA}`, "Content-Type": "application/json" }

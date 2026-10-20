import { config } from "zod/v4/core";

/* Zod 4 teste `new Function` pour accélérer la validation : bloqué par notre CSP (pas de 'unsafe-eval'),
   ce test produisait une alerte dans la console. Ce mode est désactivé ; les règles de validation sont identiques.
   Import à effet de bord uniquement (aucun export), pour ne pas empêcher l’élagage de Zod. */
config({ jitless: true });

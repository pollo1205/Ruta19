/**
 * CIRCUITO TENEX - CONFIGURACIÓN CENTRALIZADA
 * 
 * Contiene los datos maestros de la ruta, desfases, paradas autorizadas,
 * parámetros de servicio de Circuito Tenex y la contingencia temporal con Valle de Morelos.
 * 
 * No contiene lógica de renderizado para facilitar su edición y mantenimiento futuro.
 */

const TENEX_CONFIG = {
  // Información de la aplicación
  APP_NAME: "Circuito Tenex",
  APP_SUBTITLE: "Checador de combis en tiempo real estimado",
  APP_VERSION: "2.0.0",

  // ID de Medición de Google Analytics 4 (Opcional).
  // Si no se cuenta con un ID o se deja en blanco, la analítica permanecerá totalmente desactivada.
  // Ejemplo al activar: "G-XXXXXXXXXX"
  GA_MEASUREMENT_ID: "",

  // Parámetros de servicio base de Circuito Tenex
  ROUTE_TENEX: {
    name: "Circuito Tenex (Habitual)",
    shortName: "Tenex",
    badgeLabel: "Tenex Habitual",
    badgeClass: "badge-tenex",
    unitsCount: 6,                     // 6 unidades en la configuración histórica
    intervalMinutes: 16,               // Intervalo histórico de referencia: 16 min
    cycleMinutes: 96,                  // Vuelta completa de referencia: 96 min (6 * 16)
    baseTimeMinutes: 12 * 60 + 12,     // 12:12 hrs en Mercado Cuautla para Unidad 1 (732 min)
    physicalSign: "Letrero habitual: Circuito Tenex",
    
    // Horarios de inicio y fin (pendientes de confirmación oficial)
    firstService: {
      time: "06:04",                   // Primera pasada estimada en Mercado Cuautla
      timeMinutes: 6 * 60 + 4,
      status: "estimado",              // 'estimado' | 'confirmado' | 'pendiente'
      note: "Primera pasada estimada (~06:04 a. m. en Mercado Cuautla). Horario oficial pendiente de confirmación."
    },
    lastService: {
      time: "20:30",                   // Estimación aproximada para fin de servicio
      timeMinutes: 20 * 60 + 30,
      status: "pendiente",
      note: "Último servicio pendiente de confirmación oficial."
    },
    baseDepartures: {
      first: "Pendiente de confirmar",
      last: "Pendiente de confirmar"
    }
  },

  // Parámetros temporales del servicio reforzado con unidades de Valle de Morelos (Contingencia por obras viales)
  ROUTE_VALLE: {
    name: "Circuito Tenex (Antes Valle de Morelos)",
    shortName: "Antes Valle",
    badgeLabel: "Antes Valle de Morelos",
    badgeClass: "badge-valle",
    targetIntervalMinutes: 8,          // Intervalo objetivo combinado: 8 min
    interleaveOffsetMinutes: 8,        // Desfase intercalado: 8 min después de cada salida de Tenex
    activeByDefault: true,             // Activo por defecto mientras dure la contingencia vial
    physicalSign: "Porta letrero de CIRCUITO TENEX (antes ruta Valle de Morelos)",
    contingencyNotice: "Servicio reforzado temporal: Debido a obras viales, las unidades de Valle de Morelos ahora portan también el letrero físico de 'CIRCUITO TENEX' y recorren provisionalmente el circuito para lograr un paso objetivo de aproximadamente cada 8 minutos.",
    firstService: {
      time: null,
      timeMinutes: null,
      status: "pendiente",
      note: "Primer servicio de las unidades Antes Valle pendiente de confirmar."
    },
    lastService: {
      time: null,
      timeMinutes: null,
      status: "pendiente",
      note: "Último servicio de las unidades Antes Valle pendiente de confirmar."
    },
    baseDepartures: {
      first: "Pendiente de confirmar",
      last: "Pendiente de confirmar"
    }
  },

  // Catálogo completo de paradas autorizadas y sus desfases respecto a Mercado Cuautla (Ida)
  // Duración de ciclo: 96 minutos.
  // NOTA: Se excluye expresamente el antiguo Crucero de la Abelardo.
  STOPS: [
    {
      id: "mercado-ida",
      name: "Mercado Cuautla",
      direction: "ida",
      directionLabel: "Ida a Tenextepango",
      offset: 0,
      aliases: ["Mercado", "Mercado Cuautla"]
    },
    {
      id: "biblioteca",
      name: "Biblioteca Cuautla",
      direction: "ida",
      directionLabel: "Ida a Tenextepango",
      offset: 5,
      aliases: ["Biblioteca", "Biblioteca Cuautla"]
    },
    {
      id: "base-srp",
      name: "Base Sr. P.",
      direction: "ida",
      directionLabel: "Ida a Tenextepango",
      offset: 10,
      aliases: ["Base Sr. P.", "Base Sr P", "Base"]
    },
    {
      id: "arco-ida",
      name: "Arco, ida",
      direction: "ida",
      directionLabel: "Ida a Tenextepango",
      offset: 18,
      aliases: ["Arco", "Arco (ida)", "Arco, ida"]
    },
    {
      id: "gas-villa-ida",
      name: "Gas Villa, ida",
      direction: "ida",
      directionLabel: "Ida a Tenextepango",
      offset: 27,
      aliases: ["Gas Villa", "Gas Villa (ida)", "Gas Villa, ida"]
    },
    {
      id: "cancha-ol-ida",
      name: "Cancha Olímpica, ida",
      direction: "ida",
      directionLabel: "Ida a Tenextepango",
      offset: 31,
      aliases: ["Cancha OL", "Cancha Olímpica", "Cancha Olímpica, ida", "Cancha OL (ida)"]
    },
    {
      id: "herreria-ida",
      name: "Herrería, ida",
      direction: "ida",
      directionLabel: "Ida a Tenextepango",
      offset: 36,
      aliases: ["Herrería (ida)", "Herrería, ida", "Herreria ida"]
    },
    {
      id: "zona-tenex",
      name: "Zona Tenex",
      direction: "ida",
      directionLabel: "Zona Tenextepango",
      offset: 43,
      aliases: ["Z. Tenex", "Zona Tenex", "Tenex"]
    },
    {
      id: "centro-salud",
      name: "Centro de Salud",
      direction: "ida",
      directionLabel: "Zona Tenextepango",
      offset: 45,
      aliases: ["C. de Salud", "Centro de Salud"]
    },
    {
      id: "conasupo",
      name: "Conasupo",
      direction: "ida",
      directionLabel: "Zona Tenextepango",
      offset: 50,
      aliases: ["Conasupo"]
    },
    {
      id: "constancio-farfan",
      name: "Calle Constancio Farfán",
      direction: "ida",
      directionLabel: "Zona Tenextepango (Retorno)",
      offset: 53,
      aliases: ["C. Constancio Farfán", "Calle Constancio Farfán", "Constancio Farfán"]
    },
    {
      id: "herreria-regreso",
      name: "Herrería, regreso",
      direction: "regreso",
      directionLabel: "Regreso a Cuautla",
      offset: 61,
      aliases: ["Herrería (regreso)", "Herrería, regreso", "Herreria regreso"]
    },
    {
      id: "cancha-regreso",
      name: "Cancha, regreso",
      direction: "regreso",
      directionLabel: "Regreso a Cuautla",
      offset: 66,
      aliases: ["Cancha (regreso)", "Cancha, regreso", "Cancha regreso"]
    },
    {
      id: "gas-villa-regreso",
      name: "Gas Villa, regreso",
      direction: "regreso",
      directionLabel: "Regreso a Cuautla",
      offset: 70,
      aliases: ["Gas Villa (regreso)", "Gas Villa, regreso", "Gas Villa regreso"]
    },
    {
      id: "arco-regreso",
      name: "Arco, regreso",
      direction: "regreso",
      directionLabel: "Regreso a Cuautla",
      offset: 79,
      aliases: ["Arco (regreso)", "Arco, regreso", "Arco regreso"]
    },
    {
      id: "mercado-regreso",
      name: "Mercado Cuautla, regreso",
      direction: "regreso",
      directionLabel: "Llegada final Cuautla",
      offset: 96,
      aliases: ["Mercado Cuautla, regreso", "Mercado (regreso)", "Mercado regreso"]
    }
  ]
};

// Exportar en window para acceso desde el navegador
if (typeof window !== "undefined") {
  window.TENEX_CONFIG = TENEX_CONFIG;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = TENEX_CONFIG;
}

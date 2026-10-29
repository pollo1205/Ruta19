# 🚐 Guía de Mantenimiento y Configuración · Circuito Tenex

Esta guía documenta la arquitectura técnica, la administración de horarios, la contingencia vial con **Valle de Morelos**, la analítica opcional con Google Analytics y el procedimiento para publicar y verificar nuevas versiones en **GitHub Pages** y **Android (PWA)**.

---

## 1. Estructura del Proyecto

El código está organizado sin herramientas de compilación complejas ni librerías pesadas para garantizar máxima velocidad en dispositivos móviles Android y facilidad de edición:

```
📁 Ruta 19 / (o repositorio en GitHub)
├── index.html                  # Estructura semántica, accesibilidad y modales
├── styles.css                  # Variables de diseño, componentes responsive y temas
├── config.js                   # PARÁMETROS CENTRALIZADOS (Horarios, paradas, desfases, GA4)
├── app.js                      # Motor de cálculo, PWA, cuenta regresiva y persistencia
├── sw.js                       # Service Worker con caché v2 (modo sin conexión y actualización)
├── manifest.webmanifest        # Manifiesto de PWA para instalación en Android
├── icon.svg                    # Icono vectorial escalable de la combi y ruta 19
├── reportes-circuito-tenex.json # Respaldo inicial de reportes comunitarios
├── test_suite.ps1              # Pruebas automatizadas de lógica y horarios
└── GUIA_MANTENIMIENTO.md       # Esta guía completa de mantenimiento
```

---

## 2. Cómo Modificar Horarios, Paradas y Desfases

Toda la información operativa reside en [config.js](file:///c:/Users/aldai/Documents/programacion/Ruta%2019/config.js). No es necesario modificar `app.js` ni `index.html` para ajustar la ruta.

### 2.1. Catálogo de Paradas y Desfases (`STOPS`)
En `config.js`, ubica el arreglo `STOPS`:

```javascript
STOPS: [
  {
    id: "mercado-ida",
    name: "Mercado Cuautla",
    direction: "ida",
    directionLabel: "Ida a Tenextepango",
    offset: 0, // Minutos desde la salida inicial
    aliases: ["Mercado", "Mercado Cuautla"]
  },
  {
    id: "biblioteca",
    name: "Biblioteca Cuautla",
    direction: "ida",
    directionLabel: "Ida a Tenextepango",
    offset: 5, // 5 minutos después del Mercado
    aliases: ["Biblioteca"]
  },
  ...
]
```

- **Para cambiar el nombre de una parada:** Edita la propiedad `name`. Agrega el nombre anterior en `aliases` para no romper favoritos guardados por usuarios previos.
- **Para cambiar un desfase:** Modifica `offset` con los minutos reales transcurridos desde Mercado Cuautla.
- **Para añadir una parada nueva:** Insértala en la posición cronológica correcta con su `id`, `name`, `direction` y `offset`.

> [!CAUTION]
> El antiguo **Crucero de la Abelardo** no está autorizado y no debe incluirse en el catálogo de paradas.

---

## 3. Administración del Modo de Servicio Reforzado (Valle de Morelos)

Actualmente, debido a obras viales en su avenida habitual, las unidades de **Valle de Morelos** recorren temporalmente el mismo circuito que Tenex y **portan físicamente el letrero de «CIRCUITO TENEX»** en el parabrisas.

Para evitar confusiones en los pasajeros que esperan en la calle, la aplicación las identifica con la etiqueta **«Antes Valle de Morelos»** e incluye el aviso explícito: *«Lleva letrero de CIRCUITO TENEX (antes ruta Valle de Morelos)»*.

### 3.1. Cómo alternar desde la aplicación
Los usuarios pueden alternar entre el **Modo Normal** (solo unidades habituales de Tenex ~16 min) y el **Servicio Reforzado** (intercalado con unidades Antes Valle ~8 min) directamente desde el banner superior en la pantalla principal. Su preferencia se guarda en su teléfono.

### 3.2. Cómo desactivar el modo reforzado cuando concluyan las obras
Si los trabajos concluyen y Valle de Morelos regresa a su recorrido independiente:

1. Abre `config.js`.
2. En `ROUTE_VALLE`, cambia:
   ```javascript
   activeByDefault: false,
   ```
3. Oculta o actualiza el texto de `contingencyNotice` según sea necesario.

### 3.3. Cómo incorporar los horarios impresos reales de Valle de Morelos
Cuando se obtenga la tabla oficial de Valle de Morelos:

1. En `config.js` -> `ROUTE_VALLE`:
   - Configura `firstService.time` (ej. `"06:12"`), `firstService.status = "confirmado"`.
   - Configura `lastService.time` (ej. `"20:15"`), `lastService.status = "confirmado"`.
   - Si sus unidades tienen una hora base fija independiente, puedes definir `baseTimeMinutes` específico para Valle de Morelos en `config.js`.

---

## 4. Horarios de Primera y Última Combi

En `config.js` -> `ROUTE_TENEX`:

```javascript
firstService: {
  time: "06:04",
  timeMinutes: 6 * 60 + 4,
  status: "estimado", // Cambiar a "confirmado" cuando haya rol oficial impreso
  note: "Primera pasada estimada (~06:04 a. m. en Mercado Cuautla)."
},
lastService: {
  time: "20:30",
  timeMinutes: 20 * 60 + 30,
  status: "pendiente", // Cambiar a "confirmado" cuando se verifique
  note: "Último servicio pendiente de confirmación oficial."
}
```

- Si el estado es `"pendiente"`, la interfaz advierte con transparencia: *"Horario de inicio/fin pendiente de confirmar"*.
- Cuando se confirme el rol oficial, cambia `status: "confirmado"` y el texto se actualizará automáticamente.

---

## 5. Integración con Google Analytics 4 (GA4)

Para medir el uso de la aplicación por la comunidad sin comprometer privacidad:

1. Crea un flujo de datos web en tu cuenta de [Google Analytics](https://analytics.google.com).
2. Copia tu **ID de medición** (formato: `G-XXXXXXXXXX`).
3. Abre `config.js` y colócalo en:
   ```javascript
   GA_MEASUREMENT_ID: "G-TU_ID_AQUI",
   ```
4. Guarda y publica.
5. **Comprobación:** Abre la consola del navegador (`F12`); verás el mensaje `GA4 activado con ID: G-XXXXXXXXXX` y en el panel de *Tiempo real* de Google Analytics verás las visitas activas.

> [!NOTE]
> Si `GA_MEASUREMENT_ID` está vacío `""`, la analítica permanece 100% inactiva, sin cargar scripts externos ni realizar peticiones. Las visitas previas a la colocación del ID no se pueden registrar retroactivamente.

---

## 6. Procedimiento para Publicar en GitHub Pages

Dado que el proyecto se sirve en GitHub Pages (por ejemplo en `https://usuario.github.io/Ruta-19/`):

1. **Incrementar versión de caché en `sw.js`:**
   Siempre que realices cambios en código o configuración, sube el número de versión en la constante `CACHE_NAME` de `sw.js`:
   ```javascript
   const CACHE_NAME = 'circuito-tenex-v3'; // Incrementar versión
   ```
   Esto asegura que los teléfonos Android instalados descarguen los archivos nuevos y purguen la caché vieja automáticamente al activarse.

2. **Hacer commit y push a la rama de GitHub Pages (usualmente `main` o `gh-pages`):**
   ```bash
   git add .
   git commit -m "Actualización de horarios y mejoras PWA v2.0"
   git push origin main
   ```

3. **Verificación del despliegue en GitHub:**
   - Ve a la pestaña **Settings** -> **Pages** de tu repositorio en GitHub.
   - Comprueba que la compilación de GitHub Actions o Pages finalice en color verde.

---

## 7. Cómo Verificar la Nueva Versión desde Android

1. Abre Chrome o la app instalada en tu teléfono.
2. Si la app ya estaba instalada:
   - Al abrirla con conexión a internet, el Service Worker detectará la nueva versión en segundo plano.
   - En el pie de página de la app, pulsa el botón **"🔄 Buscar actualizaciones de la app"**.
   - O bien, cierra la aplicación desde la vista de aplicaciones recientes de Android y vuelve a abrirla.
3. **Verificación de caché y datos:**
   - Observa el encabezado: debe mostrar el subtítulo oficial *"Checador de combis en tiempo real estimado"*.
   - Comprueba que el selector muestre las 16 paradas con sus sentidos (Ida / Regreso).
   - Toca el botón de estrella ⭐ en una parada para validar que tus favoritos se guardan al recargar.
   - Activa el modo avión en tu teléfono: la app debe continuar funcionando mostrando el indicador *"📶 Sin red (modo local)"*.

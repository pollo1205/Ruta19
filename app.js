/**
 * CIRCUITO TENEX - APLICACIÓN PRINCIPAL
 * 
 * Gestiona el cálculo de horarios estimados, intercalación de Valle de Morelos,
 * persistencia local, selector de paradas, favoritos, reportes comunitarios y PWA.
 */

(function () {
  "use strict";

  // Verificar que la configuración centralizada esté disponible
  const config = window.TENEX_CONFIG;
  if (!config) {
    console.error("No se encontró la configuración TENEX_CONFIG.");
    return;
  }

  // --- ESTADO LOCAL ---
  const STORAGE_KEYS = {
    MODE: "tenex_service_mode",           // 'normal' | 'reforzado'
    SELECTED_STOP: "tenex_selected_stop", // stop ID
    FAVORITES: "tenex_favorites",         // array de IDs
    REPORTS: "tenex_reports_list"         // array de reportes
  };

  let currentMode = localStorage.getItem(STORAGE_KEYS.MODE) || (config.ROUTE_VALLE.activeByDefault ? "reforzado" : "normal");
  let selectedStopId = localStorage.getItem(STORAGE_KEYS.SELECTED_STOP) || "constancio-farfan";
  let favorites = [];
  try {
    favorites = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || ["constancio-farfan", "mercado-ida"];
  } catch (e) {
    favorites = ["constancio-farfan", "mercado-ida"];
  }

  let userReports = [];
  try {
    userReports = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPORTS)) || [];
  } catch (e) {
    userReports = [];
  }

  // Si no hay reportes en localStorage, cargar el reporte existente inicial
  if (userReports.length === 0) {
    userReports = [
      {
        stop: "Calle Constancio Farfán",
        time: "13:49",
        route: "Circuito Tenex",
        direction: "Ida a Tenextepango",
        status: "Adelantada",
        diffMin: "-1",
        note: "Paso 1 min antes (reporte histórico guardado)",
        at: "23/10/2026, 9:50:11 a. m."
      }
    ];
    saveReports();
  }

  // Resolver parada seleccionada si se guardó con nombre antiguo
  function resolveStop(stopIdentifier) {
    if (!stopIdentifier) return config.STOPS[10]; // C. Constancio Farfán por defecto
    const byId = config.STOPS.find(s => s.id === stopIdentifier);
    if (byId) return byId;
    const byName = config.STOPS.find(s => s.name.toLowerCase() === stopIdentifier.toLowerCase());
    if (byName) return byName;
    const byAlias = config.STOPS.find(s => s.aliases && s.aliases.some(a => a.toLowerCase() === stopIdentifier.toLowerCase()));
    if (byAlias) return byAlias;
    return config.STOPS[0];
  }

  let currentStop = resolveStop(selectedStopId);
  selectedStopId = currentStop.id;

  // --- MOTOR DE CÁLCULO DE HORARIOS ---
  /**
   * Obtiene la hora actual en minutos desde la medianoche y objeto Date.
   */
  function getCurrentTimeInfo() {
    const d = new Date();
    const minutesSinceMidnight = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    return {
      minutes: minutesSinceMidnight,
      date: d
    };
  }

  /**
   * Formatea minutos desde medianoche a formato 12 hrs con a.m./p.m. y 24 hrs.
   */
  function formatTime(minutes, use12h = true) {
    let normalized = ((minutes % 1440) + 1440) % 1440;
    let h = Math.floor(normalized / 60);
    let m = Math.floor(normalized % 60);
    const mStr = String(m).padStart(2, "0");

    if (!use12h) {
      return `${String(h).padStart(2, "0")}:${mStr}`;
    }

    const ampm = h >= 12 ? "p. m." : "a. m.";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, "0")}:${mStr} ${ampm}`;
  }

  /**
   * Comprueba si una hora dada se encuentra dentro del rango estimado de servicio.
   */
  function isWithinServiceHours(minutesSinceMidnight) {
    const first = config.ROUTE_TENEX.firstService.timeMinutes; // 06:04 = 364 min
    const last = config.ROUTE_TENEX.lastService.timeMinutes;   // 20:30 = 1230 min
    if (first === null || last === null) return true;
    return minutesSinceMidnight >= (first - 15) && minutesSinceMidnight <= (last + 90);
  }

  /**
   * Genera el rol completo de salidas para una parada dada.
   * Maneja tanto Tenex solo (16 min) como el reforzado con Valle de Morelos (8 min).
   */
  function generateScheduleForStop(stopObj, mode) {
    const tenex = config.ROUTE_TENEX;
    const valle = config.ROUTE_VALLE;
    const stopOffset = stopObj.offset;

    const arrivals = [];

    // Generar un abanico amplio de ciclos que cubra todo el día (desde las 04:00 hasta las 23:00)
    // Ciclo base = 96 min. En 24 horas hay 15 ciclos completos (k de -6 a 12).
    for (let k = -8; k <= 12; k++) {
      for (let u = 1; u <= tenex.unitsCount; u++) {
        // Horario base de Tenex en Mercado Cuautla + desfase de unidad + ciclo + desfase de parada
        const tenexTime = tenex.baseTimeMinutes + (u - 1) * tenex.intervalMinutes + (k * tenex.cycleMinutes) + stopOffset;

        arrivals.push({
          route: "Circuito Tenex",
          subRoute: "Habitual",
          displayTag: `Tenex Habitual · Unidad ${u}`,
          shortRoute: "Tenex",
          badgeClass: tenex.badgeClass,
          unitLabel: `Unidad ${u}`,
          unitCode: `U${u}`,
          timeMinutes: tenexTime,
          isReinforced: false,
          signNotice: "Unidad habitual de Circuito Tenex",
          certainty: "Horario de referencia (16 min)"
        });

        // Si el servicio reforzado está activo, intercalar Valle de Morelos 8 min después
        if (mode === "reforzado") {
          const valleTime = tenexTime + valle.interleaveOffsetMinutes;
          arrivals.push({
            route: "Circuito Tenex",
            subRoute: "Antes Valle de Morelos",
            displayTag: `Antes Valle de Morelos (Letrero Tenex)`,
            shortRoute: "Antes Valle",
            badgeClass: valle.badgeClass,
            unitLabel: `Antes Valle`,
            unitCode: `VM`,
            timeMinutes: valleTime,
            isReinforced: true,
            signNotice: "Lleva letrero de «CIRCUITO TENEX» (unidad antes Valle de Morelos)",
            certainty: "Estimado por contingencia (8 min)"
          });
        }
      }
    }

    // Ordenar cronológicamente y eliminar posibles duplicados exactos
    arrivals.sort((a, b) => a.timeMinutes - b.timeMinutes);

    return arrivals;
  }

  /**
   * Obtiene las próximas llegadas respecto a la hora actual.
   */
  function getUpcomingArrivals(stopObj, mode, currentTimeMinutes) {
    const fullSchedule = generateScheduleForStop(stopObj, mode);
    
    // Filtrar llegadas que aún no han pasado o están pasando (tolerancia de 1 min)
    let future = fullSchedule.filter(item => item.timeMinutes >= (currentTimeMinutes - 1.2));
    
    // Si estamos tarde en la noche y ya no hay para hoy, asegurar llegadas de la mañana siguiente
    if (future.length < 5) {
      // Agregar un ciclo completo de la madrugada siguiente
      future = fullSchedule.filter(item => item.timeMinutes >= (currentTimeMinutes - 1.2));
    }

    return future;
  }

  // --- PERSISTENCIA ---
  function saveReports() {
    try {
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(userReports));
    } catch (e) {
      console.warn("No se pudo guardar reportes en localStorage", e);
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    } catch (e) {
      console.warn("No se pudo guardar favoritos en localStorage", e);
    }
  }

  function toggleFavorite(stopId) {
    const idx = favorites.indexOf(stopId);
    if (idx >= 0) {
      favorites.splice(idx, 1);
    } else {
      favorites.push(stopId);
    }
    saveFavorites();
    renderFavoritesBar();
    updateFavoriteButton();
  }

  // --- ELEMENTOS DEL DOM ---
  const dom = {
    stopSelect: document.getElementById("stop-select"),
    favToggleBtn: document.getElementById("fav-toggle-btn"),
    favoritesBar: document.getElementById("favorites-bar"),
    routeStrip: document.getElementById("route-strip"),
    
    // Banner y modos
    contingencyBanner: document.getElementById("contingency-banner"),
    modeBtnNormal: document.getElementById("mode-normal-btn"),
    modeBtnReinforced: document.getElementById("mode-reinforced-btn"),
    statusServicePill: document.getElementById("status-service-pill"),
    statusOfflinePill: document.getElementById("status-offline-pill"),
    
    // Hero Card
    heroStopTitle: document.getElementById("hero-stop-title"),
    heroDirection: document.getElementById("hero-direction"),
    heroUnitTag: document.getElementById("hero-unit-tag"),
    heroSignNotice: document.getElementById("hero-sign-notice"),
    heroTime: document.getElementById("hero-time"),
    heroCountdown: document.getElementById("hero-countdown"),
    heroCertainty: document.getElementById("hero-certainty"),
    
    // Next units
    next1Card: document.getElementById("next1-card"),
    next1Title: document.getElementById("next1-title"),
    next1Time: document.getElementById("next1-time"),
    next1Countdown: document.getElementById("next1-countdown"),
    
    next2Card: document.getElementById("next2-card"),
    next2Title: document.getElementById("next2-title"),
    next2Time: document.getElementById("next2-time"),
    next2Countdown: document.getElementById("next2-countdown"),
    
    // Table
    rowsTbody: document.getElementById("arrivals-tbody"),
    currentTimeDisplay: document.getElementById("current-time-display"),
    
    // Reports
    reportsList: document.getElementById("reports-list"),
    btnOpenReportModal: document.getElementById("btn-open-report-modal"),
    btnCloseReportModal: document.getElementById("btn-close-report-modal"),
    reportModal: document.getElementById("report-modal"),
    reportForm: document.getElementById("report-form"),
    reportStopSelect: document.getElementById("report-stop-select"),
    
    // Update app button
    btnForceUpdate: document.getElementById("btn-force-update")
  };

  // --- INICIALIZACIÓN DE LA UI ---
  function initStopSelect() {
    if (!dom.stopSelect) return;
    dom.stopSelect.innerHTML = "";

    // Agrupar por ida y regreso para mayor claridad
    const groupIda = document.createElement("optgroup");
    groupIda.label = "── IDA A TENEXTEPANGO ──";

    const groupRegreso = document.createElement("optgroup");
    groupRegreso.label = "── REGRESO A CUAUTLA ──";

    config.STOPS.forEach(stop => {
      const opt = new Option(
        `${stop.name} (${stop.direction === "ida" ? "Ida" : "Regreso"})`,
        stop.id
      );
      if (stop.direction === "ida") {
        groupIda.appendChild(opt);
      } else {
        groupRegreso.appendChild(opt);
      }
    });

    dom.stopSelect.appendChild(groupIda);
    dom.stopSelect.appendChild(groupRegreso);
    dom.stopSelect.value = currentStop.id;

    // Llenar selector del modal de reportes
    if (dom.reportStopSelect) {
      dom.reportStopSelect.innerHTML = "";
      config.STOPS.forEach(stop => {
        dom.reportStopSelect.appendChild(new Option(`${stop.name} (${stop.directionLabel})`, stop.name));
      });
    }
  }

  function initRouteStrip() {
    if (!dom.routeStrip) return;
    dom.routeStrip.innerHTML = "";

    config.STOPS.forEach(stop => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `route-stop-item ${stop.id === currentStop.id ? "active" : ""}`;
      chip.textContent = stop.name;
      chip.setAttribute("data-stop-id", stop.id);
      chip.addEventListener("click", () => {
        changeStop(stop.id);
      });
      dom.routeStrip.appendChild(chip);
    });
  }

  function renderFavoritesBar() {
    if (!dom.favoritesBar) return;
    dom.favoritesBar.innerHTML = "";

    if (favorites.length === 0) {
      dom.favoritesBar.style.display = "none";
      return;
    }

    dom.favoritesBar.style.display = "flex";
    favorites.forEach(favId => {
      const stop = config.STOPS.find(s => s.id === favId);
      if (!stop) return;

      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "fav-chip";
      chip.innerHTML = `⭐ ${stop.name}`;
      chip.addEventListener("click", () => {
        changeStop(stop.id);
      });
      dom.favoritesBar.appendChild(chip);
    });
  }

  function updateFavoriteButton() {
    if (!dom.favToggleBtn) return;
    const isFav = favorites.includes(currentStop.id);
    if (isFav) {
      dom.favToggleBtn.classList.add("is-fav");
      dom.favToggleBtn.innerHTML = `★ Guardada`;
      dom.favToggleBtn.title = "Quitar de paradas favoritas";
    } else {
      dom.favToggleBtn.classList.remove("is-fav");
      dom.favToggleBtn.innerHTML = `☆ Favorita`;
      dom.favToggleBtn.title = "Guardar como parada favorita";
    }
  }

  function updateModeButtons() {
    if (dom.modeBtnNormal && dom.modeBtnReinforced) {
      if (currentMode === "reforzado") {
        dom.modeBtnReinforced.classList.add("active");
        dom.modeBtnNormal.classList.remove("active");
        dom.statusServicePill.className = "status-pill status-reinforced";
        dom.statusServicePill.innerHTML = `🟡 Reforzado (~8 min)`;
      } else {
        dom.modeBtnNormal.classList.add("active");
        dom.modeBtnReinforced.classList.remove("active");
        dom.statusServicePill.className = "status-pill status-active";
        dom.statusServicePill.innerHTML = `🟢 Tenex (~16 min)`;
      }
    }
  }

  function changeStop(stopId) {
    currentStop = resolveStop(stopId);
    selectedStopId = currentStop.id;
    localStorage.setItem(STORAGE_KEYS.SELECTED_STOP, selectedStopId);

    if (dom.stopSelect) dom.stopSelect.value = selectedStopId;
    updateFavoriteButton();

    // Actualizar clase activa en la tira de paradas y hacer scroll
    if (dom.routeStrip) {
      const items = dom.routeStrip.querySelectorAll(".route-stop-item");
      items.forEach(el => {
        if (el.getAttribute("data-stop-id") === selectedStopId) {
          el.classList.add("active");
          el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        } else {
          el.classList.remove("active");
        }
      });
    }

    renderSchedule();
    trackEvent("stop_change", { stop_name: currentStop.name });
  }

  // --- RENDERIZADO DEL HORARIO Y CUENTA REGRESIVA ---
  function renderSchedule() {
    const { minutes: nowMinutes, date: nowObj } = getCurrentTimeInfo();

    // Actualizar reloj digital en pie de tarjeta
    if (dom.currentTimeDisplay) {
      dom.currentTimeDisplay.textContent = nowObj.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
    }

    const inService = isWithinServiceHours(nowMinutes);
    const arrivals = getUpcomingArrivals(currentStop, currentMode, nowMinutes);

    if (!arrivals || arrivals.length === 0) {
      renderNoServiceUI();
      return;
    }

    // Unidad 1 (Próxima)
    const p1 = arrivals[0];
    const diff1Min = p1.timeMinutes - nowMinutes;
    const mins1 = Math.ceil(diff1Min);

    // Actualizar Hero Card
    if (dom.heroStopTitle) dom.heroStopTitle.textContent = currentStop.name;
    if (dom.heroDirection) dom.heroDirection.textContent = currentStop.directionLabel;
    
    if (dom.heroUnitTag) {
      dom.heroUnitTag.className = `hero-unit-tag ${p1.badgeClass}`;
      dom.heroUnitTag.textContent = p1.displayTag;
    }

    if (dom.heroSignNotice) {
      dom.heroSignNotice.textContent = `🏷️ ${p1.signNotice}`;
      dom.heroSignNotice.className = `hero-sign-notice ${p1.isReinforced ? "sign-valle" : "sign-tenex"}`;
    }

    if (dom.heroTime) {
      dom.heroTime.textContent = formatTime(p1.timeMinutes, true);
    }

    if (dom.heroCountdown) {
      if (diff1Min <= 0 && diff1Min >= -1.2) {
        dom.heroCountdown.className = "hero-countdown countdown-now";
        dom.heroCountdown.textContent = "¡Pasando en este momento!";
      } else if (mins1 <= 2) {
        dom.heroCountdown.className = "hero-countdown countdown-soon";
        dom.heroCountdown.textContent = mins1 <= 1 ? "Por llegar (menos de 1 min)" : "Llegando en ~2 min";
      } else {
        dom.heroCountdown.className = "hero-countdown countdown-normal";
        dom.heroCountdown.textContent = `Faltan aproximadamente ${mins1} min`;
      }
    }

    if (dom.heroCertainty) {
      dom.heroCertainty.textContent = p1.certainty;
    }

    // Siguiente unidad (p2)
    if (arrivals.length > 1 && dom.next1Card) {
      const p2 = arrivals[1];
      const diff2Min = Math.max(0, Math.ceil(p2.timeMinutes - nowMinutes));
      const p2Label = p2.isReinforced ? "Antes Valle (Letrero Tenex)" : `Tenex · ${p2.unitCode}`;
      if (dom.next1Title) dom.next1Title.textContent = p2Label;
      if (dom.next1Time) dom.next1Time.textContent = formatTime(p2.timeMinutes, true);
      if (dom.next1Countdown) dom.next1Countdown.textContent = `En ~${diff2Min} min`;
    }

    // Unidad posterior (p3)
    if (arrivals.length > 2 && dom.next2Card) {
      const p3 = arrivals[2];
      const diff3Min = Math.max(0, Math.ceil(p3.timeMinutes - nowMinutes));
      const p3Label = p3.isReinforced ? "Antes Valle (Letrero Tenex)" : `Tenex · ${p3.unitCode}`;
      if (dom.next2Title) dom.next2Title.textContent = p3Label;
      if (dom.next2Time) dom.next2Time.textContent = formatTime(p3.timeMinutes, true);
      if (dom.next2Countdown) dom.next2Countdown.textContent = `En ~${diff3Min} min`;
    }

    // Tabla de próximos pasos (mostrar siguientes 8 unidades)
    if (dom.rowsTbody) {
      const nextEight = arrivals.slice(0, 8);
      dom.rowsTbody.innerHTML = nextEight.map(item => {
        const diff = item.timeMinutes - nowMinutes;
        const m = Math.ceil(diff);
        let remainText = "";
        if (diff <= 0 && diff >= -1.2) {
          remainText = `<span style="color:#dc2626;font-weight:800;">Pasando</span>`;
        } else if (m <= 0) {
          remainText = `Ahora`;
        } else {
          remainText = `${m} min`;
        }

        const badgeHtml = item.isReinforced
          ? `<span class="badge-route ${item.badgeClass}" title="Combi con letrero físico de Circuito Tenex">🏷️ Antes Valle</span>`
          : `<span class="badge-route ${item.badgeClass}">Tenex · ${item.unitCode}</span>`;

        return `
          <tr>
            <td>${badgeHtml}</td>
            <td class="td-time">${formatTime(item.timeMinutes, true)}</td>
            <td class="td-remain">${remainText}</td>
          </tr>
        `;
      }).join("");
    }
  }

  function renderNoServiceUI() {
    if (dom.heroTime) dom.heroTime.textContent = "—:—";
    if (dom.heroCountdown) {
      dom.heroCountdown.className = "hero-countdown countdown-normal";
      dom.heroCountdown.textContent = "Fuera de horario estimado";
    }
    if (dom.heroCertainty) {
      dom.heroCertainty.textContent = "Servicio reanuda ~06:04 a. m. (Pendiente de confirmación)";
    }
  }

  // --- REPORTES COMUNITARIOS LOCALES ---
  function renderReports() {
    if (!dom.reportsList) return;
    if (userReports.length === 0) {
      dom.reportsList.innerHTML = `<div style="font-size:13px;color:#94a3b8;text-align:center;padding:12px;">No hay reportes registrados en este dispositivo aún.</div>`;
      return;
    }

    dom.reportsList.innerHTML = userReports.slice(0, 6).map((rep, index) => {
      return `
        <div class="report-item">
          <div class="report-top">
            <span class="report-stop">📍 ${rep.stop}</span>
            <span class="report-time">${rep.at || rep.time}</span>
          </div>
          <div class="report-detail">
            <strong>${rep.route}</strong> (${rep.direction || "Ida/Regreso"}) · 
            <span style="font-weight:700;color:${rep.status === 'A tiempo' ? '#166534' : rep.status === 'No pasó' ? '#dc2626' : '#ea580c'}">${rep.status}</span>
            ${rep.diffMin ? `(${rep.diffMin} min)` : ""}
          </div>
          ${rep.note ? `<div class="report-note">"${rep.note}"</div>` : ""}
        </div>
      `;
    }).join("");
  }

  // --- EVENT LISTENERS ---
  if (dom.stopSelect) {
    dom.stopSelect.addEventListener("change", (e) => {
      changeStop(e.target.value);
    });
  }

  if (dom.favToggleBtn) {
    dom.favToggleBtn.addEventListener("click", () => {
      toggleFavorite(currentStop.id);
    });
  }

  if (dom.modeBtnNormal) {
    dom.modeBtnNormal.addEventListener("click", () => {
      currentMode = "normal";
      localStorage.setItem(STORAGE_KEYS.MODE, currentMode);
      updateModeButtons();
      renderSchedule();
      trackEvent("mode_change", { mode: "normal" });
    });
  }

  if (dom.modeBtnReinforced) {
    dom.modeBtnReinforced.addEventListener("click", () => {
      currentMode = "reforzado";
      localStorage.setItem(STORAGE_KEYS.MODE, currentMode);
      updateModeButtons();
      renderSchedule();
      trackEvent("mode_change", { mode: "reforzado" });
    });
  }

  // Modal de reportes
  if (dom.btnOpenReportModal && dom.reportModal) {
    dom.btnOpenReportModal.addEventListener("click", () => {
      dom.reportModal.classList.add("open");
    });
  }

  if (dom.btnCloseReportModal && dom.reportModal) {
    dom.btnCloseReportModal.addEventListener("click", () => {
      dom.reportModal.classList.remove("open");
    });
  }

  if (dom.reportModal) {
    dom.reportModal.addEventListener("click", (e) => {
      if (e.target === dom.reportModal) {
        dom.reportModal.classList.remove("open");
      }
    });
  }

  if (dom.reportForm) {
    dom.reportForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = dom.reportForm;
      const stopVal = form.reportStop.value;
      const routeVal = form.reportRoute.value;
      const directionVal = form.reportDirection.value;
      const statusVal = form.reportStatus.value;
      const diffVal = form.reportDiff.value;
      const noteVal = form.reportNote.value.trim();

      const now = new Date();
      const newReport = {
        stop: stopVal,
        route: routeVal,
        direction: directionVal,
        status: statusVal,
        diffMin: diffVal || "0",
        note: noteVal,
        at: now.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "medium" }),
        time: now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
      };

      userReports.unshift(newReport);
      if (userReports.length > 30) userReports.pop();
      saveReports();
      renderReports();

      // Cerrar modal y limpiar
      dom.reportModal.classList.remove("open");
      form.reset();
      trackEvent("user_report_added", { route: routeVal, status: statusVal });
      alert("✅ Tu reporte se guardó correctamente en este teléfono. ¡Gracias por colaborar con la comunidad de Circuito Tenex!");
    });
  }

  // Comprobar estado de conexión (Online / Offline)
  function updateOnlineStatus() {
    if (!dom.statusOfflinePill) return;
    if (navigator.onLine) {
      dom.statusOfflinePill.style.display = "none";
    } else {
      dom.statusOfflinePill.style.display = "inline-flex";
      dom.statusOfflinePill.textContent = "📶 Sin red (modo local)";
    }
  }

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  // Registro del Service Worker con detección de actualizaciones
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js")
        .then(reg => {
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  // Nueva versión disponible en segundo plano
                  console.log("Nueva versión de Circuito Tenex lista para activar.");
                }
              });
            }
          });
        })
        .catch(err => {
          console.warn("Fallo al registrar Service Worker:", err);
        });
    });
  }

  // Botón para forzar actualización
  if (dom.btnForceUpdate) {
    dom.btnForceUpdate.addEventListener("click", () => {
      if ("caches" in window) {
        caches.keys().then(names => {
          return Promise.all(names.map(name => caches.delete(name)));
        }).then(() => {
          window.location.reload(true);
        });
      } else {
        window.location.reload(true);
      }
    });
  }

  // --- ANALÍTICA GOOGLE ANALYTICS 4 (OPCIONAL) ---
  function initGoogleAnalytics() {
    const gaId = config.GA_MEASUREMENT_ID;
    if (!gaId || typeof gaId !== "string" || !/^G-[A-Z0-9]+$/i.test(gaId.trim())) {
      // Inactivo: no se inyecta ningún script ni se realizan peticiones
      return;
    }

    try {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId.trim())}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      function gtag() { window.dataLayer.push(arguments); }
      window.gtag = gtag;
      gtag("js", new Date());
      gtag("config", gaId.trim(), {
        anonymize_ip: true,
        send_page_view: true
      });
      console.log("GA4 activado con ID:", gaId.trim());
    } catch (err) {
      console.warn("No se pudo iniciar GA4:", err);
    }
  }

  function trackEvent(eventName, params = {}) {
    if (typeof window.gtag === "function") {
      try {
        window.gtag("event", eventName, params);
      } catch (e) {}
    }
  }

  // --- ARRANQUE ---
  initStopSelect();
  initRouteStrip();
  renderFavoritesBar();
  updateFavoriteButton();
  updateModeButtons();
  updateOnlineStatus();
  renderReports();
  renderSchedule();
  initGoogleAnalytics();

  // Actualizar la pantalla cada segundo para refrescar cuenta regresiva y reloj
  setInterval(renderSchedule, 1000);

})();

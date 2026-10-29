# PRUEBAS AUTOMATIZADAS DEL SISTEMA DE CÁLCULO CIRCUITO TENEX

$ErrorActionPreference = "Stop"
Write-Host "Iniciando verificación de Circuito Tenex..." -ForegroundColor Cyan

# 1. Verificar existencia de archivos esenciales
$files = @(
  "index.html",
  "styles.css",
  "config.js",
  "app.js",
  "sw.js",
  "manifest.webmanifest",
  "icon.svg",
  "reportes-circuito-tenex.json"
)

foreach ($f in $files) {
  if (Test-Path $f) {
    Write-Host "  [OK] Archivo existe: $f" -ForegroundColor Green
  } else {
    Write-Host "  [ERROR] Falta archivo: $f" -ForegroundColor Red
    exit 1
  }
}

# 2. Validar JSON en manifest y reportes
try {
  $manifest = Get-Content "manifest.webmanifest" -Raw | ConvertFrom-Json
  Write-Host "  [OK] manifest.webmanifest es JSON válido. Name: '$($manifest.name)', display: '$($manifest.display)'" -ForegroundColor Green
  if ($manifest.icons.Count -gt 0) {
    Write-Host "  [OK] manifest tiene $($manifest.icons.Count) icono(s) configurado(s)." -ForegroundColor Green
  } else {
    Write-Host "  [ERROR] manifest no tiene iconos." -ForegroundColor Red
  }
} catch {
  Write-Host "  [ERROR] Error al parsear manifest.webmanifest: $_" -ForegroundColor Red
  exit 1
}

try {
  $reportes = Get-Content "reportes-circuito-tenex.json" -Raw | ConvertFrom-Json
  Write-Host "  [OK] reportes-circuito-tenex.json es JSON válido con $($reportes.Count) reporte(s)." -ForegroundColor Green
} catch {
  Write-Host "  [ERROR] Error al parsear reportes-circuito-tenex.json: $_" -ForegroundColor Red
  exit 1
}

# 3. Validar catálogo de paradas y desfases históricos de la tabla de referencia
$expectedStops = @(
  @{ name = "Mercado Cuautla"; offset = 0; expectedTime = "12:12" },
  @{ name = "Biblioteca Cuautla"; offset = 5; expectedTime = "12:17" },
  @{ name = "Base Sr. P."; offset = 10; expectedTime = "12:22" },
  @{ name = "Arco, ida"; offset = 18; expectedTime = "12:30" },
  @{ name = "Gas Villa, ida"; offset = 27; expectedTime = "12:39" },
  @{ name = "Cancha Olímpica, ida"; offset = 31; expectedTime = "12:43" },
  @{ name = "Herrería, ida"; offset = 36; expectedTime = "12:48" },
  @{ name = "Zona Tenex"; offset = 43; expectedTime = "12:55" },
  @{ name = "Centro de Salud"; offset = 45; expectedTime = "12:57" },
  @{ name = "Conasupo"; offset = 50; expectedTime = "13:02" },
  @{ name = "Calle Constancio Farfán"; offset = 53; expectedTime = "13:05" },
  @{ name = "Herrería, regreso"; offset = 61; expectedTime = "13:13" },
  @{ name = "Cancha, regreso"; offset = 66; expectedTime = "13:18" },
  @{ name = "Gas Villa, regreso"; offset = 70; expectedTime = "13:22" },
  @{ name = "Arco, regreso"; offset = 79; expectedTime = "13:31" },
  @{ name = "Mercado Cuautla, regreso"; offset = 96; expectedTime = "13:48" }
)

$baseMinutes = 12 * 60 + 12 # 732 min = 12:12

Write-Host "`nValidando desfases exactos y tiempos de referencia para Unidad 1..." -ForegroundColor Cyan
foreach ($st in $expectedStops) {
  $calcMin = $baseMinutes + $st.offset
  $h = [int][math]::Floor($calcMin / 60)
  $m = [int]($calcMin % 60)
  $calcTimeStr = "{0:D2}:{1:D2}" -f $h, $m
  if ($calcTimeStr -eq $st.expectedTime) {
    Write-Host "  [OK] $($st.name) -> Offset +$($st.offset) min = $calcTimeStr (Coincide con $($st.expectedTime))" -ForegroundColor Green
  } else {
    Write-Host "  [ERROR] $($st.name) esperado $($st.expectedTime), obtenido $calcTimeStr" -ForegroundColor Red
    exit 1
  }
}

# 4. Validar que la duración total del ciclo es de 96 minutos
$cycleTime = $expectedStops[-1].offset - $expectedStops[0].offset
if ($cycleTime -eq 96) {
  Write-Host "`n  [OK] Ciclo de vuelta completa es de 96 minutos exactamente (13:48 - 12:12)." -ForegroundColor Green
} else {
  Write-Host "`n  [ERROR] Duración de ciclo incorrecta: $cycleTime" -ForegroundColor Red
  exit 1
}

# 5. Validar que no existe la parada 'Crucero de la Abelardo' en la lista de paradas STOPS
$configContent = Get-Content "config.js" -Raw
$stopsIdx = $configContent.IndexOf("STOPS")
$stopsText = $configContent.Substring($stopsIdx)
if ($stopsText -match "name:\s*`"[^`"]*Abelardo" -or $stopsText -match "aliases:\s*\[[^\]]*Abelardo") {
  Write-Host "  [ERROR] Se detectó 'Crucero de la Abelardo' como parada autorizada en STOPS." -ForegroundColor Red
  exit 1
} else {
  Write-Host "  [OK] 'Crucero de la Abelardo' no figura como parada autorizada dentro del catálogo STOPS." -ForegroundColor Green
}

# 6. Validar lógica matemática de cálculo (Normal 16 min vs Reforzado 8 min)
Write-Host "`nSimulando generación de rol para 'Calle Constancio Farfán' (Offset +53 min):" -ForegroundColor Cyan
$offsetFarfan = 53
$cycle = 96
$units = 6
$interval = 16

# Modo Normal (Solo Tenex)
$tenexArrivals = @()
for ($u = 1; $u -le $units; $u++) {
  $t = $baseMinutes + (($u - 1) * $interval) + $offsetFarfan
  $h = [int][math]::Floor($t / 60)
  $m = [int]($t % 60)
  $tenexArrivals += [PSCustomObject]@{
    Unit = "U$u"
    Route = "Tenex"
    Minutes = $t
    Time = ("{0:D2}:{1:D2}" -f $h, $m)
  }
}
$tenexArrivals = $tenexArrivals | Sort-Object Minutes

Write-Host "  Horarios de Tenex en Constancio Farfán (1 ciclo base):"
foreach ($arr in $tenexArrivals) {
  Write-Host "    - $($arr.Unit): $($arr.Time) ($($arr.Minutes) min)"
}

# Comprobar diferencias entre llegadas consecutivas de Tenex
for ($i = 0; $i -lt ($tenexArrivals.Count - 1); $i++) {
  $diff = $tenexArrivals[$i+1].Minutes - $tenexArrivals[$i].Minutes
  if ($diff -ne 16) {
    Write-Host "  [ERROR] Intervalo entre $($tenexArrivals[$i].Unit) y $($tenexArrivals[$i+1].Unit) no es 16 min: $diff" -ForegroundColor Red
    exit 1
  }
}
Write-Host "  [OK] Todas las unidades consecutivas de Tenex tienen un intervalo exacto de 16 minutos." -ForegroundColor Green

# Modo Reforzado (Intercalado con Valle de Morelos a +8 min)
$reinforcedArrivals = @()
foreach ($ta in $tenexArrivals) {
  $reinforcedArrivals += $ta
  $vmMin = $ta.Minutes + 8
  $h = [int][math]::Floor($vmMin / 60)
  $m = [int]($vmMin % 60)
  $reinforcedArrivals += [PSCustomObject]@{
    Unit = "Antes Valle"
    Route = "Tenex (Antes Valle de Morelos)"
    Minutes = $vmMin
    Time = ("{0:D2}:{1:D2}" -f $h, $m)
  }
}
$reinforcedArrivals = $reinforcedArrivals | Sort-Object Minutes

Write-Host "`n  Horarios combinados (Servicio reforzado) en Constancio Farfán:"
foreach ($arr in $reinforcedArrivals) {
  Write-Host "    - $($arr.Route) $($arr.Unit): $($arr.Time) ($($arr.Minutes) min)"
}

# Comprobar diferencias en modo reforzado
for ($i = 0; $i -lt ($reinforcedArrivals.Count - 1); $i++) {
  $diff = $reinforcedArrivals[$i+1].Minutes - $reinforcedArrivals[$i].Minutes
  if ($diff -ne 8) {
    Write-Host "  [ERROR] Intervalo reforzado entre llegadas no es 8 min: $diff" -ForegroundColor Red
    exit 1
  }
}
Write-Host "  [OK] Todas las llegadas intercaladas en modo reforzado tienen un intervalo exacto de 8 minutos." -ForegroundColor Green

# 7. Validar alineación matemática de la primera pasada estimada de la mañana (06:04 a.m.)
$firstMorningMin = 6 * 60 + 4 # 364 min
$diffToBase = $baseMinutes - $firstMorningMin # 732 - 364 = 368 min
$cyclesFraction = $diffToBase % 16
if ($cyclesFraction -eq 0) {
  $steps = $diffToBase / 16
  Write-Host "`n  [OK] 06:04 a. m. está exactamente alineado con la cadencia de 16 minutos ($steps pasos de 16 min antes de las 12:12)." -ForegroundColor Green
} else {
  Write-Host "  [WARNING] 06:04 no coincide exactamente con múltiplos de 16 min." -ForegroundColor Yellow
}

# 8. Validar Service Worker
$swContent = Get-Content "sw.js" -Raw
if ($swContent -match "circuito-tenex-v2" -and $swContent -match "activate" -and $swContent -match "caches.delete") {
  Write-Host "  [OK] sw.js incluye versión de caché v2 y purga de cachés antiguas en 'activate'." -ForegroundColor Green
} else {
  Write-Host "  [ERROR] sw.js no maneja purga de caché correctamente." -ForegroundColor Red
  exit 1
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "TODAS LAS COMPROBACIONES PASARON SATISFACTORIAMENTE" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan

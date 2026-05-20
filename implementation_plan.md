# Plan de Implementación: GBM Invest-Alerts Analyzer v2.0

Proponemos una actualización de arquitectura y funcionalidad para llevar tu terminal de inversiones al siguiente nivel. Estas mejoras solucionan la pérdida de datos ante reinicios, añaden indicadores analíticos profesionales (Bandas de Bollinger), optimizan la red con streaming en tiempo real en vivo y agregan gamificación al simulador con un gráfico histórico de tu rendimiento.

---

## User Review Required

> [!IMPORTANT]
> **1. Persistencia de Datos con `db.json` (Base de Datos Local)**
> Actualmente, la aplicación almacena tus configuraciones de SMTP, tu API Key de Alpha Vantage, tu saldo virtual y tus alertas programadas en la memoria RAM del servidor. Cada vez que el servidor se reinicia o se actualiza, estos datos se pierden.
> *   **Propuesta**: Implementar un sistema de base de datos ultraligero y plano en `db.json` en la raíz del backend. Al guardar ajustes en la interfaz, comprar/vender activos o crear alertas, se guardarán automáticamente de forma persistente en tu disco.
> *   **Seguridad**: El archivo `db.json` se añadirá a `.gitignore` para garantizar que tus claves SMTP y API Keys personales nunca se suban públicamente a tu GitHub.

> [!TIP]
> **2. Superposición de Bandas de Bollinger (Bollinger Bands)**
> Las Bandas de Bollinger son uno de los indicadores visuales más populares en Wall Street. Consisten en una línea media (SMA de 20 periodos) y dos bandas exteriores basadas en la desviación estándar del precio.
> *   **Propuesta**: Calcularemos las bandas en el backend y crearemos una capa sombreada ultra-premium y semi-transparente en tu gráfico de Chart.js para visualizar zonas de sobrecompra y sobreventa directamente sobre la línea del precio.

---

## Open Questions

> [!NOTE]
> **¿Cuáles de estas características te gustaría priorizar para la versión 2.0?**
> Hemos ordenado el plan con los cuatro módulos activos. Puedes elegir implementar todos (recomendado para la experiencia más completa) o excluir alguno según tus preferencias actuales:
> 1.  **Persistencia de datos (`db.json`)**: Tus alertas y saldo no se borrarán nunca más al apagar el servidor.
> 2.  **Bandas de Bollinger en gráfico**: Estética avanzada y análisis visual de volatilidad.
> 3.  **Real-Time SSE Streaming**: Eliminar el polling de red de 5 segundos e implementar actualización instantánea.
> 4.  **Gráfico de Rendimiento de Portafolio**: Un nuevo gráfico que dibuja el valor de tu cuenta a lo largo del tiempo.

---

## Proposed Changes

Separaremos el desarrollo en componentes específicos del backend y el frontend:

### Backend Architecture

#### [MODIFY] [server.js](file:///H:/PROYECTO%20GBM/server.js)
*   **Módulo de Base de Datos (`db.json`)**:
    *   Añadir funciones para leer y escribir de forma síncrona/asíncrona en un archivo plano en la raíz del proyecto.
    *   Sembrar datos por defecto si el archivo no existe (saldo de $10,000 USD, alertas iniciales de ejemplo).
*   **Módulo de Bandas de Bollinger**:
    *   Añadir algoritmo de desviación estándar y calcular bandas superior e inferior para el historial de precios (periodo predeterminado de 20 ticks).
    *   Enviar los arreglos `bollingerUpper` y `bollingerLower` dentro del endpoint `/api/stocks`.
*   **Módulo de Streaming (SSE)**:
    *   Crear el endpoint `/api/stocks/stream` con cabeceras `text/event-stream` que mantiene una conexión persistente abierta con el navegador y empuja los nuevos ticks del mercado en vivo al instante sin tener que hacer solicitudes HTTP repetitivas.
*   **Módulo de Historial de Portafolio**:
    *   Añadir un arreglo `portfolioHistory` en la base de datos de portafolio que almacena el valor neto total de tu cuenta (Efectivo + Valor actual de posiciones abiertas) en cada tick para poder graficar tu curva de rentabilidad.

---

### Frontend Components

#### [MODIFY] [public/index.html](file:///H:/PROYECTO%20GBM/public/index.html)
*   **Panel de Gráfico Superior**:
    *   Agregar botones selectores visuales para activar/desactivar la visualización de indicadores individuales sobre el gráfico (SMA, EMA, Bandas de Bollinger).
*   **Panel de Portafolio / Simulador**:
    *   Crear una pestaña o contenedor colapsable que aloje un tercer gráfico premium de Chart.js dedicado a mostrar la evolución histórica del valor neto de tu dinero (curva NAV).

#### [MODIFY] [public/style.css](file:///H:/PROYECTO%20GBM/public/style.css)
*   Crear las clases de transición y diseño para los botones selectores del gráfico.
*   Dar formato y dimensiones fluidas al nuevo gráfico de portafolio histórico.

#### [MODIFY] [public/app.js](file:///H:/PROYECTO%20GBM/public/app.js)
*   **Conexión SSE**:
    *   Reemplazar el `setInterval` de 5 segundos de stocks por un objeto `new EventSource('/api/stocks/stream')`.
    *   Escuchar los eventos entrantes en tiempo real para actualizar la marquesina, las tarjetas y los terminales de forma instantánea.
*   **Actualización de Gráfico con Bollinger**:
    *   Agregar los datasets de Bollinger Upper y Bollinger Lower a Chart.js, configurando la propiedad `fill: '+1'` o similar para pintar un canal sombreado degradado translúcido entre ambas bandas.
*   **Controladores del Gráfico de Rendimiento**:
    *   Inicializar y actualizar de forma dinámica el tercer gráfico con la cronología de rentabilidad enviada por el servidor.

#### [MODIFY] [.gitignore](file:///H:/PROYECTO%20GBM/.gitignore)
*   Añadir `db.json` para proteger tus claves locales de ser expuestas en repositorios públicos.

---

## Verification Plan

### Automated & Manual Tests

1.  **Verificación de Persistencia**:
    *   Iniciar el servidor, configurar SMTP reales y crear 3 alertas nuevas en el navegador.
    *   Reiniciar el proceso del servidor (`node server.js`).
    *   Refrescar el navegador y verificar que tus alertas SMTP y configuraciones siguen activas exactamente como las dejaste.
2.  **Verificación Analítica (Visual)**:
    *   Activar/desactivar las Bandas de Bollinger en la interfaz y confirmar que el canal sombreado e indicadores se renderizan de forma interactiva con gran nitidez estética.
3.  **Verificación de Conectividad SSE**:
    *   Inspeccionar la pestaña de "Network" en las herramientas de desarrollo del navegador para asegurar que no hay solicitudes repetidas cada 5 segundos y que el canal persistente SSE está transmitiendo de forma continua.
4.  **Simulador de Rendimiento**:
    *   Comprar activos altamente volátiles, ver el precio cambiar, y verificar que el gráfico de portafolio registra el histórico y oscila de acuerdo a tus ganancias/pérdidas totales en vivo.

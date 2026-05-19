# 📈 GBM Invest-Alerts Analyzer

**GBM Invest-Alerts Analyzer** es una terminal premium de análisis técnico de inversiones (acciones y criptomonedas) en tiempo real con un motor integrado de alertas por correo electrónico.

La aplicación combina un frontend moderno en modo oscuro con estética de TradingView y un backend ligero e hiperrápido en Node.js que realiza cálculos de indicadores matemáticos y administra un simulador de inversiones.

---

## 🌟 Características Principales

*   **Marquesina de Mercados (Ticker Tape)**: Ribbon superior animado con variaciones y precios en vivo.
*   **Avanzado Terminal Gráfico**: Gráficos interactivos de precios overlayed con **SMA (14)** y **EMA (14)**, acompañados de un gráfico secundario de **MACD (Línea, Señal e Histograma)** utilizando Chart.js de forma ultra-fluida.
*   **Gauges de Indicadores**: Paneles analíticos que detallan **RSI**, **MACD**, **SMA** y **EMA** con etiquetas de acción inmediata (*Strong Buy*, *Oversold*, *Neutral*, *Bearish*).
*   **Dial de Sentimiento de Mercado**: Un medidor de aguja que gira dinámicamente según un algoritmo unificado que procesa todos los indicadores técnicos.
*   **Gestor de Alertas Inteligentes**: Permite programar alertas basadas en precios, RSI, SMA y EMA.
    *   *Evita el spam de correos*: Incorpora lógica inteligente de un único disparo (`isTriggered`) por cruce de umbral, reactivándose solo cuando el precio cruza en sentido contrario.
*   **Simulador de Inversiones (GBM Demo)**: Cuenta virtual con **$10,000 USD** para comprar y vender activos en tiempo real, evaluando tu rentabilidad actual.
*   **Configuración SMTP Dinámica**: Modifica los puertos, servidores y destinatario del correo emisor y receptor directamente en la UI.
*   **Mock Email Mode**: Por defecto, los correos se simulan e imprimen con formato y contenido HTML completo en la consola del servidor, facilitando pruebas inmediatas sin configurar credenciales reales.

---

## 🚀 Inicio Rápido

### 1. Iniciar el Servidor de Desarrollo
Para arrancar el proyecto, simplemente ejecuta en tu consola:

```bash
npm start
```

### 2. Acceder al Dashboard
Una vez iniciado, abre tu navegador y ve a:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📧 Configuración de Alertas por Correo (SMTP Real)

Si deseas recibir los correos electrónicos diseñados en tu bandeja de entrada real en lugar de verlos en la terminal:

### Paso 1: Generar Contraseña de Aplicación (Gmail / Cuenta Google)
Debido a las políticas modernas de seguridad de Google, no es posible utilizar tu contraseña estándar de Gmail. Sigue estos sencillos pasos:
1.  Ve a la configuración de tu **[Cuenta de Google](https://myaccount.google.com/)**.
2.  Accede a la pestaña **Seguridad** en el menú izquierdo.
3.  Asegúrate de que la **Verificación en 2 pasos** esté activada (requisito obligatorio de Google).
4.  Busca la sección **Contraseñas de aplicación** (puedes escribir "Contraseñas de aplicación" en el buscador de arriba).
5.  En la opción "Seleccionar aplicación", elige *Otra (nombre personalizado)* y escribe **"GBM Alerts"**.
6.  Haz clic en **Generar**. Copia la contraseña de 16 caracteres de fondo amarillo (sin espacios).

### Paso 2: Configurar en el Dashboard o `.env`
Puedes ingresar las credenciales directamente en el panel inferior **Panel de Configuración SMTP de Alertas** en el navegador:
*   **Servidor SMTP**: `smtp.gmail.com`
*   **Puerto**: `587`
*   **Correo Emisor**: *Tu cuenta de Gmail*
*   **Contraseña**: *La contraseña de aplicación de 16 letras generada*
*   **Destinatario**: *Tu correo donde quieres que lleguen los avisos*
*   **Simular Correos (Mock Logs)**: **Apagar** (Desmarcar el interruptor).

Haz clic en **Guardar Ajustes** y posteriormente en **Enviar Correo de Prueba** para verificar que todo esté en línea. ¡Recibirás un hermoso correo en modo oscuro!

---

## 🛠️ Estructura del Código

*   `server.js`: El cerebro del backend. Controla el simulador de mercado (Random Walk), calcula SMA, EMA, RSI y MACD, monitorea las alertas y despacha los correos con Nodemailer.
*   `public/index.html`: Estructura HTML semántica con las divisiones del terminal de trading, el simulador de portafolio y los formularios.
*   `public/style.css`: Estilo CSS premium en modo oscuro con degradados HSL, transiciones suaves y glassmorphism.
*   `public/app.js`: Controlador dinámico de frontend. Conecta con las APIs del backend mediante polling (cada 5 segundos) y empuja datos al gráfico de forma incremental utilizando `chart.update()`.

---

## 👨‍💻 Consejos Técnicos de GBM Invest-Alerts
*   **Evita el Spam**: Las alertas tienen un estado interno para no enviarte 15 correos por minuto si el precio oscila en el umbral. Cuando la condición deja de cumplirse, la alerta se restablece automáticamente o puedes reiniciarla manualmente en la tabla con el botón verde.
*   **Simulador en Vivo**: Selecciona cualquier ticker (como Bitcoin `BTC` o Microsoft `MSFT`) para actualizar el panel de compras rápidas en directo.

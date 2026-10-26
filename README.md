# Reto de calistenia de 28 días

Programa de calistenia con calendario, cronómetro y movilidad ilustrada.

Sitio estático: `index.html` e imágenes locales. No requiere compilación ni variables de entorno. El progreso se guarda en el navegador mediante localStorage.

## Vista local

```sh
python -m http.server 8000
```

Abre http://localhost:8000.

## Despliegue

Vercel: framework Other, directorio raíz del repositorio, sin comando de compilación.

## Aplicación y datos

- `app.js`: sesión guiada, niveles, historial, copias JSON y recuperación del temporizador.
- `program.js`: calendario y ejercicios del programa original.
- `app.css`: portada y modo entrenamiento adaptados al móvil.
- `manifest.webmanifest`, `icons/`, `sw.js`: instalación y contenido sin conexión.
- El progreso anterior (`calisthenics28_v1`) se migra al nuevo formato local. No se envían datos personales a un servidor.
- Al reabrir una sesión activa se recupera el tiempo transcurrido y queda pausada para continuar de forma explícita.
- La copia JSON combina los días completados; para un mismo día conserva la valoración más reciente. No hay sincronización automática entre dispositivos.
- Voz, pantalla encendida e instalación dependen del navegador. El modo entrenamiento funciona aunque no se admita la pantalla completa nativa.
- La primera carga debe tener conexión y mostrar «Lista sin conexión» antes de cerrar. Las actualizaciones se ofrecen con un botón y pausan la sesión antes de recargar.

## Verificación de navegador

Con el servidor local iniciado, instala Playwright en una carpeta de herramientas (fuera del sitio) y ejecuta:

```sh
npm install --prefix /tmp/calistenia-tools playwright@1.56.1
/tmp/calistenia-tools/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/calistenia-tools/node_modules node tests/browser.cjs
```

La prueba comprueba cronómetro, pausa y recuperación, avisos, niveles, finalización e historial, copias de seguridad, migración y reapertura sin conexión. Simula las APIs de voz y bloqueo de pantalla; su disponibilidad real depende del dispositivo. `BASE_URL` permite cambiar el servidor de prueba.

Al modificar el contenido o los controles, incrementa la versión de caché en `sw.js` para distribuir la actualización sin mezclar versiones.

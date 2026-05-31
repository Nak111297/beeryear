# Beer Year

App local para llevar el conteo de cervezas del grupo durante el año.

## Abrir

Abre `index.html` en el navegador.

## Incluye

- Leaderboard por año, mes o todo el historial.
- Registro de una birra por subida, con amigo, fecha, cerveza, tipo, presentación, mililitros personalizados, país, plan, con quién se la tomó y nota.
- Presentación "Otra" con mililitros personalizados para registrar cualquier tamaño de chela.
- País autodetectado por zona horaria (y recordado entre subidas), editable desde un selector con banderas.
- Gráfica principal con rango seleccionable: año, mes, semana o día, anclada a la fecha que elijas.
- Stats del año: ritmo proyectado, birras totales, subidas, mes top, cerveza top, presentación top, partner top, tipo top, plan top y MVP.
- Breakdown de cuántas chelas se tomó cada jugador con cada amigo.
- Barra inferior para navegar entre Inicio, Stats e Historial.
- Stats con litros por presentación, six packs aproximados y gráficas por mes, día de la semana, presentación, tipo y país.
- Registro con hora automática: cada birra se guarda con timestamp exacto al subirla.
- Firebase Auth anónimo + Firestore realtime para que todos vean el mismo marcador.
- Exportar/importar JSON para respaldo o migración.

## Nota

La app guarda datos compartidos en Cloud Firestore bajo `groups/beeryear`. Si Firestore está vacío, crea los amigos iniciales o migra el viejo `localStorage` del navegador actual.

## Firebase

Activa **Authentication > Sign-in method > Anonymous** en Firebase Console. Las reglas recomendadas están en `firestore.rules`.

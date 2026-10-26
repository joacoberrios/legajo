# Legajo

La historia clínica del auto: los talleres cargan cada trabajo, el registro queda firmado y no se puede modificar, y quien compra un usado ve el historial real por link o QR.

Este repo es el MVP: una web app pensada para usar desde el celular del taller.

## Qué hace

- **Talleres:** registro con CUIT, login, búsqueda por patente o escaneo del QR del parabrisas.
- **Legajo del auto:** alta (patente, VIN, marca, modelo, año) y línea de tiempo de todos los registros.
- **Carga de registros:** tipo de trabajo, km, fecha, trabajos hechos y notas internas. Queda firmado por el taller y el usuario.
- **Respaldo:** foto del tablero, fotos del trabajo y comprobantes (foto o PDF) por registro, sellados dentro de la firma. Un registro con foto del tablero o comprobante figura como "Con respaldo".
- **Correcciones:** un error se corrige con un registro nuevo que apunta al original; el original queda visible como corregido.
- **Informe público** (`/i/<slug>`): puntaje 0–100, chequeos (integridad, km, respaldo, services, origen 0 km) y la línea de tiempo sin notas internas.
- **Sticker QR** imprimible por auto.
- **Equipo** (`/taller/equipo`): el dueño invita mecánicos con un link de un solo uso (vence en 7 días) que puede mandar por WhatsApp. Cada registro queda firmado por quien lo cargó.
- **Aviso al dueño:** después de cada carga se abre un botón para mandarle por WhatsApp el link al informe de su auto (el teléfono no se guarda).
- **App instalable:** manifest e íconos para agregarla a la pantalla de inicio; en Android aparece un botón Instalar y en iPhone las instrucciones.
- **Recuperar contraseña:** links de un solo uso (24 h). El dueño los genera para su equipo desde Equipo y el admin para los dueños desde `/admin`. Si se configura Resend, también hay autoservicio por email en `/recuperar`.
- **Lectura con cámara (gratis):** escáner de patente en vivo que lee en el propio celular (Tesseract.js): analiza cuadro por cuadro, alterna contraste e inversión (patentes viejas), corrige letras/números según el formato argentino y solo acepta cuando 3 de las últimas 6 lecturas coinciden. Tarjeta verde (marca, modelo, tipo, año, chasis, motor) y chasis por foto con OCR local. Las fotos no salen del teléfono y el taller siempre confirma. Si se configura `ANTHROPIC_API_KEY`, las fotos de tarjeta y chasis se leen con IA en el servidor (más preciso, con costo).
- **Registro de taller:** CUIT con guiones automáticos y dígito verificador, teléfono, dirección confirmada en el mapa (búsqueda o ubicación del celular), nombre, apellido y contraseña repetida.
- **Panel de admin** (`/admin`): talleres activos en la semana contra la meta del piloto (10), métricas generales y verificación de talleres con un botón.

## Panel de computadora (`/panel`)

Vista ancha para la administración de talleres y agencias, con barra lateral. Se entra con el botón «Panel» de la app (en pantallas grandes).

- **Resumen:** indicadores del mes y últimos registros (taller) o autos con novedades e informes (agencia).
- **Vehículos / Mis autos:** tabla con búsqueda (patente, marca, modelo, VIN), filtros (marca, último trabajo o etapa, rango de fechas), orden por columna y paginado. Puntaje e integridad por auto.
- **Ficha del auto:** todos los datos, puntaje y chequeos, historial en tabla con adjuntos, km fuera de secuencia marcados, agregar y corregir registros, completar VIN y motor.
- **Nuevo auto**, **Registros** (con filtros, orden y exportación a CSV para Excel), **Informes** (agencias), **Equipo** y **Datos**.

## Cuentas de agencia

Al registrarse se elige **taller** o **agencia de autos** (mismo alta con CUIT, teléfono y ubicación; el admin verifica a las dos).

- La agencia consulta cualquier patente (escaneando la patente, la tarjeta verde o el QR) y ve el historial completo sin notas internas, con chasis y motor completos para compararlos con los papeles. No carga registros ni asigna stickers.
- **Mis autos:** sigue los autos en tres etapas (evaluando, en stock, vendido) y ve cuántos registros nuevos les cargaron los talleres desde la última vez.
- **Informe verificado** (`/v/<código>`): congela el historial en ese momento con fecha, código y la agencia como emisora; al abrirlo comprueba que esa parte no cambió y avisa si hay registros posteriores. Se comparte por WhatsApp o se guarda en PDF. Requiere agencia verificada.
- Sus consultas quedan en el registro de consultas como las de cualquier taller.

## Stickers QR sin asignar

Los stickers se imprimen en tandas desde **Admin › Stickers** (12 por hoja A4, cada uno con su QR y un código de 8 caracteres) y salen sin auto. El QR lleva a `/q/<código>`:

- **Sin asignar:** el taller (logueado y verificado) elige la patente y confirma. Si el auto no tiene legajo, lo da de alta y el sticker queda asignado al guardar. También se puede vincular desde el legajo del auto con «Vincular sticker QR» (escaneando o tipeando el código).
- **Asignado:** lleva al informe público, o al legajo completo si quien escanea es un taller.
- La asignación es definitiva (lo impide un trigger en Postgres). Un sticker perdido o mal pegado lo anula un admin; un auto puede tener varios.

## Cómo garantiza que el historial no se adultere

1. Un trigger de Postgres rechaza cualquier `UPDATE`, `DELETE` o `TRUNCATE` sobre `service_records` (`migrations/001_init.sql`).
2. Cada registro guarda el SHA-256 de su contenido y del registro anterior del mismo auto (`src/lib/ledger.ts`). Si alguien altera una fila directo en la base, el informe muestra "Historial alterado".
3. Taller y usuario se toman de la sesión, nunca del formulario.
4. Si el km es menor al último registrado, se pide confirmación y el informe marca la inconsistencia.
5. Los adjuntos se suben directo del celular a Vercel Blob con una URL firmada que vence a los 10 minutos y solo permite escribir en la carpeta del taller, pero al firmar el servidor descarga cada archivo y calcula su SHA-256. Esa huella entra en el hash del registro (formato `legajo:v2`) y se guarda en `record_attachments`, que también es inmutable. Si alguien reemplaza un archivo o su registro en la base, la cadena se rompe. Los registros sin adjuntos siguen usando el formato `legajo:v1`.
6. Los archivos se sirven a través de la app (`/api/adjuntos/<id>`). En el informe público se ven las fotos del tablero y del trabajo; los comprobantes solo se indican y únicamente los abre un taller logueado, porque pueden tener datos del dueño.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Postgres con la librería `postgres` · sesiones con `jose` + `bcryptjs` · QR con `qrcode`. El escaneo de QR usa el lector nativo del navegador (`BarcodeDetector`) y, donde no existe (Safari, Firefox, Chrome de escritorio), `jsqr`.

## Poner online en Vercel

1. Importá este repo en Vercel (**Add New → Project**).
2. En **Storage**, creá una base **Neon (Postgres)** y conectala al proyecto: Vercel agrega `DATABASE_URL`.
3. En **Settings → Environment Variables** agregá:
   - `AUTH_SECRET`: un texto largo y aleatorio (`openssl rand -base64 32`).
   - No hace falta cargar la URL de la app: en producción se usa sola el dominio de producción del proyecto (el que va en los QR y en los links de WhatsApp). `NEXT_PUBLIC_APP_URL` solo sirve para desarrollo local.
   - `ADMIN_EMAILS`: emails con acceso a `/admin`, separados por coma.
   - Opcional, con costo: `ANTHROPIC_API_KEY` para leer tarjeta verde y chasis con IA en vez del OCR gratis del celular. Opcional `OCR_MODEL` (por defecto `claude-sonnet-5-5`).
   - Opcional: `SUPPORT_WHATSAPP` (tu celular) para el botón de ayuda en `/recuperar`.
   - Opcional: `RESEND_API_KEY` y `EMAIL_FROM` (de un dominio verificado en Resend) para recuperar contraseña por email.
   - Opcional para probar: `AUTO_VERIFY_WORKSHOPS=true`, así los talleres nuevos quedan verificados al registrarse.
4. En **Storage**, creá un **Blob** store y conectalo al proyecto (para fotos y comprobantes). Vercel agrega `BLOB_STORE_ID` y `BLOB_WEBHOOK_PUBLIC_KEY`; la app usa las credenciales OIDC del proyecto, sin token fijo. Por defecto asume un store **privado**; si lo creaste público, agregá `BLOB_ACCESS=public`.
5. Deploy. El build corre las migraciones (`scripts/migrate.mjs`) antes de compilar.
6. Entrá a `/registro`, creá el primer taller y verificalo desde `/admin` (con un email listado en `ADMIN_EMAILS`).

## Desarrollo local

```bash
cp .env.example .env.local   # completá DATABASE_URL y AUTH_SECRET
npm install
npm run migrate
npm run dev
```

Tests de la lógica del legajo (cadena de hashes, puntaje, patentes):

```bash
npm test
```

## Estructura

```
migrations/            SQL versionado (esquema + trigger de inmutabilidad)
scripts/migrate.mjs    aplica las migraciones pendientes
src/lib/ledger.ts      hash, verificación de la cadena y puntaje del informe
src/lib/data.ts        consultas a la base
src/app/actions/       server actions (login, registro, autos, registros)
src/app/taller/        app del taller (requiere login)
src/app/i/[slug]/      informe público
```

## Próximos pasos

- Fotos y comprobantes (Vercel Blob)
- Lectura de patente por cámara (OCR)
- Aviso al dueño por WhatsApp con el link del legajo
- Panel de administración para verificar talleres
- Cobro del informe completo (Mercado Pago)

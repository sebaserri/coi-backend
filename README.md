# COI API — Guía de uso, dev y despliegue

## 🧭 TL;DR (chuleta rápida)

### Desarrollo (local, hot-reload):

```bash
# 1) Infra local (Postgres + MinIO)
docker compose up -d                  # usa docker-compose.yml

# 2) App (local, con hot reload)
cp .env.example .env                  # ajustá lo necesario
npm install
npm run run prisma:dev
npm run prisma:generate
npm run db:seed
npx prisma studio
#npx prisma migrate dev --name init
npm run start:dev                     # levanta en http://localhost:3000
```

-----

### Producción (RDS + S3 reales):

> **Elegí Dockerfile:**
>
>   - **Con OCR:** `Dockerfile.ocr`
>   - **Sin OCR (más chica):** `Dockerfile.slim`

```bash
cp .env.prod.example .env.prod        # completá JWT, DATABASE_URL, S3, Twilio, etc.

# Build imagen
docker compose -f docker-compose.prod.yml build

# Migraciones (deploy)
docker run --rm --env-file .env.prod \
  -v "$(pwd)":/app -w /app yourorg/coi-api:prod \
  sh -lc "npx prisma migrate deploy"

# Levantar API
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Healthcheck:
curl -i http://localhost:3000/health
```

-----

## 📁 Estructura relevante

  - `.env` → variables de desarrollo local (API corriendo con `npm run start:dev`).
  - `.env.example` → plantilla para `.env`.
  - `.env.prod.example` → plantilla para producción (`.env.prod`).
  - `docker-compose.yml` → **DEV:** levanta Postgres + MinIO locales (no API).
  - `docker-compose.prod.yml` → **PROD:** buildea y corre API (RDS/S3 externos).
  - `Dockerfile.ocr` → imagen con OCR (`tesseract-ocr` + `poppler-utils`).
  - `Dockerfile.slim` → imagen sin OCR (más liviana).

> ⚠️ **No mezclar:**
>
>   - `docker-compose.yml` = infra de dev.
>   - `docker-compose.prod.yml` = API en prod.
>   - `.env` se usa en dev; `.env.prod` en prod.

-----

## 🧪 Desarrollo (local)

### 1\) Levantar Postgres + MinIO

```bash
docker compose up -d              # usa docker-compose.yml
```

  - **Postgres:** `localhost:5432` (usuario/password: `postgres`/`postgres`)
  - **MinIO:** [http://localhost:9001](https://www.google.com/search?q=http://localhost:9001) (usuario/password: `minioadmin`/`minioadmin`)

> 🛎️ Entrá a MinIO ([http://localhost:9001](https://www.google.com/search?q=http://localhost:9001)) y creá el bucket `coi-uploads`.

-----

### 2\) Configurar y correr la API

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run start:dev
npx prisma studio
```

La API corre en [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000).

**Usuarios seed:**

  - `admin@example.com` / `password123` (**ADMIN**)
  - `vendor@example.com` / `password123` (**VENDOR**)
  - `guard@example.com` / `password123` (**GUARD**)

-----

## 📖 Documentación API (Swagger)

### Instalación

```bash
npm install @nestjs/swagger swagger-ui-express
```

-----

### Uso

  - Copiá los archivos de configuración sobre tu proyecto API NestJS.
  - Ejecutá `npm run start:dev`.
  - Abrí en tu navegador:
      - **Swagger UI:** [http://localhost:3000/docs](https://www.google.com/search?q=http://localhost:3000/docs)
      - **JSON:** [http://localhost:3000/docs-json](https://www.google.com/search?q=http://localhost:3000/docs-json)

-----

## ☁️ Producción (RDS + S3)

### 0\) Elegir imagen

  - **¿Vas a usar OCR** (escaneados ACORD 25)? → `Dockerfile.ocr`
  - **¿No necesitás OCR?** → `Dockerfile.slim` (más chica)

> Cambiá el `dockerfile:` en `docker-compose.prod.yml` si querés usar el slim.

-----

### 1\) Variables de entorno

```bash
cp .env.prod.example .env.prod
```

**Editá `.env.prod`:**

  - `JWT_SECRET` (largo y aleatorio)
  - `DATABASE_URL` (RDS, ideal con `sslmode=require`)
  - `S3_REGION`, `S3_BUCKET`, `S3_ENDPOINT=https://s3.amazonaws.com`, `ACCESS/SECRET KEY` (o IAM Role)
  - `ALLOWED_ORIGINS` (tu dominio del front)
  - **Twilio (opcional):** `SID/TOKEN/FROM`

-----

### 2\) Build y migraciones

```bash
docker compose -f docker-compose.prod.yml build
```

```bash
docker run --rm --env-file .env.prod \
  -v "$(pwd)":/app -w /app yourorg/coi-api:prod \
  sh -lc "npx prisma migrate deploy"
```

-----

### 3\) Levantar

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
curl -i http://localhost:3000/health
```

> El Healthcheck devuelve **200** si DB y S3 están ok (Twilio solo verifica configuración). Si falla algo crítico, devuelve **503**.

-----

## 🔐 Seguridad y buenas prácticas

  - **JWT\_SECRET:** usá uno fuerte y rotalo periódicamente.
  - **CORS:** limitá `ALLOWED_ORIGINS` a tu dominio.
  - **S3:** bucket privado; la app usa *pre-signed POST* para subir y guarda la URL.
  - **Backups:** snapshot/Postgres (RDS) diario; retención según política (p.ej. 7 años).
  - **Logs:** integrá con CloudWatch/Stackdriver o similar; creá alertas para errores 5xx.
  - **Roles:**
      - `ADMIN`: todo.
      - `VENDOR`: solo sus COIs (si usás vistas vendor).
      - `GUARD`: `/access/*` para Apto/No apto.

-----

## 📨 Notificaciones y cron

  - **SMS (Twilio):** configurar `TWILIO_*` + `DEFAULT_SMS_COUNTRY_CODE` (`+1` por defecto).
  - **Recordatorios:** un job diario a las **09:00** (horario del server) avisa a 30/15/7 días del vencimiento al `Vendor.contactPhone`.

-----

## 🧰 OCR / extracción (opcional)

  - Con **PDF nativo**, la API extrae texto con `pdf-parse`.
  - Si no hay texto útil, con `Dockerfile.ocr` usa **tesseract** (página 1) + `poppler-utils`.
  - **Flujo:**
    1.  `POST /extract/coi/:id` ⇒ sugerencias (fechas, holder, límites, flags).
    2.  `PATCH /extract/coi/:id/apply` ⇒ aplica al COI (bajo revisión del admin).

-----

## 🧩 Recetas comunes

### Crear link público y enviarlo al proveedor/broker

```bash
# login
TOKEN=$(curl -sX POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password123"}' | jq -r .access_token)

# crear solicitud (reemplazá BID/VID)
curl -sX POST http://localhost:3000/coi/requests \
 -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
 -d '{"buildingId":"<BID>","vendorId":"<VID>","ttlHours":168}'
# te devuelve { token, expiresAt } → URL del front: /requests/<token>
```

-----

### Aprobar un COI

```bash
curl -X PATCH http://localhost:3000/cois/<COI_ID>/approve \
 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
 -d '{"notes":"OK AI + Waiver","flags":{"additionalInsured":true,"waiverOfSubrogation":true}}'
```

-----

### Control de portería

```bash
curl -H "Authorization: Bearer $TOKEN" \
 "http://localhost:3000/access/check?vendorId=<VID>&buildingId=<BID>"
```

-----

## 🐞 Troubleshooting

  - **/health 503 (DB)** → revisá `DATABASE_URL` y seguridad de RDS (SG/ACL).
  - **/health 503 (S3)** → el `S3_BUCKET` existe, y las credenciales/IAM tienen permisos para `s3:HeadBucket`, `s3:GetObject`, `s3:PutObject`.
  - **Upload falla** → creá el bucket; verificá `S3_ENDPOINT/REGION` y `S3_FORCE_PATH_STYLE` (**true** en MinIO, **false** en AWS).
  - **Twilio no envía** → ver logs; probá `POST /notifications/test-sms`; usá formato E.164 (`+1...`).
  - **argon2 falla al build** → asegurate de buildear para `x86_64` o que el toolchain esté presente (ya incluido). En runners ARM, usá `--platform linux/amd64`.
  - **OCR lento** → preferí `Dockerfile.slim` si no necesitás OCR.
  - **CORS bloquea front** → agregá tu dominio a `ALLOWED_ORIGINS`.

-----

## 🔄 Actualizaciones (deploy seguro)

1.  `git pull` / actualizar código.
2.  `docker compose -f docker-compose.prod.yml build`
3.  `docker run ... npx prisma migrate deploy`
4.  `docker compose -f docker-compose.prod.yml up -d`
5.  Chequear `GET /health` y logs.

## SendGrid
- Header: `X-Twilio-Email-Event-Webhook-Signature` + `X-Twilio-Email-Event-Webhook-Timestamp`
- Se valida HMAC-SHA256 con `SENDGRID_INBOUND_SIGNING_SECRET` sobre `timestamp + rawBody`

## Postmark
- Header: `X-Postmark-Signature`
- Se valida HMAC-SHA256 con `POSTMARK_WEBHOOK_TOKEN` sobre `rawBody`

Si ningún header de firma viene presente, el guard **permite** (modo compatible). Activa los tokens para forzar verificación.

## Configuración de webhooks

### SendGrid (Inbound Parse)
1. En SendGrid, **Settings → Inbound Parse**.
2. Agrega tu dominio/camino y apunta al endpoint:
   - `POST https://tu-dominio/api/brokers/email-in`
3. Activa `POST the raw, full MIME message` **desactivado** (preferimos JSON de adjuntos con url).  
   Si solo tienes MIME, necesitarás un parser de MIME y `FilesService` para subir a S3 (no incluido en este patch).
4. Opcional: firma `X-Twilio-Email-Event-Webhook-Signature`.

### Postmark
1. **Servers → Inbound**.
2. Webhook: `POST https://tu-dominio/api/brokers/email-in`
3. Firma `X-Postmark-Signature` (valídala en NGINX o en Nest si quieres).  
   Postmark suele enviar adjuntos embebidos (`Content` base64). Este patch **omite** adjuntos sin URL (requieren `FilesService`).
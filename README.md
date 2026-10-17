# mhwrona.es · Portafolio

Portafolio personal bilingüe (ES/EN) generado con **Astro**, servido por **NGINX sin privilegios** y desplegado en **MicroK8s** detrás de **Ingress NGINX + cert-manager**.

```
content.yaml ──► GitHub Actions (build) ──► ghcr.io/mhernandezw/portfolio ──► MicroK8s (N100, amd64)
   ▲                    │
   │                    └─ consulta la API de GitHub: repos públicos + avatar
   └─ el único fichero que editas
```

## Estructura

| Ruta | Qué es |
|---|---|
| `content.yaml` | **Todo el contenido**: perfil, experiencia, formación, cursos y ajustes de repos |
| `src/` | Código de la web (componentes Astro, estilos, textos de interfaz en `src/i18n/ui.ts`) |
| `scripts/fetch-github.mjs` | Descarga en cada build tus repos públicos y el avatar |
| `src/data/github.json` | Copia de respaldo de los repos (se usa si la API de GitHub falla) |
| `Dockerfile` / `nginx.conf` | Imagen final: NGINX unprivileged (UID 101, puerto 8080) |
| `.github/workflows/build.yml` | Construye y publica la imagen en GHCR |
| `k8s/` | Manifiestos: Namespace, Deployment, Service e Ingress |

---

## 1. Puesta en marcha (solo la primera vez)

### 1.1 Crear el repositorio y subir el código

Crea en GitHub un repositorio **público** llamado `portfolio` (si usas otro nombre, cambia la imagen en `k8s/10-deployment.yaml`).

```bash
git init -b main
git add .
git commit -m "Portafolio inicial"
git remote add origin https://github.com/mhernandezw/portfolio.git
git push -u origin main
```

El push lanza automáticamente el workflow **Build image** (pestaña *Actions*).

### 1.2 Hacer pública la imagen

La primera vez GHCR crea el paquete como **privado**. Para que MicroK8s pueda descargarlo sin credenciales:

GitHub → tu perfil → **Packages** → `portfolio` → **Package settings** → *Change visibility* → **Public**.

> La imagen solo contiene HTML/CSS/JS estático (lo mismo que verá cualquier visitante), así que publicarla no expone nada.
> Si prefieres mantenerla privada, consulta el apartado [Imagen privada](#imagen-privada).

### 1.3 DNS y red

- Registro **A** de `mhwrona.es` → IP pública de tu router.
- Puertos **80** y **443** redirigidos al N100. El 80 lo necesita Let's Encrypt (reto HTTP-01).

### 1.4 Desplegar en MicroK8s

En el servidor:

```bash
git clone https://github.com/mhernandezw/portfolio.git
cd portfolio
microk8s kubectl apply -f k8s/
```

Comprobaciones:

```bash
microk8s kubectl -n portfolio get pods,svc,ingress
microk8s kubectl -n portfolio get certificate        # READY=True cuando Let's Encrypt emite el certificado
curl -I https://mhwrona.es
```

---

## 2. Actualizar el contenido

Todo se hace en **`content.yaml`**. Tras editarlo:

```bash
git commit -am "Añadido curso X"
git push
# Espera a que termine el workflow en GitHub (≈1-2 min) y, en el servidor:
microk8s kubectl rollout restart deployment/portfolio -n portfolio
```

### Añadir un curso o certificación

```yaml
courses:
  - title: { es: "Prometheus y Grafana", en: "Prometheus & Grafana" }
    provider: "KodeKloud"          # opcional
    year: 2026
    url: https://...               # opcional: enlace verificable
    tags: [Prometheus, Grafana]
```

Se agrupan solos por año (de más reciente a más antiguo) y el contador de "cursos y titulaciones" se actualiza automáticamente.

### Añadir una titulación

```yaml
education:
  - title: { es: "Nombre del título", en: "Degree name" }
    institution: "Centro"
    year: 2027
    url: https://...               # opcional: botón "Verificar certificado"
```

### Cambiar de puesto

Pon `end: "AAAA-MM"` en el puesto actual y añade el nuevo **arriba** con `end: null`. La duración y la etiqueta "Actual" se calculan solas.

---

## 3. Añadir un home-lab o proyecto nuevo

**No hay que tocar `content.yaml`.** Todos tus repos públicos (sin forks) aparecen automáticamente.

1. Crea el repositorio **público** en GitHub.
2. Rellena **About → Description** y añade **Topics** (p. ej. `kubernetes`, `homelab`, `ansible`). La tarjeta los mostrará como descripción y etiquetas.
3. Reconstruye la imagen. Tienes dos opciones:
   - GitHub → *Actions* → **Build image** → **Run workflow**.
   - O espera al build automático de cada lunes.
4. `microk8s kubectl rollout restart deployment/portfolio -n portfolio`

### Opcional: ajustar cómo se ve un repo

En `content.yaml`, en `github.overrides`:

```yaml
github:
  exclude:
    - repo-que-no-quiero-mostrar
  overrides:
    mi-homelab:
      featured: true                 # aparece primero con la etiqueta "Destacado"
      description:
        es: "Descripción en español"
        en: "English description"
      tags: [Proxmox, Terraform]
```

---

## 4. Imagen privada

Si prefieres no hacer público el paquete de GHCR:

1. Crea un *Personal Access Token (classic)* con permiso **`read:packages`**.
2. En el servidor:
   ```bash
   microk8s kubectl -n portfolio create secret docker-registry ghcr-pull \
     --docker-server=ghcr.io \
     --docker-username=mhernandezw \
     --docker-password=<TOKEN>
   ```
3. Descomenta `imagePullSecrets` en `k8s/10-deployment.yaml` y vuelve a aplicar.

---

## 5. Desarrollo local (opcional)

Requiere Node.js 20 o superior:

```bash
npm install
npm run dev        # http://localhost:4321
```

---

## 6. Seguridad y privacidad

- Sin teléfono ni email publicados. El contacto es solo por LinkedIn y GitHub.
- Sin cookies, analítica ni peticiones a terceros. Fuentes y avatar se sirven desde el propio dominio.
- CSP estricta (`script-src 'self'`) y cabeceras de seguridad en `nginx.conf`.
- El pod cumple el perfil **restricted** de Pod Security:
  - no corre como root
  - sistema de ficheros de solo lectura
  - sin capabilities
  - seccomp `RuntimeDefault`

## 7. Resolución de problemas

```bash
# Estado general
microk8s kubectl -n portfolio get all,ingress,certificate

# El pod no arranca (ImagePullBackOff → ¿paquete público? ¿nombre de imagen correcto?)
microk8s kubectl -n portfolio describe pod -l app.kubernetes.io/name=portfolio

# Logs de NGINX
microk8s kubectl -n portfolio logs deploy/portfolio

# El certificado no se emite
microk8s kubectl -n portfolio describe certificate mhwrona-es-tls
microk8s kubectl get challenges -A
```

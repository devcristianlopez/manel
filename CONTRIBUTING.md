# Contributing to Manel

Gracias por tu interés en contribuir a Manel. Este documento describe los estándares y procesos para contribuir al proyecto.

## Tabla de contenidos

- [Código de conducta](#codigo-de-conducta)
- [Reportar bugs](#reportar-bugs)
- [Sugerir features](#sugerir-features)
- [Entorno de desarrollo](#entorno-de-desarrollo)
- [Estandares de codigo](#estandares-de-codigo)
- [Proceso de PR](#proceso-de-pr)
- [Guia de commits](#guia-de-commits)
- [Documentacion](#documentacion)

## Codigo de conducta

Este proyecto se rige por un código de conducta basado en el respeto mutuo. No se tolera discriminación, acoso ni ningún tipo de conducta que genere un entorno hostil. Al participar, aceptas mantener un ambiente colaborativo y profesional.

## Reportar bugs

Antes de reportar un bug:

1. Verifica que no exista ya un issue abierto para el mismo problema.
2. Asegúrate de estar usando la última versión.
3. Comprueba si el problema persiste tras reiniciar la aplicación.

Al reportar, incluye:

- **Título descriptivo**: Resume el problema en una línea.
- **Pasos para reproducir**: Secuencia exacta desde un estado inicial conocido.
- **Comportamiento esperado**: Qué debería ocurrir.
- **Comportamiento actual**: Qué ocurre realmente.
- **Entorno**:
  - Sistema operativo y versión.
  - Versión de Manel (se ve en `npm run dev` o en el build).
  - Versión de Node.js y npm.
- **Logs**: Captura la salida de la consola de desarrollo (DevTools del renderer o terminal del main process).
- **Evidencia**: Capturas de pantalla o vídeo si aplica.

```
### Bug: [Título breve]

**Pasos:**
1. Abrir Manel
2. Hacer clic en "Escanear ahora"
3. ...

**Esperado:** ...
**Actual:** ...

**Entorno:**
- OS: Ubuntu 24.04
- Manel: 0.1.0
- Node: 22.x
```

## Sugerir features

Antes de proponer una funcionalidad nueva:

1. Revisa los issues existentes para evitar duplicados.
2. Considera si la funcionalidad es de interés general o muy específica de tu caso.
3. Piensa en cómo se integraría con la arquitectura actual (Electron + React + IPC).

Al proponer, incluye:

- **Problema que resuelve**: ¿Qué necesidad cubre?
- **Comportamiento esperado**: Describe la feature en detalle.
- **Alternativas consideradas**: Si hay otras formas de resolverlo.
- **Impacto**: ¿Afecta rendimiento, seguridad, compatibilidad?

```
### Feature: [Nombre]

**Problema:** ...
**Solución propuesta:** ...
**Alternativas:** ...
```

## Entorno de desarrollo

### Requisitos

- Node.js 18 o superior (recomendado 20+).
- npm 9+ (o yarn/pnpm).
- Git.
- Un gestor de ventanas compatible (para desarrollo en Linux: X11 o Wayland).

### Setup inicial

```bash
git clone <repo-url>
cd manel
npm install
npm run dev
```

Esto inicia la aplicación en modo desarrollo con hot module replacement.

### Compilación

```bash
npm run build      # Compila el proyecto
npm run start      # Vista previa del build
```

### Verificación de tipos

```bash
npm run lint       # Ejecuta tsc --noEmit
```

### Testing

Los tests se ejecutan con Vitest:

```bash
npx vitest run                    # Todos los tests
npx vitest run src/main/security  # Tests de un módulo específico
npx vitest --watch                # Modo watch
```

### Depuración

- **Renderer**: Abre DevTools con `Ctrl+Shift+I` (o `Cmd+Option+I` en macOS).
- **Main process**: Los logs de `console.log` aparecen en la terminal donde se ejecuta `npm run dev`.
- **IPC**: Revisa la pestaña "Console" del DevTools para ver eventos de escaneo.

## Estandares de codigo

### TypeScript

- **strict mode**: El proyecto usa `strict: true` en tsconfig. No relajes esta configuración.
- **Tipado explícito**: Todas las funciones deben tener tipos de retorno explícitos. Evita `any`.
- **Tipos compartidos**: Los tipos usados por main y renderer van en `src/shared/types.ts`.
- **Null safety**: Prefiere `T | null` sobre `T | undefined` para valores opcionales. Usa `??` en lugar de `||` para valores null/undefined.

### Estilo

- **Indentación**: 2 espacios.
- **Comillas**: Simples (`'`) en TypeScript/JavaScript.
- **Punto y coma**: Obligatorio al final de cada sentencia.
- **Nombres**: `camelCase` para variables y funciones, `PascalCase` para clases, tipos e interfaces, `UPPER_CASE` para constantes globales.
- **Límite de línea**: 120 caracteres.

### ESLint y formato

Actualmente el proyecto no tiene ESLint configurado. Se recomienda seguir las convenciones del código existente. Si agregas ESLint, usa la configuración estándar de TypeScript:

```json
{
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

### Buenas prácticas

- **Funciones puras**: Prefiere funciones sin efectos secundarios siempre que sea posible.
- **Error handling**: Usa try/catch en handlers IPC y operaciones de sistema (CLI, fetch). Nunca dejes que una excepción crashee la app.
- **Fetch con timeout**: Todas las llamadas HTTP deben tener timeout (usa `AbortController`).
- **No bloquees el renderer**: Las operaciones pesadas (escaneo, consultas de red) van en el main process.
- **Context isolation**: No accedas a Node.js desde el renderer. Usa la API expuesta via `window.manel`.
- **Logs significativos**: Usa `console.log` con prefijo del módulo, ej: `[security-engine]`, `[update-engine]`.

## Proceso de PR

### Paso a paso

1. **Fork** el repositorio (si aplica) o crea una rama desde `main`.
2. **Crea una rama** con nombre descriptivo:
   - `feat/nombre-de-la-feature`
   - `fix/nombre-del-bug`
   - `docs/nombre-del-cambio`
   - `refactor/nombre`
3. **Desarrolla** siguiendo los estándares de código.
4. **Actualiza documentación** si tu cambio afecta la API, arquitectura o comportamiento.
5. **Ejecuta `npm run lint`** y asegúrate de que no haya errores de tipos.
6. **Ejecuta los tests** (`npx vitest run`) y verifica que pasen.
7. **Haz commit** siguiendo la guía de commits.
8. **Push** a tu rama.
9. **Abre un Pull Request** contra `main`.

### Template de PR

```markdown
## Descripción

[Descripción del cambio]

## Tipo de cambio

- [ ] Bug fix
- [ ] Nueva feature
- [ ] Refactor
- [ ] Documentación
- [ ] Dependencias

## ¿Cómo se probó?

[Descripción de las pruebas realizadas]

## Checklist

- [ ] El código sigue los estándares del proyecto
- [ ] Se actualizó la documentación si aplica
- [ ] Los tests pasan (`npx vitest run`)
- [ ] Type checking OK (`npm run lint`)
- [ ] No se introdujeron dependencias nuevas sin revisión
```

### Revisión

- Un mantenedor revisará el PR en un plazo razonable.
- Se pueden solicitar cambios. Por favor, responde a los comentarios.
- Una vez aprobado, se mergea a `main`.

## Guia de commits

Usa mensajes descriptivos en inglés:

```
feat(scanner): add support for Rust detection
fix(security): handle timeout in OSV query
docs(architecture): update IPC handler table
refactor(score): extract category calculation
```

Formato recomendado:

```
<tipo>(<ámbito>): <descripción>

- <detalle opcional>
```

Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`.

## Documentacion

- **README.md**: Documentación general del proyecto (instalación, uso, stack).
- **ARCHITECTURE.md**: Documentación técnica detallada (arquitectura, BD, IPC, decisiones).
- **CONTRIBUTING.md**: Esta guía.
- **Código**: Los cambios que introducen nuevas funcionalidades o modifican el comportamiento existente deben incluir la documentación correspondiente en el mismo PR.

## Tests

- Los tests existentes están en `src/main/security/__tests__/` y `src/main/update-engine/__tests__/`.
- Si agregas un módulo nuevo, incluye tests unitarios.
- Para funcionalidades de UI (renderer), prioriza la revisión manual guiada por los tipos.

## Preguntas

Si tienes dudas, abre un issue con la etiqueta `question`. Para discusiones técnicas más profundas, menciona a los mantenedores en el issue.

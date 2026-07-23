# Contributing to Manel

Gracias por tu interés en contribuir a Manel. Este documento describe los estándares y procesos para contribuir al proyecto.

## Tabla de contenidos

- [Código de conducta](#código-de-conducta)
- [Reportar bugs](#reportar-bugs)
- [Sugerir features](#sugerir-features)
- [Entorno de desarrollo](#entorno-de-desarrollo)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Scripts disponibles](#scripts-disponibles)
- [Estándares de código](#estándares-de-código)
- [Proceso de PR](#proceso-de-pr)
- [Guía de commits](#guía-de-commits)
- [Documentación](#documentación)

## Código de conducta

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
  - Versión de Manel (`manel --version`).
  - Versión de Node.js y npm.
- **Logs**: Captura la salida de la terminal con `--verbose`.
- **Evidencia**: Capturas de pantalla o vídeo si aplica.

```
### Bug: [Título breve]

**Pasos:**
1. Ejecutar `manel scan`
2. ...

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
3. Piensa en cómo se integraría con la arquitectura actual (CLI + Core).

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
- Linux o macOS (hardening checks solo funcionan en Linux).

### Setup inicial

```bash
git clone https://github.com/devcristianlopez/manel.git
cd manel
npm install
npm run build:cli
```

### Ejecutar en desarrollo

```bash
# Compilar y ejecutar
npm run build:cli
node bin/manel-cli.js scan

# O usar npm link para tener `manel` disponible globalmente
npm run global-link
manel scan
```

### Ejecutar tests

```bash
npm test                      # Todos los tests
npx vitest run                # Alternativa
npx vitest --watch            # Modo watch
npm run test:coverage         # Con cobertura
```

### Verificación de tipos

```bash
npm run lint                  # Ejecuta tsc --noEmit
```

## Estructura del proyecto

```
manel/
├── bin/
│   └── manel-cli.js           # Entry point (Node.js)
├── src/
│   ├── cli/                   # CLI framework
│   │   ├── commands/          # Implementación de comandos
│   │   │   ├── status.ts      # `manel status`
│   │   │   ├── scan.ts        # `manel scan`
│   │   │   ├── vulnerabilities.ts  # `manel vulnerabilities`
│   │   │   ├── hardening.ts   # `manel hardening`
│   │   │   ├── score.ts       # `manel score`
│   │   │   ├── updates.ts     # `manel updates`
│   │   │   └── schema.ts      # `manel schema`
│   │   ├── output/            # Formateadores de salida
│   │   │   ├── table-formatter.ts
│   │   │   ├── json-formatter.ts
│   │   │   ├── sarif-formatter.ts
│   │   │   └── ndjson-formatter.ts
│   │   ├── flags.ts           # Flags compartidos
│   │   ├── errors.ts          # Manejo de errores
│   │   └── index.ts           # Entry point principal
│   ├── core/                  # Lógica de negocio
│   │   ├── scanner/           # Detección de software
│   │   ├── security/          # Motor de seguridad
│   │   ├── update-engine/     # Consulta de versiones
│   │   ├── database/          # Persistencia SQLite
│   │   └── index.ts           # Barrel export
│   └── shared/
│       └── types.ts           # Tipos compartidos
├── package.json
├── tsconfig.json              # Config TypeScript base
├── tsconfig.cli.json          # Config TypeScript para CLI
├── vitest.config.ts           # Config de tests
└── CONTRIBUTING.md
```

### Módulos clave

| Módulo | Responsabilidad |
|--------|-----------------|
| `cli/commands/` | Un archivo por comando, cada uno exporta `registerXCommand()` |
| `cli/output/` | Un formateador por formato (table, json, sarif, ndjson) |
| `core/scanner/` | Detección de software via `execSync()` |
| `core/security/` | Consulta de vulnerabilidades y hardening |
| `core/update-engine/` | Consulta de últimas versiones |
| `core/database/` | Operaciones SQLite |
| `shared/types.ts` | Tipos TypeScript compartidos |

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run build:cli` | Compilar TypeScript a JavaScript |
| `npm run global-link` | Instalar `manel` globalmente via npm link |
| `npm test` | Ejecutar suite de tests (Vitest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:coverage` | Tests con reporte de cobertura |
| `npm run lint` | Verificación de tipos TypeScript |

## Estándares de código

### TypeScript

- **strict mode**: El proyecto usa `strict: false` en `tsconfig.cli.json` por compatibilidad. Si contribuyes, evita `any` cuando sea posible.
- **Tipado explícito**: Funciones públicas deben tener tipos de retorno explícitos.
- **Tipos compartidos**: Los tipos usados por CLI y Core van en `src/shared/types.ts`.
- **Null safety**: Prefiere `T | null` sobre `T | undefined`. Usa `??` en lugar de `||`.

### Estilo

- **Indentación**: 2 espacios.
- **Comillas**: Simples (`'`) en TypeScript/JavaScript.
- **Punto y coma**: Obligatorio al final de cada sentencia.
- **Nombres**: `camelCase` para variables y funciones, `PascalCase` para clases/tipos, `UPPER_CASE` para constantes.
- **Límite de línea**: 120 caracteres.

### Commander.js

- Cada comando se registra con `registerXCommand(program)`.
- Usa las opciones de `flags.ts` para flags compartidos.
- El handler recibe `CommonFlags` como tipo.
- Retorna un exit code numérico (0, 1, 2, 3).

```typescript
// Ejemplo de patrón de comando
export function registerMyCommand(program: Command): void {
  program
    .command('my-command')
    .description('Description here')
    .option(...COMMON_OPTIONS)
    .option(...OUTPUT_OPTIONS)
    .action(async (options: CommonFlags) => {
      await executeMyCommand(options)
    })
}

async function executeMyCommand(options: CommonFlags): Promise<number> {
  // Implementación
  return 0
}
```

### Output Engine

- Cada formateador implementa `FormatterFn<T>`.
- Usa `FormatOptions` para controlar colores, pretty-print, etc.
- El output va a stdout, los errores a stderr.

### Buenas prácticas

- **Funciones puras**: Prefiere funciones sin efectos secundarios en Core.
- **Error handling**: Usa try/catch en handlers de comandos. Nunca dejes que una excepción crashee la app.
- **Fetch con timeout**: Todas las llamadas HTTP deben tener timeout (usa `AbortController`).
- **Logs significativos**: Usa `console.error` con prefijo del módulo para stderr, `console.log` para stdout.
- **Exit codes**: Respeta los códigos de salida semánticos (0=éxito, 1=hallazgos, 2=error, 3=input inválido).

## Proceso de PR

### Paso a paso

1. **Fork** el repositorio (si aplica) o crea una rama desde `main`.
2. **Crea una rama** con nombre descriptivo:
   - `feat/nombre-de-la-feature`
   - `fix/nombre-del-bug`
   - `docs/nombre-del-cambio`
   - `refactor/nombre`
3. **Desarrolla** siguiendo los estándares de código.
4. **Compila** el CLI: `npm run build:cli`
5. **Ejecuta los tests**: `npm test`
6. **Verifica tipos**: `npm run lint`
7. **Actualiza documentación** si tu cambio afecta la API, arquitectura o comportamiento.
8. **Haz commit** siguiendo la guía de commits.
9. **Push** a tu rama.
10. **Abre un Pull Request** contra `main`.

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
- [ ] Se ejecutó `npm run build:cli` sin errores
- [ ] Los tests pasan (`npm test`)
- [ ] Type checking OK (`npm run lint`)
- [ ] Se actualizó la documentación si aplica
- [ ] No se introdujeron dependencias nuevas sin revisión
```

### Revisión

- Un mantenedor revisará el PR en un plazo razonable.
- Se pueden solicitar cambios. Por favor, responde a los comentarios.
- Una vez aprobado, se mergea a `main`.

## Guía de commits

Usa mensajes descriptivos en inglés:

```
feat(scanner): add support for Rust detection
fix(security): handle timeout in OSV query
docs(architecture): update CLI architecture diagram
refactor(score): extract category calculation
```

Formato recomendado:

```
<tipo>(<ámbito>): <descripción>

- <detalle opcional>
```

Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`.

## Documentación

- **README.md**: Documentación general del proyecto (instalación, uso, comandos).
- **ARCHITECTURE.md**: Documentación técnica detallada (arquitectura, tipos, decisiones).
- **CONTRIBUTING.md**: Esta guía.
- **Código**: Los cambios que introducen nuevas funcionalidades o modifican el comportamiento existente deben incluir la documentación correspondiente en el mismo PR.

## Tests

- Los tests existentes están en `src/core/__tests__/`, `src/cli/__tests__/`, `src/cli/commands/__tests__/` y `src/cli/output/__tests__/`.
- Si agregas un módulo nuevo, incluye tests unitarios.
- Para funcionalidades de CLI, prioriza tests de integración que verifiquen el output.

### Ejecutar tests específicos

```bash
# Tests de un módulo específico
npx vitest run src/core/security
npx vitest run src/cli/commands

# Test individual
npx vitest run src/cli/output/json-formatter.test.ts
```

## Preguntas

Si tienes dudas, abre un issue con la etiqueta `question`. Para discusiones técnicas más profundas, menciona a los mantenedores en el issue.

---
name: react-nextjs-best-practices
description: Best practices for React and Next.js App Router in SwimLog to avoid network waterfalls and optimize rendering.
---

# React & Next.js App Router - Buenas Prácticas

Este skill proporciona directrices de desarrollo para componentes de React y la arquitectura de Next.js App Router (v15/v16) en SwimLog.

---

## 1. React Server Components (RSC) vs. Client Components

- **RSC por defecto**: Todos los componentes en `src/app/` y `src/components/` deben ser Server Components por defecto.
- **Client Components restringidos**: Usa la directiva `"use client"` únicamente cuando el componente requiera:
  - Hooks de estado o ciclo de vida (`useState`, `useReducer`, `useEffect`, `useLayoutEffect`).
  - Listeners de eventos del navegador (ej. `onClick`, `onChange`, `onSubmit`, grabación de audio).
  - Web APIs exclusivas de cliente (ej. `MediaRecorder`, `AudioContext`, `localStorage`).
- **Separación de Lógica**: Mantener los componentes de cliente lo más pequeños posible en la hoja del árbol. Si un componente de cliente pesado requiere renderizar datos estáticos o de servidor, pásalos como `children` o mediante `props`.

---

## 2. Prevención de Waterfalls de Red

- **Paralelización de Cargas**: Evita `await` secuenciales para datos independientes.
  - *Incorrecto*:
    ```typescript
    const user = await getUser();
    const settings = await getSettings(); // Espera innecesariamente a getUser()
    ```
  - *Correcto*:
    ```typescript
    const [user, settings] = await Promise.all([getUser(), getSettings()]);
    ```
- **Carga Diferida**: Usa `next/dynamic` para importar componentes que no se renderizan en la carga inicial (ej. modales de edición, paneles de gráficos secundarios).

---

## 3. Compatibilidad con Next.js 15/16 (APIs Asíncronas)

- **Parámetros de Ruta**: En las páginas y rutas dinámicas, `params` y `searchParams` son promesas y deben ser resueltas antes de leer sus propiedades.
  - *Correcto en Page*:
    ```typescript
    interface PageProps {
      params: Promise<{ id: string }>;
      searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
    }
    
    export default async function Page({ params, searchParams }: PageProps) {
      const { id } = await params;
      const { query } = await searchParams;
      // ...
    }
    ```
- **Cookies y Headers**: El acceso a `cookies()` y `headers()` es asíncrono.
  - *Correcto*:
    ```typescript
    import { cookies } from 'next/headers';
    
    const cookieStore = await cookies();
    const token = cookieStore.get('token');
    ```

---

## 4. API Routes (Route Handlers)

- **App Router Standard**: Define las API Routes en archivos `route.ts`. Utiliza la firma estándar `export async function GET/POST(request: Request)`.
- **Parser de Cuerpo**: No uses `export const config = { api: { bodyParser: false } }` en App Router, ya que está obsoleto y provoca advertencias de compilación. En su lugar, lee el cuerpo asíncronamente con `await request.json()` o `await request.formData()`.

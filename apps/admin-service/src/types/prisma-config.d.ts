/* Minimal ambient declaration for `prisma/config` used by prisma.config.ts
   This file supplies the small surface area of types the project needs and
   avoids editor "Cannot find module 'prisma/config'" errors. Replace with
   more precise types if/when `prisma` exports them from your workspace.
*/
declare module 'prisma/config' {
  // defineConfig is a simple identity helper used by Prisma's CLI config.
  export function defineConfig<T extends Record<string, any>>(config: T): T;

  // env helper returns typed environment variable values. Keep it minimal.
  export function env<K extends string = string>(key: K): string;
  export function env<T = string>(key: string): T;

  // other helpers may be added here if needed later
}

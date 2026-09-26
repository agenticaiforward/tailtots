/**
 * Domain layer barrel: pure business logic and types, zero I/O.
 *
 * UI, services, and tests import from `@/lib/domain`. Nothing in this
 * directory may import from `lib/data`, `lib/services`, or `app/`.
 */
export * from "./family-types";
export * from "./starter-data";
export * from "./family";
export * from "./missions";
export * from "./badges";
export * from "./bank";
export * from "./readiness";

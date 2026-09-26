/**
 * Data layer barrel: the only modules allowed to touch Supabase, Drizzle,
 * or browser storage. UI and services import from here, never from the
 * Supabase SDK directly.
 */
export * from "./supabase-client";
export * from "./auth";
export * from "./engagement";
export * from "./family-repository";

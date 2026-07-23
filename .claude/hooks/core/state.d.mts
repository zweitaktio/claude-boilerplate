// Type declarations for core/state.mjs (per-session scratch state under tmpdir).
export declare function statePath(name: string): string
export declare function read(name: string, fallback?: string | null): string | null
export declare function write(name: string, value: string | number): void
export declare function append(name: string, line: string): void
export declare function clear(name: string): void
export declare function ageSeconds(name: string): number
export declare function readLines(name: string): string[]
export declare function hasLine(name: string, line: string): boolean

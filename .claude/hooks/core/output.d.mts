// Type declarations for core/output.mjs (runtime stays .mjs for node/bun compatibility).
export declare function deny(hookEvent: string, reason: string): never
export declare function inject(hookEvent: string, context: string): never
export declare function pass(): never

/// <reference types="node" />
import Module from "module";
/**
 * Produce a new requirefire instance.
 */
declare const createRequirefire: () => {
    (path: string): any;
    cache: Record<string, Module>;
};
export declare type Requirefire = ReturnType<typeof createRequirefire>;
export default createRequirefire;

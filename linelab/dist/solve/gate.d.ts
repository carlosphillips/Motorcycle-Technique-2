import type { ExpectBlock, FigureResult, GateReport } from "./types.js";
export interface GateOptions {
    readonly expect?: Readonly<Record<string, ExpectBlock>>;
}
export declare function gateFigure(envelope: FigureResult, opts?: GateOptions): GateReport;

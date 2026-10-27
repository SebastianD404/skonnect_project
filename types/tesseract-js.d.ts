declare module "tesseract.js" {
  export const PSM: {
    AUTO: string;
    SPARSE_TEXT: string;
  };

  export type WorkerOptions = {
    workerPath?: string;
    corePath?: string;
    langPath?: string;
    workerBlobURL?: boolean;
  };

  export type ImageLike =
    | string
    | Uint8Array
    | File
    | Blob
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | OffscreenCanvas
    | CanvasRenderingContext2D;

  export type Worker = {
    setParameters(params: Record<string, string>): Promise<unknown>;
    recognize(image: ImageLike): Promise<{
      data: {
        confidence: number;
        text: string;
      };
    }>;
    terminate(): Promise<unknown>;
  };

  export function createWorker(
    langs?: string | string[],
    oem?: number,
    options?: WorkerOptions,
    config?: string | Record<string, string>,
  ): Promise<Worker>;
}

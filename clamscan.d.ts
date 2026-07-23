declare module "clamscan" {
  import type { Readable } from "node:stream";

  type ClamScanClient = {
    scanStream: (
      stream: Readable,
    ) => Promise<{ isInfected: boolean; viruses?: string[] }>;
    ping: () => Promise<unknown>;
  };

  class NodeClam {
    init(options: Record<string, unknown>): Promise<ClamScanClient>;
  }

  export default NodeClam;
}

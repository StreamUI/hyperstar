/**
 * Sprites utilities for the deploy server
 *
 * Handles tar.gz extraction for uploaded bundles.
 */
import { createGunzip } from "node:zlib"
import { Readable } from "node:stream"
import { extract } from "tar-stream"

export interface ExtractedFile {
  path: string
  content: Buffer
}

/**
 * Extract files from a tar.gz buffer
 */
export async function extractTarGz(buffer: ArrayBuffer): Promise<ExtractedFile[]> {
  return new Promise((resolve, reject) => {
    const files: ExtractedFile[] = []
    const gunzip = createGunzip()
    const extractor = extract()

    extractor.on("entry", (header, stream, next) => {
      const chunks: Buffer[] = []

      stream.on("data", (chunk: Buffer) => chunks.push(chunk))
      stream.on("end", () => {
        // Only include files, not directories
        if (header.type === "file") {
          files.push({
            path: header.name,
            content: Buffer.concat(chunks),
          })
        }
        next()
      })
      stream.on("error", reject)

      stream.resume()
    })

    extractor.on("finish", () => resolve(files))
    extractor.on("error", reject)

    // Pipe buffer through gunzip then extractor
    const readable = new Readable()
    readable.push(Buffer.from(buffer))
    readable.push(null)

    readable.pipe(gunzip).pipe(extractor)
  })
}

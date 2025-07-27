// utils/chunker.js

// This function now correctly handles the binary data from the compressor.
export async function chunkFile(data, chunkSize = 16 * 1024) {
  const chunks = [];
  let offset = 0;
  // Use .byteLength, which is correct for binary data (Uint8Array)
  const totalLength = data.byteLength;

  while (offset < totalLength) {
    // Use the .slice() method for binary data
    const chunk = data.slice(offset, offset + chunkSize);
    chunks.push(chunk.buffer); // Push the underlying ArrayBuffer
    offset += chunkSize;
  }

  return chunks;
}

// This function is already correct.
export function reassembleChunks(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  return combined.buffer;
}
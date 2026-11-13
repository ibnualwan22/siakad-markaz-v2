import { ASSET_MAX_BYTES } from "./denah-scene";

/** Validate a self-contained static GLB before storing or handing it to a browser. */
export function validateGlb(bytes: Uint8Array): { vertices: number } {
  const invalid = (message = "Berkas bukan GLB 2.0 yang valid."): never => { throw new Error(message); };
  if (bytes.byteLength < 28 || bytes.byteLength > ASSET_MAX_BYTES) invalid("Ukuran GLB harus di bawah 3 MiB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) invalid();
  const jsonSize = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || jsonSize > 512 * 1024 || jsonSize % 4 || 20 + jsonSize + 8 > bytes.length) invalid();
  let doc: Record<string, unknown>;
  try { doc = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonSize))); } catch { return invalid(); }
  const object = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
    return v as Record<string, unknown>;
  };
  const list = (v: unknown): unknown[] => { if (!Array.isArray(v)) return invalid(); return v; };
  object(doc);
  if (object(doc.asset).version !== "2.0") invalid();
  const binOffset = 20 + jsonSize;
  const binSize = view.getUint32(binOffset, true);
  if (view.getUint32(binOffset + 4, true) !== 0x004e4942 || binOffset + 8 + binSize !== bytes.length) invalid();
  const buffers = list(doc.buffers);
  if (buffers.length !== 1 || !Number.isInteger(object(buffers[0]).byteLength) || Number(object(buffers[0]).byteLength) < 1 || Number(object(buffers[0]).byteLength) > binSize) invalid();
  function embedded(value: unknown, depth = 0) {
    if (depth > 40) invalid();
    if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
      if (key === "uri") invalid("Sertakan tekstur dan buffer di dalam GLB; tautan atau berkas luar tidak didukung.");
      embedded(child, depth + 1);
    }
  }
  embedded(doc);
  const unsupported = ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu", "EXT_texture_webp", "EXT_texture_avif", "EXT_mesh_gpu_instancing"];
  if ([...(doc.extensionsUsed as string[] ?? []), ...(doc.extensionsRequired as string[] ?? [])].some(e => unsupported.includes(e))) invalid("Ekspor GLB tanpa kompresi Draco/Meshopt/KTX2, dengan tekstur PNG atau JPEG.");
  for (const input of list(doc.bufferViews ?? [])) {
    const v = object(input), start = v.byteOffset ?? 0, size = v.byteLength;
    if (v.buffer !== 0 || !Number.isInteger(start) || !Number.isInteger(size) || Number(start) < 0 || Number(size) < 0 || Number(start) + Number(size) > binSize) invalid();
  }
  const images = list(doc.images ?? []);
  if (images.length > 16) invalid("Maksimal 16 tekstur per model.");
  for (const input of images) {
    const image = object(input);
    if (!["image/png", "image/jpeg"].includes(String(image.mimeType)) || !Number.isInteger(image.bufferView)) invalid("Gunakan tekstur PNG/JPEG yang tertanam dalam GLB.");
    const imageView = object(list(doc.bufferViews)[Number(image.bufferView)]);
    const start = binOffset + 8 + Number(imageView.byteOffset ?? 0), length = Number(imageView.byteLength);
    const data = bytes.subarray(start, start + length);
    let width = 0, height = 0;
    if (image.mimeType === "image/png" && length >= 24 && data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71) {
      const header = new DataView(data.buffer, data.byteOffset, data.byteLength); width = header.getUint32(16); height = header.getUint32(20);
    } else if (image.mimeType === "image/jpeg" && data[0] === 255 && data[1] === 216) {
      for (let p = 2; p + 8 < data.length;) {
        if (data[p] !== 255) break;
        const marker = data[p + 1], size = (data[p + 2] << 8) + data[p + 3];
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) { height = (data[p + 5] << 8) + data[p + 6]; width = (data[p + 7] << 8) + data[p + 8]; break; }
        if (size < 2 || p + 2 + size > data.length) break;
        p += 2 + size;
      }
    }
    if (!width || !height || width > 2048 || height > 2048) invalid("Tekstur PNG/JPEG harus valid, maksimal 2048 × 2048 piksel.");
  }
  const accessors = list(doc.accessors), meshes = list(doc.meshes), nodes = list(doc.nodes);
  if (!meshes.length || nodes.length > 500) invalid("Model kosong atau memiliki terlalu banyak bagian (maksimal 500).");
  const counts = meshes.map(input => list(object(input).primitives).reduce<number>((sum, input) => {
    const primitive = object(input), position = object(primitive.attributes).POSITION;
    if (!Number.isInteger(position) || !accessors[Number(position)]) return invalid();
    const count = object(accessors[Number(position)]).count;
    if (!Number.isInteger(count) || Number(count) < 1 || Number(count) > 100000) return invalid("Model maksimal 100.000 vertex.");
    if (primitive.indices !== undefined) {
      const indices = accessors[Number(primitive.indices)];
      if (!indices || Number(object(indices).count) > 600000) invalid("Jumlah segitiga model terlalu besar.");
    }
    return sum + Number(count);
  }, 0));
  let vertices = 0;
  const visiting = new Set<number>(), visited = new Set<number>();
  function visit(index: number) {
    if (!Number.isInteger(index) || !nodes[index] || visiting.has(index)) invalid("Struktur bagian model tidak valid.");
    if (visited.has(index)) return;
    visiting.add(index);
    const node = object(nodes[index]);
    if (node.mesh !== undefined) {
      if (!Number.isInteger(node.mesh) || counts[Number(node.mesh)] === undefined) invalid();
      vertices += counts[Number(node.mesh)];
    }
    for (const child of list(node.children ?? [])) visit(Number(child));
    visiting.delete(index); visited.add(index);
  }
  nodes.forEach((_, i) => visit(i));
  if (!vertices || vertices > 100000) invalid("Model maksimal 100.000 vertex. Sederhanakan model terlebih dahulu.");
  return { vertices };
}

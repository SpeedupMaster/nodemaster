import type { NodeItem } from "../types";

/** Client import link for a node (ss:// or vless:// Reality), or null for probe-only nodes */
export function buildNodeShareUrl(node: NodeItem): string | null {
  if (node.protocol === "shadowsocks" && node.shadowsocks) {
    const auth = btoa(`${node.shadowsocks.method}:${node.shadowsocks.password}`);
    return `ss://${auth}@${node.ip}:${node.port}#${encodeURIComponent(node.name)}`;
  }
  if (!node.reality) return null;
  const r = node.reality;
  return `vless://${r.uuid}@${node.ip}:${node.port}?type=tcp&security=reality&pbk=${r.publicKey}&fp=${r.fingerprint}&sni=${r.serverName}&sid=${r.shortId}&spx=%2F&flow=${r.flow}#${encodeURIComponent(node.name)}`;
}

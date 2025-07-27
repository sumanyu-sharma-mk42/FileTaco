// utils/compressor.js

class Node {
  constructor(byte, freq, left = null, right = null) {
    this.byte = byte;
    this.freq = freq;
    this.left = left;
    this.right = right;
  }
}

function buildFrequencyMap(data) {
  const freqMap = new Map();
  for (const byte of data) {
    freqMap.set(byte, (freqMap.get(byte) || 0) + 1);
  }
  return freqMap;
}

function buildHuffmanTree(freqMap) {
  const nodes = Array.from(freqMap.entries()).map(
    ([byte, freq]) => new Node(byte, freq)
  );

  if (nodes.length === 0) return null;
  if (nodes.length === 1) {
      // Edge case for files with only one unique byte
      return new Node(null, nodes[0].freq, nodes[0], null);
  }

  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    const left = nodes.shift();
    const right = nodes.shift();
    const parent = new Node(null, left.freq + right.freq, left, right);
    nodes.push(parent);
  }

  return nodes[0];
}

function generateCodes(node, prefix = "", codeMap = {}) {
  if (!node) return;
  if (node.byte !== null) {
    // If the tree has only one node, assign a default code.
    codeMap[node.byte] = prefix || "0";
    return;
  }
  generateCodes(node.left, prefix + "0", codeMap);
  generateCodes(node.right, prefix + "1", codeMap);
}

function encodeData(data, codeMap) {
  let bitString = "";
  for (const byte of data) {
    bitString += codeMap[byte];
  }
  return bitString;
}

function pack(bitString) {
  const padding = (8 - (bitString.length % 8)) % 8;
  const paddedString = bitString + "0".repeat(padding);

  const buffer = new Uint8Array(paddedString.length / 8);
  for (let i = 0; i < paddedString.length; i += 8) {
    buffer[i / 8] = parseInt(paddedString.substring(i, i + 8), 2);
  }

  return { buffer, padding };
}

function serializeTree(node) {
    if (!node) return null;
    return {
        b: node.byte,
        l: serializeTree(node.left),
        r: serializeTree(node.right)
    };
}

function deserializeTree(obj) {
    if (!obj) return null;
    return new Node(
        obj.b,
        0, // Frequency is not needed for decompression
        deserializeTree(obj.l),
        deserializeTree(obj.r)
    );
}

export async function compress(file) {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Data = new Uint8Array(arrayBuffer);

  const freqMap = buildFrequencyMap(uint8Data);
  const tree = buildHuffmanTree(freqMap);
  
  if (!tree) {
    return { encoded: new Uint8Array(), tree: null, padding: 0 };
  }

  const codeMap = {};
  generateCodes(tree, "", codeMap);

  const bitString = encodeData(uint8Data, codeMap);
  const { buffer, padding } = pack(bitString);

  return {
    encoded: Array.from(buffer), // Convert to plain array for JSON
    tree: serializeTree(tree),
    padding,
  };
}

function unpack(buffer, padding) {
  let bitString = "";
  for (const byte of buffer) {
    bitString += byte.toString(2).padStart(8, "0");
  }
  return bitString.slice(0, bitString.length - padding);
}

function decodeData(bitString, tree) {
  if (!bitString || !tree) return new Uint8Array();

  const output = [];
  let currentNode = tree;

  for (const bit of bitString) {
    if (bit === "0") {
      currentNode = currentNode.left;
    } else {
      currentNode = currentNode.right;
    }

    if (currentNode && currentNode.byte !== null) {
      output.push(currentNode.byte);
      currentNode = tree;
    }
  }

  return new Uint8Array(output);
}

export function decompress({ encoded, tree, padding }) {
  const treeObj = deserializeTree(tree);
  const buffer = new Uint8Array(encoded);
  const bitString = unpack(buffer, padding);
  return decodeData(bitString, treeObj);
}
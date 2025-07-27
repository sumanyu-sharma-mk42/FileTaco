import React, { useState, useRef, useEffect } from "react";
import SimplePeer from "simple-peer";
import { compress, decompress } from "../utils/compressor.js";
import { chunkFile, reassembleChunks } from "../utils/chunker.js";
import { useParams, useLocation } from "react-router-dom";

const SIGNALING_SERVER = "ws://localhost:5000";

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

const shouldSkipCompression = (file) => {
  const uncompressibleTypes = [
    'image/jpeg',
    'image/png',
    'application/zip',
    'video/mp4',
    'audio/mpeg',
    'application/pdf'
  ];
  const minSizeForCompression = 10 * 1024;
  if (file.size < minSizeForCompression) return true;
  if (uncompressibleTypes.includes(file.type)) return true;
  return false;
};

const FileTransfer = ({ isSender }) => {
  const { roomId } = useParams();
  const location = useLocation();
  const ws = useRef(null);
  const peer = useRef(null);
  const [file, setFile] = useState(isSender ? location.state?.file : null);
  const [receivedFileMeta, setReceivedFileMeta] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [status, setStatus] = useState("Connecting to signaling server...");
  const [peerConnected, setPeerConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ws.current = new WebSocket(SIGNALING_SERVER);
    ws.current.onopen = () => {
      setStatus("Waiting for peer...");
      ws.current.send(JSON.stringify({ type: "join", roomId }));
    };
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "create_offer":
          setStatus("Peer found. Creating connection offer...");
          initializePeer(true);
          break;
        case "offer":
          setStatus("Received connection offer. Responding...");
          initializePeer(false);
          peer.current.signal(data.payload);
          break;
        case "answer":
          peer.current?.signal(data.payload);
          break;
        case "peer_disconnected":
          setStatus("Peer has disconnected.");
          setPeerConnected(false);
          peer.current?.destroy();
          peer.current = null;
          break;
      }
    };
    ws.current.onerror = (err) => console.error("WebSocket error:", err);
    ws.current.onclose = () => {
      if (status !== 'Peer has disconnected.') setStatus("Signaling connection lost.");
      setPeerConnected(false);
    };
    return () => {
      ws.current?.close();
      peer.current?.destroy();
    };
  }, [roomId]);

  const initializePeer = (initiator) => {
    if (peer.current) return;
    peer.current = new SimplePeer({ initiator, trickle: false });

    peer.current.on("signal", (data) => {
      const type = data.type === "offer" ? "offer" : "answer";
      ws.current.send(JSON.stringify({ type, roomId, payload: data }));
    });

    peer.current.on("connect", () => {
      setPeerConnected(true);
      setStatus("✅ Peer connected! Ready for transfer.");
      if (isSender && file) sendFile();
    });

    const receivedChunks = [];
    peer.current.on("data", (data) => {
      try {
        const messageString = (data instanceof ArrayBuffer || data instanceof Buffer)
          ? new TextDecoder().decode(data)
          : data;
        const message = JSON.parse(messageString);

        if (message.type === "chunk") {
          const chunkBuffer = base64ToBuffer(message.payload);
          receivedChunks.push(chunkBuffer);
          setStatus(`Receiving file... (${receivedChunks.length} chunks)`);
        } else if (message.type === "eof") {
          setReceivedFileMeta(message.metadata);
          const receivedBuffer = reassembleChunks(receivedChunks);
          let finalData;

          if (message.metadata.compressed) {
            const compressedObj = {
              encoded: receivedBuffer,
              tree: message.metadata.tree,
              padding: message.metadata.padding,
            };
            finalData = decompress(compressedObj);
          } else {
            finalData = receivedBuffer;
          }

          const blob = new Blob([finalData], { type: message.metadata.type });
          setDownloadUrl(URL.createObjectURL(blob));
          setStatus("✅ File ready for download!");
        }
      } catch (error) {
        setStatus("Error processing received data.");
      }
    });

    peer.current.on("error", (err) => {
      setStatus(`Connection error: ${err.message}`);
      setPeerConnected(false);
    });

    peer.current.on("close", () => {
      if (peerConnected) setStatus("Peer has disconnected.");
      setPeerConnected(false);
      peer.current = null;
    });
  };

  const sendFile = async () => {
    if (!file || !peer.current?.connected) return;
    let binaryData, eofMetadata;

    if (shouldSkipCompression(file)) {
      binaryData = new Uint8Array(await file.arrayBuffer());
      eofMetadata = { compressed: false };
    } else {
      setStatus("Compressing file...");
      const { encoded, tree, padding } = await compress(file);
      binaryData = new Uint8Array(encoded);
      eofMetadata = { compressed: true, tree, padding };
    }

    const chunks = await chunkFile(binaryData);
    setStatus(`Sending 0/${chunks.length} chunks...`);
    let chunkIndex = 0;
    const HIGH_WATER_MARK = 1 * 1024 * 1024;

    const sendNextChunk = () => {
      const channel = peer.current?._channel;
      if (!channel) return;

      while (chunkIndex < chunks.length && channel.bufferedAmount <= HIGH_WATER_MARK) {
        const message = JSON.stringify({ type: "chunk", payload: bufferToBase64(chunks[chunkIndex]) });
        peer.current.send(message);
        chunkIndex++;
        if (chunkIndex % 100 === 0) {
          setStatus(`Sending ${chunkIndex}/${chunks.length} chunks...`);
        }
      }

      if (chunkIndex < chunks.length) {
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null;
          sendNextChunk();
        };
      } else {
        peer.current.send(JSON.stringify({
          type: "eof",
          metadata: {
            name: file.name,
            type: file.type,
            ...eofMetadata
          }
        }));
        setStatus("✅ File sent successfully!");
      }
    };

    sendNextChunk();
  };

  const ShareLink = () => {
    const link = `${window.location.origin}/receive/${roomId}`;
    const handleCopy = () => {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    };

    return (
      <div style={{
        background: "#1e1e1e",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "20px",
        border: "1px solid #333"
      }}>
        <p style={{ fontWeight: "600", marginBottom: "10px", color: "#fff" }}>🔗 Share this link:</p>
        <input
          type="text"
          value={link}
          readOnly
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "5px",
            border: "1px solid #444",
            backgroundColor: "#2b2b2b",
            color: "#ccc"
          }}
        />
        <button
          onClick={handleCopy}
          style={{
            marginTop: "10px",
            padding: "10px 20px",
            backgroundColor: copied ? "#16a34a" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0e0e0e",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "monospace",
      padding: "20px",
      color: "#ffffff"
    }}>
      <div style={{ width: "100%", maxWidth: "700px", textAlign: "center" }}>
        <h2 style={{ fontSize: "28px", marginBottom: "12px" }}>
          {isSender ? "👨‍🍳 Sender Kitchen" : "📥 Receiver Counter"}
        </h2>

        <p style={{ color: "#a1a1aa", marginBottom: "24px" }}>
          {isSender
            ? "// Cooking your file into tasty chunks... 🌮"
            : "// Waiting at the counter... your spicy file will arrive soon!"}
        </p>

        {isSender && <ShareLink />}

        <div style={{
          backgroundColor: peerConnected ? "#14532d" : "#78350f",
          padding: "12px 16px",
          borderRadius: "6px",
          marginBottom: "20px",
          color: "#f3f3f3",
          fontSize: "14px"
        }}>
          Status: {status}
        </div>

        {isSender && file && (
          <div style={{ marginBottom: "20px" }}>
            <h3>File to send:</h3>
            <p>📁 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
          </div>
        )}

        {downloadUrl && !isSender && (
          <div style={{ marginTop: "20px" }}>
            <h3>Download received file:</h3>
            <a href={downloadUrl} download={receivedFileMeta?.name || "received_file"}>
              <button style={{
                padding: "12px 24px",
                backgroundColor: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "16px"
              }}>
                ⬇️ Download File
              </button>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileTransfer;

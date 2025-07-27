import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { Upload, CheckCircle, Loader2, Send } from "lucide-react";

function Home() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const handleGenerateAndStart = () => {
    if (!selectedFile) {
      document.getElementById("alert_modal").showModal();
      return;
    }

    setIsGenerating(true);
    const newRoomId = uuidv4();
    navigate(`/send/${newRoomId}`, { state: { file: selectedFile } });
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md  rounded-xl p-6 shadow-lg">
        <div className="flex flex-col items-center mb-20">
          <img
            src="FileTacoLogo3.png"
            alt="FileTaco Logo"
            className="w-72 h-auto animate-float"
          />
          <p className="mt-4 text-green-400 text-sm font-mono text-center">
            // Chunk it. Wrap it. Send it. The FileTaco way 🌯
          </p>
        </div>

        <h1 className="text-3xl font-bold text-center mb-6">FileTaco</h1>

        {/* File input */}
        <label
          htmlFor="file-upload"
          className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 transition text-white font-medium py-2 px-4 rounded-lg cursor-pointer w-full"
        >
          <Upload className="h-5 w-5" />
          {selectedFile ? "Change File" : "Select a File"}
        </label>
        <input
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* File selected display */}
        {selectedFile && (
          <div className="bg-green-700 bg-opacity-20 border border-green-500 text-green-300 rounded-md p-4 mt-4 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <strong>File Selected</strong>
            </div>
            <div className="truncate">{selectedFile.name}</div>
            <div className="text-xs">
              ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleGenerateAndStart}
          disabled={!selectedFile || isGenerating}
          className={`mt-6 w-full py-2 rounded-lg flex items-center justify-center font-semibold transition ${
            !selectedFile || isGenerating
              ? "bg-gray-600 text-gray-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Get Sharable Link
            </>
          )}
        </button>
      </div>

      {/* Alert Modal */}
      <dialog id="alert_modal" className="modal">
        <div className="modal-box bg-zinc-900 text-white border border-zinc-700">
          <h3 className="font-bold text-lg">Heads up!</h3>
          <p className="py-4">Please select a file before generating a link.</p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-outline btn-accent">Close</button>
            </form>
          </div>
        </div>
      </dialog>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default Home;

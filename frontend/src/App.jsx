import { BrowserRouter, Routes, Route } from "react-router-dom";
import FileTransfer from "./components/FileTransfer.jsx";
import Home from "./components/Home.jsx"; // where you generate roomId and redirect

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/send/:roomId" element={<FileTransfer isSender={true} />} />
        <Route path="/receive/:roomId" element={<FileTransfer isSender={false} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
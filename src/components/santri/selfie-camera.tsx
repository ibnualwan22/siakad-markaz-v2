"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCcw, Send, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type Props = {
  perizinanId: string;
  onClose: () => void;
  onSuccess: (selfieUrl: string, selfieAt: string) => void;
};

export default function SelfieCamera({ perizinanId, onClose, onSuccess }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    // Start Camera
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((s) => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch((err) => {
        console.error("Kamera tidak dapat diakses:", err);
        toast.error("Gagal mengakses kamera");
        onClose();
      });

    // Clock
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB"
      );
    }, 1000);

    return () => {
      clearInterval(timer);
      stopCamera();
    };
  }, []);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        // Set canvas to video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Draw Timestamp
        ctx.font = "bold 24px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "right";
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText(currentTime, canvas.width - 20, canvas.height - 30);
        
        // Output format
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setCapturedImage(dataUrl);
      }
    }
  };

  const uploadPhoto = async () => {
    if (!capturedImage) return;
    
    setIsUploading(true);
    try {
      const res = await fetch("/api/santri/me/perizinan/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perizinanId, image: capturedImage }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah foto");
      
      toast.success("Konfirmasi kehadiran berhasil!");
      onSuccess(data.selfieUrl, data.selfieAt);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="absolute top-0 right-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
        <h2 className="text-white font-bold tracking-wide">Konfirmasi Kehadiran</h2>
        <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-sm transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center mt-8">
        
        {!capturedImage ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" 
            />
            
            {/* Timestamp Overlay Template */}
            <div className="absolute bottom-8 right-6 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-lg">
              <span className="text-white font-mono font-bold tracking-widest text-lg drop-shadow-md">
                {currentTime}
              </span>
            </div>
            
            {/* Instruction */}
            <div className="absolute top-8 left-0 w-full text-center px-4">
              <span className="text-white/90 text-sm font-semibold drop-shadow-md bg-black/30 px-4 py-1.5 rounded-full backdrop-blur-sm">
                Pastikan wajah & waktu terlihat jelas
              </span>
            </div>
            
            {/* Privacy Warning */}
            <div className="absolute bottom-28 left-0 w-full text-center px-4">
              <span className="text-white/80 text-[10px] font-medium bg-black/40 px-3 py-1.5 rounded-lg backdrop-blur-sm max-w-[280px] inline-block leading-snug">
                Privasi Aman: Foto akan <strong>otomatis terhapus</strong> perlahan dari server dalam 7 hari kedepan.
              </span>
            </div>
          </>
        ) : (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-contain bg-black" />
        )}
        
        {/* Hidden Canvas for Drawing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls Container */}
      <div className="mt-8 mb-6 h-24 flex items-center justify-center w-full max-w-md gap-6">
        {!capturedImage ? (
          <button 
            onClick={capturePhoto}
            className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 transition-transform active:scale-95"
          >
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner">
              <Camera size={28} className="text-slate-800" />
            </div>
          </button>
        ) : (
          <>
            <button 
              onClick={() => setCapturedImage(null)}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all disabled:opacity-50"
            >
              <RefreshCcw size={18} /> Ulangi
            </button>
            <button 
              onClick={uploadPhoto}
              disabled={isUploading}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {isUploading ? "Mengirim..." : "Kirim Foto"}
            </button>
          </>
        )}
      </div>

    </div>
  );
}

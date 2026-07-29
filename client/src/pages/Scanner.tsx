import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ApiClient from "../services/api";
import { 
  Camera, Upload, Sliders, RotateCw, Contrast, 
  Crop, Sparkles, AlertCircle, ArrowRight, BookOpen, 
  Info, Barcode, CheckCircle, Search
} from "lucide-react";

export default function Scanner() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"cover" | "barcode">("cover");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Preprocessing States
  const [rotateAngle, setRotateAngle] = useState<number>(0);
  const [binarize, setBinarize] = useState<boolean>(false);
  const [enableCrop, setEnableCrop] = useState<boolean>(false);
  const [cropLeft, setCropLeft] = useState<number>(0);
  const [cropTop, setCropTop] = useState<number>(0);
  const [cropRight, setCropRight] = useState<number>(300);
  const [cropBottom, setCropBottom] = useState<number>(300);

  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Clear states when toggling tabs
  useEffect(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setRotateAngle(0);
    setBinarize(false);
    setEnableCrop(false);
  }, [activeTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      if (activeTab === "cover") {
        if (enableCrop) {
          formData.append("left", cropLeft.toString());
          formData.append("top", cropTop.toString());
          formData.append("right", cropRight.toString());
          formData.append("bottom", cropBottom.toString());
        }
        if (rotateAngle > 0) {
          formData.append("rotate_angle", rotateAngle.toString());
        }
        formData.append("binarize", binarize.toString());

        const res = await ApiClient.post("/ocr/parse-cover", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        setResult(res);
      } else {
        const res = await ApiClient.post("/ocr/scan-barcode", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        setResult(res);
      }
    } catch (err: any) {
      setError(err.message || "Failed to scan image. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header */}
      <div className="border-b border-white/5 pb-4 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white heading-font">Aetheria Book Scanner</h1>
            <p className="text-[11px] text-zinc-500">Scan book covers or barcode sheets to fetch metadata from database catalogs.</p>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex gap-2 bg-white/2 p-1 rounded-xl border border-white/5 w-fit">
        <button
          onClick={() => setActiveTab("cover")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === "cover" 
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/15" 
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          Cover Scan (OCR)
        </button>
        <button
          onClick={() => setActiveTab("barcode")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer ${
            activeTab === "barcode" 
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/15" 
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Barcode className="w-3.5 h-3.5" />
          Barcode / ISBN Scan
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Upload & Controls (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleScanSubmit} className="glass-card border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
            
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
              <Upload className="w-4 h-4 text-emerald-400" />
              Upload Scan File
            </h3>

            {/* Upload Box */}
            <div className="border border-dashed border-white/10 rounded-2xl p-8 hover:border-emerald-500/40 transition bg-white/1 text-center relative cursor-pointer">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {previewUrl ? (
                <div className="space-y-4">
                  <img 
                    src={previewUrl} 
                    alt="Upload Preview" 
                    className="max-h-64 mx-auto object-contain rounded-xl shadow-lg border border-white/10" 
                  />
                  <p className="text-[10px] text-zinc-400">{selectedFile?.name} ({(selectedFile!.size / 1024).toFixed(1)} KB)</p>
                </div>
              ) : (
                <div className="space-y-3 py-6 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-white/3 border border-white/10 flex items-center justify-center text-zinc-400">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">Drag & drop cover file, or click to upload</p>
                    <p className="text-[10px] text-zinc-655">Supports JPG, PNG, WebP images</p>
                  </div>
                </div>
              )}
            </div>

            {/* Preprocessing adjustment controls */}
            {activeTab === "cover" && selectedFile && (
              <div className="p-5 rounded-2xl border border-white/5 bg-white/2 space-y-5">
                <h4 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  Image Preprocessing Parameters
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <RotateCw className="w-3.5 h-3.5 text-zinc-400" />
                        Rotation Correction
                      </label>
                      <select 
                        value={rotateAngle} 
                        onChange={(e) => setRotateAngle(parseInt(e.target.value))}
                        className="w-full glass-input text-xs cursor-pointer"
                      >
                        <option value="0">No Rotation (0°)</option>
                        <option value="90">90° Clockwise</option>
                        <option value="180">180° Flip</option>
                        <option value="270">270° Counter-Clockwise</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/1 border border-white/5">
                      <div className="flex items-center gap-2">
                        <Contrast className="w-4 h-4 text-emerald-400" />
                        <div className="text-left">
                          <p className="text-xs font-bold text-white">Binarize Threshold Filter</p>
                          <p className="text-[9px] text-zinc-650">Converts image to high-contrast monochrome</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={binarize} 
                        onChange={(e) => setBinarize(e.target.checked)}
                        className="w-4 h-4 accent-emerald-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/1 border border-white/5">
                      <div className="flex items-center gap-2">
                        <Crop className="w-4 h-4 text-emerald-400" />
                        <div className="text-left">
                          <p className="text-xs font-bold text-white">Enable Image Cropping</p>
                          <p className="text-[9px] text-zinc-655">Scan a specific section of the image</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={enableCrop} 
                        onChange={(e) => setEnableCrop(e.target.checked)}
                        className="w-4 h-4 accent-emerald-400 cursor-pointer"
                      />
                    </div>

                    {enableCrop && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[8px] font-bold text-zinc-600 uppercase">Left X</label>
                          <input 
                            type="number" 
                            value={cropLeft} 
                            onChange={(e) => setCropLeft(parseInt(e.target.value) || 0)}
                            className="w-full glass-input text-xs py-1"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-bold text-zinc-600 uppercase">Top Y</label>
                          <input 
                            type="number" 
                            value={cropTop} 
                            onChange={(e) => setCropTop(parseInt(e.target.value) || 0)}
                            className="w-full glass-input text-xs py-1"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-bold text-zinc-600 uppercase">Right X</label>
                          <input 
                            type="number" 
                            value={cropRight} 
                            onChange={(e) => setCropRight(parseInt(e.target.value) || 0)}
                            className="w-full glass-input text-xs py-1"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-bold text-zinc-600 uppercase">Bottom Y</label>
                          <input 
                            type="number" 
                            value={cropBottom} 
                            onChange={(e) => setCropBottom(parseInt(e.target.value) || 0)}
                            className="w-full glass-input text-xs py-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            {selectedFile && (
              <div className="flex justify-end pt-4 border-t border-white/5">
                <button
                  type="submit"
                  disabled={processing}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/10 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {processing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Analyzing File...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Start Book Scan</span>
                    </>
                  )}
                </button>
              </div>
            )}

          </form>
        </div>

        {/* Right Column: Scan Result (1/3 width) */}
        <div className="space-y-6">
          <div className="glass-card border border-white/5 rounded-2xl p-5 shadow-xl min-h-[300px] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
                <Info className="w-4 h-4 text-emerald-400" />
                Scan Results
              </h3>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {result ? (
                <div className="space-y-4">
                  {activeTab === "cover" ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-white/2 border border-white/5 space-y-1">
                        <span className="text-[9px] font-bold text-zinc-650 uppercase">Raw OCR Tokens</span>
                        <p className="text-xs text-zinc-400 font-mono leading-relaxed">{result.parsed_text}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                        <span className="text-[9px] font-bold text-emerald-400 uppercase flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Resolved Metadata
                        </span>
                        <div className="space-y-1 text-left">
                          <h4 className="text-xs font-bold text-white">{result.title}</h4>
                          <p className="text-[10px] text-zinc-400">by {result.author_name}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-white/2 border border-white/5 space-y-1">
                        <span className="text-[9px] font-bold text-zinc-650 uppercase">Decoded ISBN-13</span>
                        <p className="text-xs text-white font-mono font-bold tracking-wider">{result.isbn}</p>
                      </div>

                      {result.details ? (
                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex gap-3 text-left">
                          {result.details.cover_url && (
                            <img 
                              src={result.details.cover_url} 
                              alt="Book cover" 
                              className="w-12 h-18 object-cover rounded shadow"
                            />
                          )}
                          <div className="space-y-1 min-w-0">
                            <span className="text-[8px] font-bold text-emerald-400 uppercase">Library Record Found</span>
                            <h4 className="text-xs font-bold text-white truncate">{result.details.title}</h4>
                            <p className="text-[10px] text-zinc-400 truncate">by {result.details.author_name}</p>
                            <div className="flex items-center gap-2 text-[9px] text-zinc-600 font-semibold pt-1">
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                {result.details.pages || "???"} pgs
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-xs text-zinc-400 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-yellow-500 mt-0.5" />
                          <span>Barcode decoded but book details not found in OpenLibrary database.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : !error && (
                <div className="text-center py-12 text-zinc-660 text-xs border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center gap-2">
                  <Camera className="w-6 h-6 text-zinc-700 animate-pulse" />
                  <span>Waiting for file scan...</span>
                </div>
              )}
            </div>

            {result && (
              <div className="pt-4 border-t border-white/5 space-y-2">
                <button
                  onClick={() => {
                    const query = activeTab === "cover" ? result.title : (result.details?.title || result.isbn);
                    navigate(`/search?q=${encodeURIComponent(query)}`);
                  }}
                  className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search Catalog For Book</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}

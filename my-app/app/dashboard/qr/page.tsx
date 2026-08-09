'use client';

import { useState, useRef, useEffect } from "react";
import { Trash2, Plus, QrCode, Upload, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { createClient } from "@/lib/supabase/client";

export default function ManageQRPage() {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchUserProfileQR();
  }, []);

  const fetchUserProfileQR = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('qr_code_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.qr_code_url) {
        setQrImage(profile.qr_code_url);
      }
    } catch (err) {
      console.error("Error fetching user QR:", err);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = imageData ? jsQR(imageData.data, imageData.width, imageData.height) : null;

      let fileToUpload: File = file;

      if (code) {
        const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = code.location;
        const minX = Math.min(topLeftCorner.x, bottomLeftCorner.x);
        const minY = Math.min(topLeftCorner.y, topRightCorner.y);
        const maxX = Math.max(topRightCorner.x, bottomRightCorner.x);
        const maxY = Math.max(bottomLeftCorner.y, bottomRightCorner.y);
        
        const width = maxX - minX;
        const height = maxY - minY;

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = width;
        cropCanvas.height = height;
        const cropCtx = cropCanvas.getContext("2d");
        
        if (cropCtx) {
          cropCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
          
          const blob = await new Promise<Blob | null>((resolve) => cropCanvas.toBlob(resolve, 'image/jpeg'));
          if (blob) {
            fileToUpload = new File([blob], `qr_${Date.now()}.jpg`, { type: 'image/jpeg' });
          }
        }
      }

      await uploadAndSaveQR(fileToUpload);
    };
    
    event.target.value = ""; 
  };

  const uploadAndSaveQR = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Math.random()}.${fileExt}`;
      const filePath = `qr_codes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicURLData } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      const publicUrl = publicURLData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ qr_code_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setQrImage(publicUrl);
      alert("QR code successfully uploaded and saved!");
    } catch (err: any) {
      console.error("Error uploading QR:", err.message);
      alert("Failed to upload QR code: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this QR code?")) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ qr_code_url: null })
        .eq('id', user.id);

      if (error) throw error;

      setQrImage(null);
      alert("QR code removed successfully.");
    } catch (err: any) {
      console.error("Error deleting QR:", err.message);
      alert("Failed to delete QR code.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl border border-primary p-6 relative text-card-foreground">
        
        <button 
          onClick={() => router.push('/dashboard')} 
          className="absolute top-4 left-4 p-2 text-muted-foreground hover:text-primary transition cursor-pointer"
        >
          <ArrowLeft size={24} />
        </button>

        <h2 className="text-xl font-bold mb-6 text-center mt-2 text-foreground">Manage QR Code</h2>

        <div className="w-48 h-48 mx-auto bg-muted rounded-lg flex items-center justify-center mb-6 border-2 border-dashed border-primary overflow-hidden">
          {qrImage ? (
            <img src={qrImage} alt="QR Code" className="w-full h-full object-contain p-2 bg-white" />
          ) : (
            <QrCode size={64} className="text-primary" />
          )}
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />

        <div className="space-y-3">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {uploading ? "Saving..." : (qrImage ? <Upload size={18} /> : <Plus size={18} />)} 
            {uploading ? "Uploading..." : (qrImage ? "Replace QR Code" : "Add QR Code")}
          </button>
          
          {qrImage && (
            <button 
              onClick={handleDelete}
              disabled={uploading}
              className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center gap-2 font-medium transition cursor-pointer"
            >
              <Trash2 size={18} /> Delete QR Code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
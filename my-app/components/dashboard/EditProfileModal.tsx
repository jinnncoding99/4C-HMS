'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Upload, User, Mail, QrCode, Trash2, ZoomIn, ZoomOut, Check, Minimize2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export default function EditProfileModal({ isOpen, onClose, onProfileUpdated }: EditProfileModalProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Cropper & Zoom state for Avatar
  const [rawAvatarSrc, setRawAvatarSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      const fetchUserProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setEmail(user.email || "");
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url, qr_code_url')
            .eq('id', user.id)
            .single();

          if (profile) {
            setUsername(profile.username || "");
            if (profile.avatar_url) setAvatarPreview(profile.avatar_url);
            if (profile.qr_code_url) setQrPreview(profile.qr_code_url);
          }
        }
      };
      fetchUserProfile();
    }
  }, [isOpen, supabase]);

  // Handle smooth global drag tracking for cropping
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        toast.error("Please upload a valid image file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          setRawAvatarSrc(reader.result as string);
          
          const viewportSize = 192; // w-48 = 192px
          const minAspect = Math.min(viewportSize / img.naturalWidth, viewportSize / img.naturalHeight);
          setZoom(minAspect);
          setPosition({ x: 0, y: 0 });
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFitToFrame = () => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const viewportSize = 192;
    const minAspect = Math.min(viewportSize / img.naturalWidth, viewportSize / img.naturalHeight);
    setZoom(minAspect);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleApplyCrop = () => {
    if (!imageRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 300;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);
    ctx.save();

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    const img = imageRef.current;
    const viewportSize = 192;
    const scaleFactor = size / viewportSize;

    const renderW = img.naturalWidth * zoom * scaleFactor;
    const renderH = img.naturalHeight * zoom * scaleFactor;

    const x = (size / 2) - (renderW / 2) + (position.x * scaleFactor);
    const y = (size / 2) - (renderH / 2) + (position.y * scaleFactor);

    ctx.drawImage(img, x, y, renderW, renderH);
    ctx.restore();

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], `avatar-${Date.now()}.png`, { type: 'image/png' });
        setAvatarFile(croppedFile);
        setAvatarPreview(URL.createObjectURL(blob));
        setRawAvatarSrc(null);
      }
    }, 'image/png', 0.95);
  };

  const handleQrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        toast.error("Please upload a valid image file for the QR code.");
        return;
      }
      setQrFile(file);
      setQrPreview(URL.createObjectURL(file));
    }
  };

  const handleDeleteQr = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ qr_code_url: null })
        .eq('id', user.id);

      if (error) throw error;

      setQrFile(null);
      setQrPreview(null);
      toast.success("QR code deleted successfully.");
    } catch (err: any) {
      toast.error("Failed to delete QR code: " + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user found.");

      let avatarUrl = avatarPreview;
      let qrCodeUrl = qrPreview;

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}-avatar-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) {
          if (uploadError.message.includes("Bucket not found")) {
            throw new Error("Storage bucket 'avatars' is missing in your Supabase project. Please create a public bucket named 'avatars'.");
          }
          throw uploadError;
        }

        const { data: publicURLData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = publicURLData.publicUrl;
      }

      if (qrFile) {
        const fileExt = qrFile.name.split('.').pop();
        const fileName = `${user.id}-qr-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('qrcodes')
          .upload(fileName, qrFile, { upsert: true });

        if (uploadError) {
          if (uploadError.message.includes("Bucket not found")) {
            throw new Error("Storage bucket 'qrcodes' is missing in your Supabase project. Please create a public bucket named 'qrcodes'.");
          }
          throw uploadError;
        }

        const { data: publicURLData } = supabase.storage
          .from('qrcodes')
          .getPublicUrl(fileName);

        qrCodeUrl = publicURLData.publicUrl;
      }

      if (!qrPreview) {
        qrCodeUrl = null;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username,
          avatar_url: avatarUrl,
          qr_code_url: qrCodeUrl,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      if (email && email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
        toast.success("Profile updated! Please check your new email inbox to verify the change.");
      } else {
        toast.success("Profile updated successfully!");
      }

      if (onProfileUpdated) {
        onProfileUpdated();
      }
      onClose();
    } catch (err: any) {
      console.error("Error updating profile:", err.message);
      toast.error("Failed to update profile: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      
      <canvas ref={canvasRef} className="hidden" />

      {rawAvatarSrc && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center space-y-4">
            <h4 className="font-bold text-slate-900 dark:text-white text-base">Position & Zoom Avatar</h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 text-center">Zoom out or click "Fit to Frame" to capture the whole picture inside the avatar circle.</p>
            
            <div 
              className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-[#4B49AC] dark:border-amber-500 cursor-grab active:cursor-grabbing select-none bg-slate-900 flex items-center justify-center shadow-inner"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img 
                ref={imageRef}
                src={rawAvatarSrc} 
                alt="Crop Source" 
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  maxWidth: 'none',
                }}
                className="pointer-events-none absolute"
              />
            </div>

            <button 
              type="button" 
              onClick={handleFitToFrame}
              className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <Minimize2 size={13} /> Fit Whole Picture Inside
            </button>

            <div className="flex items-center gap-3 w-full px-2">
              <ZoomOut size={16} className="text-slate-400" />
              <input 
                type="range" 
                min="0.1" 
                max="3" 
                step="0.05" 
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-[#4B49AC] dark:accent-amber-500 cursor-pointer"
              />
              <ZoomIn size={16} className="text-slate-400" />
            </div>

            <div className="flex items-center gap-3 w-full pt-2">
              <button 
                type="button" 
                onClick={() => setRawAvatarSrc(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleApplyCrop}
                className="flex-1 py-2 text-xs font-bold text-white bg-[#4B49AC] dark:bg-amber-500 dark:text-black hover:opacity-90 rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check size={14} /> Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Profile</h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 flex items-center justify-center">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-slate-400" />
              )}
            </div>
            <label className="text-xs font-semibold text-[#4B49AC] dark:text-[#ff8c00] hover:underline cursor-pointer">
              Change & Crop Avatar
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Username</label>
            <div className="relative flex items-center">
              <User size={16} className="absolute left-3 text-slate-400" />
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4B49AC]/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Email Address</label>
            <div className="relative flex items-center">
              <Mail size={16} className="absolute left-3 text-slate-400" />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4B49AC]/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Payment QR Code</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0">
                {qrPreview ? (
                  <img src={qrPreview} alt="QR Preview" className="w-full h-full object-cover" />
                ) : (
                  <QrCode size={24} className="text-slate-400" />
                )}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label className="border border-dashed border-slate-300 dark:border-zinc-700 hover:border-[#4B49AC] p-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-xs text-slate-600 dark:text-zinc-300 font-medium transition">
                  <Upload size={14} /> Replace QR Code
                  <input type="file" accept="image/*" onChange={handleQrChange} className="hidden" />
                </label>
                {qrPreview && (
                  <button 
                    type="button" 
                    onClick={handleDeleteQr}
                    className="bg-red-500/10 text-red-600 hover:bg-red-500/20 h-7 text-xs rounded-xl flex items-center justify-center gap-1 font-medium transition cursor-pointer"
                  >
                    <Trash2 size={12} /> Delete QR Code
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-[#4B49AC] hover:bg-[#4B49AC]/90 rounded-xl transition shadow-md cursor-pointer disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
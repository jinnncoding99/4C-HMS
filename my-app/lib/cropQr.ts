import jsQR from "jsqr";

export async function autoCropQR(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to process image canvas context."));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.location) {
          const loc = code.location;
          const minX = Math.min(loc.topLeftCorner.x, loc.bottomLeftCorner.x);
          const minY = Math.min(loc.topLeftCorner.y, loc.topRightCorner.y);
          const maxX = Math.max(loc.topRightCorner.x, loc.bottomRightCorner.x);
          const maxY = Math.max(loc.bottomLeftCorner.y, loc.bottomRightCorner.y);

          const padding = Math.max(20, (maxX - minX) * 0.1);
          const cropX = Math.max(0, minX - padding);
          const cropY = Math.max(0, minY - padding);
          const cropWidth = Math.min(canvas.width - cropX, (maxX - minX) + padding * 2);
          const cropHeight = Math.min(canvas.height - cropY, (maxY - minY) + padding * 2);

          const croppedCanvas = document.createElement("canvas");
          croppedCanvas.width = cropWidth;
          croppedCanvas.height = cropHeight;

          const cropCtx = croppedCanvas.getContext("2d");
          if (cropCtx) {
            cropCtx.drawImage(
              canvas,
              cropX, cropY, cropWidth, cropHeight,
              0, 0, cropWidth, cropHeight
            );

            croppedCanvas.toBlob((blob) => {
              if (blob) {
                const croppedFile = new File([blob], file.name, { type: file.type });
                resolve(croppedFile);
              } else {
                reject(new Error("Failed to generate cropped image blob."));
              }
            }, file.type);
            return;
          }
        }
        
        // Reject if no QR code is found
        reject(new Error("No valid QR code found in the image."));
      };
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
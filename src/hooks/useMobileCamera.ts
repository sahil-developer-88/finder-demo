
import { useState, useEffect } from 'react';

export const useMobileCamera = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if camera is supported
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setIsSupported(true);
    }
  }, []);

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' // Use back camera on mobile
        } 
      });
      setHasPermission(true);
      // Stop the stream immediately as we just needed permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Camera permission denied:', error);
      setHasPermission(false);
      return false;
    }
  };

  return {
    hasPermission,
    isSupported,
    requestCameraPermission
  };
};

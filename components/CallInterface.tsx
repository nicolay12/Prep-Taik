import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Camera, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface CallInterfaceProps {
  participants: User[];
  isVideo: boolean;
  onEndCall: () => void;
}

export const CallInterface: React.FC<CallInterfaceProps> = ({ participants, isVideo, onEndCall }) => {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(isVideo);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startStream = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: cameraOn,
          audio: true
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to access media devices", err);
      }
    };

    if (cameraOn || micOn) {
      startStream();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraOn]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Main Video Area */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        {/* Remote User Placeholder (Simulated) */}
        <div className="absolute inset-0 flex items-center justify-center">
           {participants[0]?.avatarUrl ? (
             <img src={participants[0].avatarUrl} className="w-32 h-32 rounded-full border-4 border-gray-700 animate-pulse" alt="User" />
           ) : (
             <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center animate-pulse">
               <UserIcon size={64} className="text-gray-400" />
             </div>
           )}
           <div className="absolute mt-40 text-xl font-bold">{participants[0]?.nickname}</div>
           <div className="absolute mt-48 text-sm text-green-400">Connected (Secure)</div>
        </div>

        {/* Local Video Pip */}
        {cameraOn && (
          <div className="absolute top-4 right-4 w-28 h-36 bg-black rounded-xl overflow-hidden border border-gray-600 shadow-lg">
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover transform scale-x-[-1]" 
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-24 bg-gray-800 rounded-t-3xl flex items-center justify-around pb-4 shadow-2xl">
        <button 
          onClick={() => setCameraOn(!cameraOn)} 
          className={`p-4 rounded-full ${cameraOn ? 'bg-gray-700 text-white' : 'bg-white text-black'}`}
        >
          {cameraOn ? <Video size={24} /> : <VideoOff size={24} />}
        </button>

        <button 
          onClick={() => setMicOn(!micOn)} 
          className={`p-4 rounded-full ${micOn ? 'bg-gray-700 text-white' : 'bg-white text-black'}`}
        >
          {micOn ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        <button 
          onClick={onEndCall} 
          className="p-4 rounded-full bg-red-500 text-white shadow-lg transform hover:scale-110 transition-transform"
        >
          <PhoneOff size={28} />
        </button>
      </div>
    </div>
  );
};
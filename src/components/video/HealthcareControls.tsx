"use client";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, FileText } from "lucide-react";
import { useCall, useCallStateHooks } from "@stream-io/video-react-sdk";
import { useState } from "react";

interface HealthcareControlsProps {
    onLeave?: () => void;
    role: "patient" | "doctor";
    onToggleSidebar?: () => void;
}

export function HealthcareControls({ onLeave, role, onToggleSidebar }: HealthcareControlsProps) {
    const call = useCall();
    const { useMicrophoneState, useCameraState, useScreenShareState } = useCallStateHooks();
    const { isMute: isMicMuted } = useMicrophoneState();
    const { isMute: isCameraMuted } = useCameraState();
    const { isMute: isScreenShareOff } = useScreenShareState();

    const [isTogglingMic, setIsTogglingMic] = useState(false);
    const [isTogglingCam, setIsTogglingCam] = useState(false);

    const toggleMic = async () => {
        if (!call || isTogglingMic) return;
        setIsTogglingMic(true);
        try {
            if (isMicMuted) {
                await call.microphone.enable();
            } else {
                await call.microphone.disable();
            }
        } catch (err) {
            console.error("Failed to toggle microphone:", err);
        } finally {
            setIsTogglingMic(false);
        }
    };

    const toggleCamera = async () => {
        if (!call || isTogglingCam) return;
        setIsTogglingCam(true);
        try {
            if (isCameraMuted) {
                await call.camera.enable();
            } else {
                await call.camera.disable();
            }
        } catch (err) {
            console.error("Failed to toggle camera:", err);
        } finally {
            setIsTogglingCam(false);
        }
    };

    const toggleScreenShare = async () => {
        if (!call) return;
        try {
            if (isScreenShareOff) {
                await call.screenShare.enable();
            } else {
                await call.screenShare.disable();
            }
        } catch (err) {
            console.error("Failed to toggle screen share:", err);
        }
    };

    return (
        <div className="flex items-center justify-center gap-4 md:gap-6 px-6 md:px-8 py-3 md:py-4 bg-gray-800/80 backdrop-blur-md rounded-full border border-white/10 shadow-2xl">
            {/* Microphone */}
            <button
                onClick={toggleMic}
                disabled={isTogglingMic}
                className={`flex flex-col items-center gap-1 transition-all ${isMicMuted ? "text-red-400" : "text-white"}`}
                title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${isMicMuted
                        ? "bg-red-500/20 ring-2 ring-red-500/50 hover:bg-red-500/30"
                        : "bg-gray-700 ring-1 ring-white/20 hover:bg-gray-600"
                    } ${isTogglingMic ? "opacity-50" : ""}`}>
                    {isMicMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </div>
                <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">Mic</span>
            </button>

            {/* Camera */}
            <button
                onClick={toggleCamera}
                disabled={isTogglingCam}
                className={`flex flex-col items-center gap-1 transition-all ${isCameraMuted ? "text-red-400" : "text-white"}`}
                title={isCameraMuted ? "Turn On Camera" : "Turn Off Camera"}
            >
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${isCameraMuted
                        ? "bg-red-500/20 ring-2 ring-red-500/50 hover:bg-red-500/30"
                        : "bg-gray-700 ring-1 ring-white/20 hover:bg-gray-600"
                    } ${isTogglingCam ? "opacity-50" : ""}`}>
                    {isCameraMuted ? <VideoOff size={22} /> : <Video size={22} />}
                </div>
                <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">Cam</span>
            </button>

            {/* Doctor Extras */}
            {role === "doctor" && (
                <>
                    <button
                        onClick={toggleScreenShare}
                        className="flex flex-col items-center gap-1 transition-all text-white"
                        title="Share Screen"
                    >
                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${!isScreenShareOff
                                ? "bg-teal-500/20 ring-2 ring-teal-500/50"
                                : "bg-gray-700 ring-1 ring-white/20 hover:bg-gray-600"
                            }`}>
                            <MonitorUp size={22} />
                        </div>
                        <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">Share</span>
                    </button>

                    <button
                        onClick={onToggleSidebar}
                        className="flex flex-col items-center gap-1 transition-all text-white"
                        title="Patient Info"
                    >
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gray-700 ring-1 ring-white/20 hover:bg-gray-600 flex items-center justify-center cursor-pointer transition-all">
                            <FileText size={22} />
                        </div>
                        <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">Info</span>
                    </button>
                </>
            )}

            {/* End Call */}
            <button
                onClick={onLeave}
                className="flex flex-col items-center gap-1 ml-2 md:ml-4"
                title="End Video Visit"
            >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20 ring-4 ring-offset-2 ring-offset-gray-900 ring-red-600/30 flex items-center justify-center transform hover:scale-105 transition-all cursor-pointer">
                    <PhoneOff size={26} className="text-white" />
                </div>
                <span className="text-[10px] font-bold text-red-400 tracking-wide uppercase">End Call</span>
            </button>
        </div>
    );
}

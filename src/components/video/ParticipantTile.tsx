import { ParticipantView, StreamVideoParticipant, useCallStateHooks } from "@stream-io/video-react-sdk";
import { useState, useEffect, useRef } from "react";
import { MicOff } from "lucide-react";

interface ParticipantTileProps {
    participant: StreamVideoParticipant;
    isLocal?: boolean;
    className?: string;
    forceVideoOnly?: boolean;
}

export function ParticipantTile({ participant, isLocal = false, className = "", forceVideoOnly = false }: ParticipantTileProps) {
    const isSpeaking = participant.isSpeaking;
    const videoRef = useRef<HTMLVideoElement>(null);

    const isScreenShare = !forceVideoOnly && !!participant.screenShareStream;
    const [isPortrait, setIsPortrait] = useState(false);

    // Use Stream SDK's useMicrophoneState hook for LOCAL participant mute status
    const { useMicrophoneState } = useCallStateHooks();
    const { isMute: isLocalMicMuted } = useMicrophoneState();

    // For LOCAL: use SDK's isMute, For REMOTE: check if NOT speaking (rough indicator)
    const showMicMutedIcon = isLocal ? isLocalMicMuted : !participant.isSpeaking;

    useEffect(() => {
        if (isScreenShare && videoRef.current && participant.screenShareStream) {
            videoRef.current.srcObject = participant.screenShareStream;
            videoRef.current.play().catch(console.error);
        }
    }, [isScreenShare, participant.screenShareStream]);

    useEffect(() => {
        const videoTrack = isScreenShare
            ? participant.screenShareStream?.getVideoTracks()[0]
            : participant.videoStream?.getVideoTracks()[0];

        if (!videoTrack) return;

        const settings = videoTrack.getSettings();
        if (settings.width && settings.height) {
            setIsPortrait(settings.height > settings.width);
        }

        const checkOrientation = () => {
            const newSettings = videoTrack.getSettings();
            if (newSettings.width && newSettings.height) {
                setIsPortrait(newSettings.height > newSettings.width);
            }
        };

        videoTrack.addEventListener?.('configurationchange', checkOrientation);
        return () => videoTrack.removeEventListener?.('configurationchange', checkOrientation);
    }, [participant, isScreenShare]);

    const objectFitClass = isScreenShare ? 'object-contain' : (isPortrait ? 'object-contain' : 'object-cover');

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-gray-800 border transition-all duration-300 ${isSpeaking
            ? "border-teal-500 shadow-[0_0_0_4px_rgba(20,184,166,0.2)]"
            : "border-gray-700/50"
            } ${className}`}>

            {isScreenShare ? (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={isLocal}
                        className={`w-full h-full ${objectFitClass}`}
                    />
                </div>
            ) : (
                <div className={`absolute inset-0 w-full h-full flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:${objectFitClass} [&_.str-video__participant-view]:w-full [&_.str-video__participant-view]:h-full [&_.str-video__video]:${objectFitClass}`}>
                    <ParticipantView
                        participant={participant}
                        ParticipantViewUI={null}
                    />
                </div>
            )}

            {/* Name Overlay with Mic Indicator */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    <span className="text-white text-sm font-medium tracking-wide truncate max-w-[120px]">
                        {isLocal ? "You" : participant.name}
                    </span>
                    {isLocal && showMicMutedIcon && (
                        <MicOff size={14} className="text-red-400 flex-shrink-0" />
                    )}
                </div>
            </div>
        </div>
    );
}

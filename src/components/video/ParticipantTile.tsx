import { ParticipantView, StreamVideoParticipant } from "@stream-io/video-react-sdk";
import { useState, useEffect, useRef } from "react";
import { VideoOff, MicOff } from "lucide-react";

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

    // Check if camera is enabled - use publishedTracks for remote, videoStream for local
    const hasVideo = isScreenShare
        ? !!participant.screenShareStream
        : (isLocal
            ? !!(participant.videoStream && participant.videoStream.getVideoTracks().length > 0 && participant.videoStream.getVideoTracks()[0].enabled)
            : participant.publishedTracks.includes('video' as any));

    // Check if microphone is muted - use publishedTracks for remote, audioStream for local
    const isMicMuted = isLocal
        ? !(participant.audioStream && participant.audioStream.getAudioTracks().length > 0 && participant.audioStream.getAudioTracks()[0].enabled)
        : !participant.publishedTracks.includes('audio' as any);

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
    const nameInitial = participant.name?.charAt(0).toUpperCase() || '?';

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-gray-800 border transition-all duration-300 ${isSpeaking
            ? "border-teal-500 shadow-[0_0_0_4px_rgba(20,184,166,0.2)]"
            : "border-gray-700/50"
            } ${className}`}>

            {hasVideo ? (
                isScreenShare ? (
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
                )
            ) : (
                <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-teal-600/20 border-2 border-teal-500/30 flex items-center justify-center mb-4">
                        <span className="text-3xl md:text-4xl font-bold text-teal-400">{nameInitial}</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                        <VideoOff size={24} className="opacity-60" />
                        <span className="text-sm font-medium">Camera Off</span>
                    </div>
                </div>
            )}

            {/* Name Overlay with Mic Indicator */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    <span className="text-white text-sm font-medium tracking-wide truncate max-w-[120px]">
                        {isLocal ? "You" : participant.name}
                    </span>
                    {isMicMuted && (
                        <MicOff size={14} className="text-red-400 flex-shrink-0" />
                    )}
                </div>
            </div>
        </div>
    );
}

import { ParticipantView, StreamVideoParticipant } from "@stream-io/video-react-sdk";

interface ParticipantTileProps {
    participant: StreamVideoParticipant;
    isLocal?: boolean;
    className?: string;
}

export function ParticipantTile({ participant, isLocal = false, className = "" }: ParticipantTileProps) {
    const isSpeaking = participant.isSpeaking;

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-gray-800 border transition-all duration-300 ${isSpeaking
            ? "border-teal-500 shadow-[0_0_0_4px_rgba(20,184,166,0.2)]"
            : "border-gray-700/50"
            } ${className}`}>

            {/* Video - centered and covering the entire container */}
            <div className="absolute inset-0 w-full h-full flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_.str-video__participant-view]:w-full [&_.str-video__participant-view]:h-full [&_.str-video__video]:object-cover">
                <ParticipantView
                    participant={participant}
                    ParticipantViewUI={null}
                />
            </div>

            {/* Name Overlay at bottom */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    <span className="text-white text-sm font-medium tracking-wide truncate max-w-[120px]">
                        {isLocal ? "You" : participant.name}
                    </span>
                </div>
            </div>
        </div>
    );
}

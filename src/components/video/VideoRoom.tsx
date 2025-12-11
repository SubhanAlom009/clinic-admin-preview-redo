import { useEffect, useState } from "react";
import {
    StreamVideo,
    StreamVideoClient,
    StreamCall,
    Call,
    useCallStateHooks,
    ParticipantView,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { StreamService } from "../../services/StreamService";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

interface VideoRoomProps {
    callId: string;
    userId: string;
    userName: string;
    onLeave?: () => void;
}

// Custom Call Controls
function CustomCallControls({ onLeave }: { onLeave?: () => void }) {
    const { useMicrophoneState, useCameraState } = useCallStateHooks();
    const { microphone, isMute: isMicMuted } = useMicrophoneState();
    const { camera, isMute: isCameraMuted } = useCameraState();

    const toggleMic = async () => {
        if (isMicMuted) {
            await microphone.enable();
        } else {
            await microphone.disable();
        }
    };

    const toggleCamera = async () => {
        if (isCameraMuted) {
            await camera.enable();
        } else {
            await camera.disable();
        }
    };

    return (
        <div className="flex items-center justify-center gap-4">
            <button
                onClick={toggleMic}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMicMuted
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-gray-600 hover:bg-gray-500 text-white"
                    }`}
                title={isMicMuted ? "Unmute" : "Mute"}
            >
                {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
                onClick={toggleCamera}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCameraMuted
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-gray-600 hover:bg-gray-500 text-white"
                    }`}
                title={isCameraMuted ? "Turn on camera" : "Turn off camera"}
            >
                {isCameraMuted ? <VideoOff size={20} /> : <Video size={20} />}
            </button>

            <button
                onClick={onLeave}
                className="w-14 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors"
                title="End call"
            >
                <PhoneOff size={22} />
            </button>
        </div>
    );
}

// Discord-style side-by-side layout
function DiscordLayout({ onLeave }: { onLeave?: () => void }) {
    const { useParticipants, useLocalParticipant } = useCallStateHooks();
    const participants = useParticipants();
    const localParticipant = useLocalParticipant();

    const remoteParticipant = participants.find(
        (p) => p.sessionId !== localParticipant?.sessionId
    );

    return (
        <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
            <div className="flex-1 flex gap-3 p-4 overflow-hidden">
                {/* Local participant (You - Doctor) */}
                <div className="flex-1 bg-gray-800 rounded-xl overflow-hidden relative flex items-center justify-center">
                    {localParticipant ? (
                        <>
                            <ParticipantView
                                participant={localParticipant}
                                trackType="videoTrack"
                            />
                            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-lg text-white text-sm font-medium">
                                You (Doctor)
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            Loading...
                        </div>
                    )}
                </div>

                {/* Remote participant (Patient) */}
                <div className="flex-1 bg-gray-800 rounded-xl overflow-hidden relative flex items-center justify-center">
                    {remoteParticipant ? (
                        <>
                            <ParticipantView
                                participant={remoteParticipant}
                                trackType="videoTrack"
                            />
                            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-lg text-white text-sm font-medium">
                                {remoteParticipant.name || "Patient"}
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 flex-col gap-2">
                            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
                                👤
                            </div>
                            <span>Waiting for patient...</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="p-4 bg-gray-800 flex-shrink-0">
                <CustomCallControls onLeave={onLeave} />
            </div>
        </div>
    );
}

export function VideoRoom({ callId, userId, userName, onLeave }: VideoRoomProps) {
    const [client, setClient] = useState<StreamVideoClient | null>(null);
    const [call, setCall] = useState<Call | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const initializeCall = async () => {
            try {
                // Get token from Supabase Edge Function
                const { token, apiKey } = await StreamService.getStreamToken(userId);

                if (!mounted) return;

                // Create Stream client
                const videoClient = new StreamVideoClient({
                    apiKey,
                    user: { id: userId, name: userName },
                    token,
                });

                setClient(videoClient);

                // Create and join call
                const videoCall = videoClient.call("default", callId);
                await videoCall.join({ create: true });

                // Enable camera and microphone explicitly after joining
                await videoCall.camera.enable();
                await videoCall.microphone.enable();

                if (!mounted) return;

                setCall(videoCall);
                setLoading(false);
            } catch (err) {
                console.error("Failed to initialize video call:", err);
                if (mounted) {
                    setError("Failed to connect to video call");
                    setLoading(false);
                }
            }
        };

        initializeCall();

        return () => {
            mounted = false;
            if (call) {
                call.leave();
            }
            if (client) {
                client.disconnectUser();
            }
        };
    }, [callId, userId, userName]);

    const handleLeave = () => {
        if (call) {
            call.leave();
        }
        if (client) {
            client.disconnectUser();
        }
        onLeave?.();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white text-lg">Connecting to video call...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 text-lg mb-4">{error}</p>
                    <button
                        onClick={onLeave}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (!client || !call) {
        return null;
    }

    return (
        <StreamVideo client={client}>
            <StreamCall call={call}>
                <DiscordLayout onLeave={handleLeave} />
            </StreamCall>
        </StreamVideo>
    );
}


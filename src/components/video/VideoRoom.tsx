import { useEffect, useState } from "react";
import {
    StreamVideo,
    StreamVideoClient,
    StreamCall,
    Call,
    useCallStateHooks,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { StreamService } from "../../services/StreamService";
import { HealthcareControls } from "./HealthcareControls";
import { ParticipantTile } from "./ParticipantTile";

interface VideoRoomProps {
    callId: string;
    userId: string;
    userName: string;
    patientName?: string;
    patientSymptoms?: string;
    onLeave?: () => void;
}

function DoctorDashboardLayout({ onLeave, callId, patientName, patientSymptoms }: { onLeave?: () => void, callId?: string, patientName?: string, patientSymptoms?: string }) {
    const { useRemoteParticipants, useLocalParticipant, useParticipants } = useCallStateHooks();
    const remoteParticipants = useRemoteParticipants();
    const localParticipant = useLocalParticipant();
    const allParticipants = useParticipants();
    const [showSidebar, setShowSidebar] = useState(false);

    // Auto-open sidebar on large screens initially
    useEffect(() => {
        if (window.innerWidth >= 1024) {
            setShowSidebar(true);
        }
    }, []);

    // Get first remote participant (the patient)
    const remoteParticipant = remoteParticipants[0];

    // Check if anyone is screen sharing
    const screenSharingParticipant = allParticipants.find(p => p.screenShareStream);
    const isScreenSharing = !!screenSharingParticipant;

    // Debug logging
    console.log("🏥 [DOCTOR] Remote Participants Count:", remoteParticipants.length);
    console.log("🏥 [DOCTOR] Screen Sharing:", isScreenSharing);
    console.log("🏥 [DOCTOR] Screen Sharing Participant:", screenSharingParticipant?.name);

    return (
        <div className="flex bg-gray-900 h-screen overflow-hidden w-full relative">
            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 relative h-full bg-gray-900`}>

                {/* Video Area */}
                <div className="flex-1 p-2 md:p-4 flex flex-col items-center justify-center overflow-hidden">

                    {isScreenSharing ? (
                        // Google Meet-style: Large screen share + small video thumbnails on top
                        <>
                            {/* Screen Share Indicator */}
                            <div className="w-full bg-teal-600/20 border-b border-teal-600/50 px-3 py-2 mb-2">
                                <div className="flex items-center justify-center gap-2 text-teal-400 text-xs md:text-sm">
                                    <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                                    <span className="font-medium">Screen sharing active</span>
                                </div>
                            </div>

                            {/* Small video thumbnails at top - mobile optimized */}
                            <div className="w-full flex gap-1.5 md:gap-3 mb-2 md:mb-3 justify-center px-2">
                                {/* Local participant thumbnail */}
                                {localParticipant && (
                                    <div className="w-24 h-18 sm:w-32 sm:h-24 md:w-40 md:h-28 flex-shrink-0">
                                        <ParticipantTile
                                            participant={localParticipant}
                                            isLocal={true}
                                            forceVideoOnly={true}
                                            className="w-full h-full"
                                        />
                                    </div>
                                )}

                                {/* Remote participant thumbnail */}
                                {remoteParticipant && (
                                    <div className="w-24 h-18 sm:w-32 sm:h-24 md:w-40 md:h-28 flex-shrink-0">
                                        <ParticipantTile
                                            participant={remoteParticipant}
                                            forceVideoOnly={true}
                                            className="w-full h-full"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Large screen share view - mobile responsive */}
                            <div className="flex-1 w-full max-w-6xl rounded-lg md:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black">
                                <ParticipantTile
                                    participant={screenSharingParticipant}
                                    className="w-full h-full"
                                />
                            </div>
                        </>
                    ) : (
                        // Normal grid view when not sharing
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full h-full max-w-6xl">
                            {/* Remote Participant (Patient) */}
                            <div className="relative w-full h-full min-h-[200px] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-gray-800">
                                {remoteParticipant ? (
                                    <ParticipantTile
                                        participant={remoteParticipant}
                                        className="w-full h-full"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-800/50 p-4 text-center">
                                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-700/50 animate-pulse mb-4" />
                                        <span className="font-medium text-sm md:text-base">Waiting for patient to join...</span>
                                    </div>
                                )}
                            </div>

                            {/* Local Participant (Doctor) */}
                            <div className="relative w-full h-full min-h-[200px] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-gray-800">
                                {localParticipant && (
                                    <ParticipantTile
                                        participant={localParticipant}
                                        isLocal={true}
                                        className="w-full h-full"
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Floating Controls */}
                <div className="p-4 md:p-6 flex justify-center w-full z-40 shrink-0">
                    <HealthcareControls
                        onLeave={onLeave}
                        role="doctor"
                        onToggleSidebar={() => setShowSidebar(!showSidebar)}
                    />
                </div>
            </div>

            {/* Sidebar - Responsive */}
            <div className={`
                fixed inset-y-0 right-0 z-50 
                w-full md:w-80 
                bg-gray-900 border-l border-gray-800 
                transform transition-transform duration-300 ease-in-out shadow-2xl
                ${showSidebar ? "translate-x-0" : "translate-x-full"}
                lg:relative lg:translate-x-0 lg:shadow-none lg:z-auto
                ${showSidebar ? "lg:w-80 lg:opacity-100" : "lg:w-0 lg:opacity-0 lg:overflow-hidden lg:border-l-0"}
            `}>
                <div className="flex flex-col h-full">
                    <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                        <div>
                            <h3 className="text-white font-semibold text-lg">Patient Information</h3>
                            <p className="text-gray-400 text-sm">Session Details</p>
                            <p className="text-gray-500 text-[10px] font-mono mt-1">ID: {callId?.slice(-6)}</p>
                        </div>
                        <button
                            onClick={() => setShowSidebar(false)}
                            className="lg:hidden p-2 text-gray-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="p-6 space-y-6 overflow-y-auto flex-1">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Name</label>
                            <p className="text-white text-lg font-medium">{patientName || "Unknown Patient"}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Symptoms</label>
                            <p className="text-gray-300">{patientSymptoms || "No symptoms provided"}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Appointment Type</label>
                            <p className="text-gray-400 text-sm">Video Consultation</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Overlay Backdrop */}
            {showSidebar && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setShowSidebar(false)}
                />
            )}
        </div>
    );
}

export function VideoRoom({ callId, userId, userName, patientName, patientSymptoms, onLeave }: VideoRoomProps) {
    const [client, setClient] = useState<StreamVideoClient | null>(null);
    const [call, setCall] = useState<Call | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        let videoClient: StreamVideoClient | null = null;
        let videoCall: Call | null = null;

        const initializeCall = async () => {
            try {
                const { token, apiKey } = await StreamService.getStreamToken(userId);

                if (!mounted) return;

                console.log("🔑 [ADMIN] Stream API Key from Edge Function:", apiKey);

                videoClient = new StreamVideoClient({
                    apiKey,
                    user: { id: userId, name: userName },
                    token,
                });

                setClient(videoClient);

                videoCall = videoClient.call("default", callId);
                await videoCall.join({ create: true });

                try { await videoCall.camera.enable(); } catch (e) { console.log("Camera enable failed:", e); }
                try { await videoCall.microphone.enable(); } catch (e) { console.log("Mic enable failed:", e); }

                if (!mounted) {
                    await videoCall.leave();
                    videoClient.disconnectUser();
                    return;
                }

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
            console.log("🧹 [ADMIN] Cleaning up video call...");
            mounted = false;
            if (videoCall) {
                videoCall.leave().catch(console.error);
            }
            if (videoClient) {
                videoClient.disconnectUser().catch(console.error);
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
                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                    <h3 className="text-white text-xl font-semibold mb-2">Secure Connection...</h3>
                    <p className="text-gray-400">Preparing your virtual clinic room</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 text-lg mb-4">{error}</p>
                    <button onClick={onLeave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full">
                        Return to Dashboard
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
                <DoctorDashboardLayout onLeave={handleLeave} callId={callId} patientName={patientName} patientSymptoms={patientSymptoms} />
            </StreamCall>
        </StreamVideo>
    );
}

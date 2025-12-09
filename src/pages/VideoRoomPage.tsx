import { useSearchParams, useNavigate } from "react-router-dom";
import { VideoRoom } from "../components/video/VideoRoom";
import { ArrowLeft } from "lucide-react";

export function VideoRoomPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const callId = searchParams.get("callId");
    const userId = searchParams.get("userId") || `doctor-${Date.now()}`;
    const userName = searchParams.get("userName") || "Doctor";

    if (!callId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 text-lg mb-4">Invalid call - No call ID provided</p>
                    <button
                        onClick={() => navigate("/admin/appointments")}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Appointments
                    </button>
                </div>
            </div>
        );
    }

    return (
        <VideoRoom
            callId={callId}
            userId={userId}
            userName={userName}
            onLeave={() => navigate("/admin/appointments")}
        />
    );
}


import { AccessToken } from "livekit-server-sdk";

export async function createGroupCallToken({
  conversationId,
  userId,
  userName,
  callId,
}) {
  if (
    !process.env.LIVEKIT_URL ||
    !process.env.LIVEKIT_API_KEY ||
    !process.env.LIVEKIT_API_SECRET
  ) {
    throw new Error("LiveKit configuration is missing");
  }

  if (!conversationId || !userId || !callId) {
    throw new Error("Missing call information");
  }

  const roomName =
    `conversation-${conversationId}-call-${callId}`;

  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: String(userId),
      name: String(userName || "Participant"),
      ttl: "2h",
    }
  );

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    token: await token.toJwt(),
    serverUrl: process.env.LIVEKIT_URL,
    roomName,
  };
}

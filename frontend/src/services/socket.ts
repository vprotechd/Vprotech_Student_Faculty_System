import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:5000";

let chatSocket: Socket | null = null;

export const connectChatSocket = (token: string): Socket => {
  if (chatSocket) {
    chatSocket.auth = { token };

    if (!chatSocket.connected) {
      chatSocket.connect();
    }

    return chatSocket;
  }

  chatSocket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket"],
    auth: { token },
  });

  chatSocket.connect();

  return chatSocket;
};

export const getChatSocket = (): Socket | null => chatSocket;

export const disconnectChatSocket = (): void => {
  if (chatSocket) {
    chatSocket.disconnect();
    chatSocket = null;
  }
};

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import API, { getErrorMessage } from "../../api/apiClient";
import { connectChatSocket } from "../../services/socket";

type ChatUser = {
  _id: string;
  name?: string;
  role?: string;
};

type Message = {
  _id: string;
  senderId: string | ChatUser;
  receiverId: string | ChatUser;
  message: string;
  isRead?: boolean;
  createdAt: string;
};

const getId = (value: string | ChatUser): string => {
  return typeof value === "string" ? value : value?._id;
};

export default function ChatScreen() {
  const router = useRouter();

  const { userId, name } = useLocalSearchParams<{
    userId: string;
    name?: string;
  }>();

  const [currentUserId, setCurrentUserId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const listRef = useRef<FlatList<Message>>(null);

  // Load current authenticated user
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const storedUser =
          (await AsyncStorage.getItem("user")) ||
          (await AsyncStorage.getItem("userData"));

        if (!storedUser) {
          setError("User session not found. Please login again.");
          setLoading(false);
          return;
        }

        const parsedUser = JSON.parse(storedUser);

        const id =
          parsedUser._id ||
          parsedUser.id ||
          parsedUser.userId;

        if (!id) {
          setError("Unable to identify the logged-in user.");
          setLoading(false);
          return;
        }

        setCurrentUserId(String(id));
      } catch (err) {
        setError("Unable to load user information.");
        setLoading(false);
      }
    };

    loadCurrentUser();
  }, []);

  // Fetch history and connect socket
  useEffect(() => {
    if (!currentUserId || !userId) return;

    let mounted = true;

    const loadChat = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await API.get(
          `/chat/messages/${userId}`
        );

        if (mounted && response.data.success) {
          setMessages(response.data.messages || []);
        }

        // Mark messages received from this contact as read
        await API.patch(`/chat/read/${userId}`);
      } catch (err) {
        if (mounted) {
          setError(
            getErrorMessage(err, "Unable to load chat messages.")
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadChat();

    const token = AsyncStorage.getItem("token");

    token.then((value) => {
      if (!mounted || !value) return;

      const socket = connectChatSocket(value);

      const handleIncomingMessage = (newMessage: Message) => {
        const senderId = getId(newMessage.senderId);
        const receiverId = getId(newMessage.receiverId);

        const belongsToChat =
          (senderId === currentUserId && receiverId === userId) ||
          (senderId === userId && receiverId === currentUserId);

        if (!belongsToChat) return;

        setMessages((previous) => {
          if (
            previous.some((item) => item._id === newMessage._id)
          ) {
            return previous;
          }

          return [...previous, newMessage];
        });

        // Mark incoming message as read
        if (senderId === userId) {
          API.patch(`/chat/read/${userId}`).catch((err) => {
            console.log("Mark read error:", err);
          });
        }
      };

      socket.on("chat:receive", handleIncomingMessage);

      return () => {
        socket.off("chat:receive", handleIncomingMessage);
      };
    });

    return () => {
      mounted = false;
    };
  }, [currentUserId, userId]);

  // Scroll to the latest message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessage = () => {
    const trimmedMessage = input.trim();

    if (!trimmedMessage || !userId || sending) return;

    const socket = connectChatSocket("");

    if (!socket.connected) {
      setError("Chat connection unavailable. Please try again.");
      return;
    }

    setSending(true);
    setError("");

    socket.emit(
      "chat:send",
      {
        receiverId: userId,
        message: trimmedMessage,
      },
      (response: {
        success: boolean;
        data?: Message;
        message?: string;
      }) => {
        setSending(false);

        if (!response?.success || !response.data) {
          setError(response?.message || "Message could not be sent.");
          return;
        }

        setMessages((previous) => {
          if (
            previous.some((item) => item._id === response.data!._id)
          ) {
            return previous;
          }

          return [...previous, response.data!];
        });

        setInput("");
      }
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = getId(item.senderId) === currentUserId;

    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.myRow : styles.otherRow,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myBubble : styles.otherBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMine && styles.myMessageText,
            ]}
          >
            {item.message}
          </Text>

          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.time,
                isMine && styles.myTime,
              ]}
            >
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>

            {isMine && (
              <Text style={styles.readStatus}>
                {item.isRead ? "✓✓" : "✓"}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(name || "U").charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.headerDetails}>
            <Text style={styles.headerName}>
              {name || "Chat"}
            </Text>

            <Text style={styles.headerStatus}>
              Student • Faculty Chat
            </Text>
          </View>
        </View>

        {/* Messages */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1769AA" />
            <Text style={styles.loadingText}>
              Loading messages...
            </Text>
          </View>
        ) : error && messages.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.retryText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item._id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                  Start a conversation
                </Text>

                <Text style={styles.emptyText}>
                  Send your first message.
                </Text>
              </View>
            }
          />
        )}

        {error !== "" && messages.length > 0 && (
          <Text style={styles.inlineError}>{error}</Text>
        )}

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor="#94A3B8"
            style={styles.input}
            multiline
            maxLength={2000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!input.trim() || sending) && styles.disabledButton,
            ]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.sendText}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: "#F5F8FC",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5EAF1",
  },

  backButton: {
    marginRight: 12,
    paddingHorizontal: 4,
  },

  backText: {
    fontSize: 32,
    color: "#1769AA",
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E3F0FC",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: "#1769AA",
    fontWeight: "700",
    fontSize: 17,
  },

  headerDetails: {
    marginLeft: 12,
    flex: 1,
  },

  headerName: {
    color: "#172B4D",
    fontSize: 17,
    fontWeight: "700",
  },

  headerStatus: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },

  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexGrow: 1,
  },

  messageRow: {
    flexDirection: "row",
    marginVertical: 5,
  },

  myRow: {
    justifyContent: "flex-end",
  },

  otherRow: {
    justifyContent: "flex-start",
  },

  messageBubble: {
    maxWidth: "82%",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 16,
  },

  myBubble: {
    backgroundColor: "#1769AA",
    borderBottomRightRadius: 4,
  },

  otherBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E5EAF1",
  },

  messageText: {
    fontSize: 15,
    color: "#172B4D",
  },

  myMessageText: {
    color: "#FFFFFF",
  },

  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 5,
  },

  time: {
    fontSize: 10,
    color: "#64748B",
  },

  myTime: {
    color: "#DCEBFA",
  },

  readStatus: {
    fontSize: 11,
    color: "#DCEBFA",
    marginLeft: 4,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5EAF1",
  },

  input: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    color: "#172B4D",
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1769AA",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  disabledButton: {
    opacity: 0.5,
  },

  sendText: {
    color: "#FFFFFF",
    fontSize: 20,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    color: "#64748B",
  },

  errorText: {
    color: "#DC2626",
    textAlign: "center",
  },

  inlineError: {
    color: "#DC2626",
    textAlign: "center",
    padding: 6,
  },

  retryButton: {
    marginTop: 14,
    backgroundColor: "#1769AA",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },

  retryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#172B4D",
  },

  emptyText: {
    marginTop: 6,
    color: "#64748B",
  },
});

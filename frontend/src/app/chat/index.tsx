
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import API, { getErrorMessage } from "../../api/apiClient";
import { connectChatSocket } from "../../services/socket";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Contact = {
  _id: string;
  name: string;
  email: string;
  role: "student" | "faculty";
  lastMessage?: string;
  lastMessageAt?: string | null;
};

type ChatMessage = {
  senderId: string | { _id: string };
  message: string;
  createdAt: string;
};

const applyReceivedMessages = (
  contacts: Contact[],
  receivedMessages: Record<string, { message: string; createdAt: string }>
) =>
  contacts
    .map((contact) => {
      const receivedMessage = receivedMessages[contact._id];
      if (
        !receivedMessage ||
        (contact.lastMessageAt &&
          new Date(contact.lastMessageAt).getTime() >=
            new Date(receivedMessage.createdAt).getTime())
      ) {
        return contact;
      }

      return {
        ...contact,
        lastMessage: receivedMessage.message,
        lastMessageAt: receivedMessage.createdAt,
      };
    })
    .sort((a, b) => {
      if (!a.lastMessageAt) return b.lastMessageAt ? 1 : 0;
      if (!b.lastMessageAt) return -1;
      return (
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
      );
    });

export default function ChatContactsScreen() {
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const receivedMessages = useRef<
    Record<string, { message: string; createdAt: string }>
  >({});

  const initializeChat = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/chat/contacts");
      if (response.data.success) {
        setContacts(
          applyReceivedMessages(
            response.data.contacts || [],
            receivedMessages.current
          )
        );
      }
    } catch (err: any) {
      setError(getErrorMessage(err, "Unable to load chat contacts."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const setupSocket = async () => {
      const token = await AsyncStorage.getItem("token");
      if (!active || !token) return;

      const socket = connectChatSocket(token);
      const handleIncomingMessage = (message: ChatMessage) => {
        const senderId =
          typeof message.senderId === "string"
            ? message.senderId
            : message.senderId?._id;

        if (!senderId) return;

        receivedMessages.current[senderId] = {
          message: message.message,
          createdAt: message.createdAt,
        };

        setContacts((previous) => {
          const contactIndex = previous.findIndex(
            (contact) => contact._id === senderId
          );
          if (contactIndex < 0) return previous;

          const updatedContact = {
            ...previous[contactIndex],
            lastMessage: message.message,
            lastMessageAt: message.createdAt,
          };

          return [
            updatedContact,
            ...previous.filter((contact) => contact._id !== senderId),
          ];
        });
      };

      socket.on("chat:receive", handleIncomingMessage);
      cleanupSocket = () => {
        socket.off("chat:receive", handleIncomingMessage);
      };
    };

    let cleanupSocket = () => {};
    const initialize = async () => {
      try {
        await setupSocket();
      } catch (err: any) {
        if (active) {
          setError(getErrorMessage(err, "Unable to connect to chat."));
        }
      }

    };

    void initialize();

    return () => {
      active = false;
      cleanupSocket();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void initializeChat();
    }, [initializeChat])
  );

  const filteredContacts = contacts.filter((contact) => {
    const query = search.toLowerCase();

    return (
      contact.name?.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.role?.toLowerCase().includes(query)
    );
  });

  const openChat = (contact: Contact) => {
    router.push({
      pathname: "/chat/[userId]",
      params: {
        userId: contact._id,
        name: contact.name,
      },
    });
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const initials = item.name
      ? item.name
          .split(" ")
          .map((word) => word[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "U";

    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => openChat(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.contactDetails}>
          <Text style={styles.contactName}>
            {item.name || "Unknown User"}
          </Text>

          <Text style={styles.contactEmail}>
            {item.email || ""}
          </Text>

          {item.lastMessage ? (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          ) : null}

          <Text style={styles.role}>
            {item.role === "faculty" ? "Faculty" : "Student"}
          </Text>
        </View>

        <Text style={styles.chatArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Messages</Text>

        <Text style={styles.subtitle}>
          Connect with students and faculty
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>⌕</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email or role..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1769AA" />

          <Text style={styles.loadingText}>
            Loading contacts...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={initializeChat}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filteredContacts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            No contacts found
          </Text>

          <Text style={styles.emptyText}>
            Students and faculty will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item._id}
          renderItem={renderContact}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8FC",
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },

  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#172B4D",
  },

  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 6,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  searchIcon: {
    fontSize: 25,
    color: "#64748B",
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: "#172B4D",
  },

  list: {
    paddingHorizontal: 20,
    paddingBottom: 25,
  },

  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 15,
    marginBottom: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E8EDF4",
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E3F0FC",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#1769AA",
    fontSize: 16,
    fontWeight: "700",
  },

  contactDetails: {
    flex: 1,
    marginLeft: 14,
  },

  contactName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#172B4D",
  },

  contactEmail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },

  lastMessage: {
    fontSize: 12,
    color: "#526579",
    marginTop: 5,
  },

  role: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1769AA",
    marginTop: 5,
    textTransform: "capitalize",
  },

  chatArrow: {
    fontSize: 28,
    color: "#94A3B8",
    marginLeft: 8,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },

  loadingText: {
    color: "#64748B",
    marginTop: 12,
  },

  errorText: {
    color: "#DC2626",
    textAlign: "center",
  },

  retryButton: {
    backgroundColor: "#1769AA",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 15,
  },

  retryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#172B4D",
  },

  emptyText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 8,
    textAlign: "center",
  },
});

import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useConversation } from "@realtalk-ai/react-native";
import type { ConversationMode, Message } from "@realtalk-ai/core";

const AGENT_ID = process.env.EXPO_PUBLIC_AGENT_ID ?? "";

const ORANGE = "#F97316";
const ORANGE_DIM = "rgba(249, 115, 22, 0.15)";
const BG = "#0f0f23";
const SURFACE = "#1a1a2e";
const TEXT_PRIMARY = "#f0f0f0";
const TEXT_SECONDARY = "#8888aa";
const RED = "#EF4444";

function PulsingIndicator({
  color,
  size = 10,
}: {
  color: string;
  size?: number;
}) {
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 2,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [ringScale, ringOpacity]);

  return (
    <View style={{ width: size * 3, height: size * 3, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function FadeRow({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      const delay = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setMounted(false);
        });
      }, 800);
      return () => clearTimeout(delay);
    }
  }, [visible, mounted, opacity]);

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.indicatorRow, { opacity }]}>
      {children}
    </Animated.View>
  );
}

function StatusIndicators({
  agentState,
  userState,
}: {
  agentState: "idle" | "thinking" | "speaking";
  userState: "idle" | "speaking";
}) {
  return (
    <>
      <FadeRow visible={userState === "speaking"}>
        <PulsingIndicator color={ORANGE} size={8} />
        <Text style={styles.indicatorText}>User is speaking...</Text>
      </FadeRow>
      <FadeRow visible={agentState === "thinking"}>
        <PulsingIndicator color="#22C55E" size={8} />
        <Text style={styles.indicatorText}>Agent is thinking...</Text>
      </FadeRow>
    </>
  );
}

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<ConversationMode>("voice");
  const [textInput, setTextInput] = useState("");
  const flatListRef = useRef<FlatList<Message>>(null);

  const {
    connectionStatus,
    status,
    messages,
    error,
    agentState,
    userState,
    isMicMuted,
    isAudioMuted,
    startConversation,
    endConversation,
    sendMessage,
    toggleMic,
    toggleAudio,
  } = useConversation({
    onMessage: () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
  });

  const isConnected = connectionStatus === "connected";
  const isDisconnected =
    status === "not_started" || status === "finished";

  const handleStart = async () => {
    try {
      await startConversation({ agentId: AGENT_ID, mode });
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  };

  const handleSend = () => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setTextInput("");
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isAgent = item.role === "agent";
    return (
      <View
        style={[
          styles.messageBubble,
          isAgent ? styles.agentBubble : styles.userBubble,
        ]}
      >
        <Text style={[styles.messageRole, isAgent ? styles.agentRole : styles.userRole]}>
          {isAgent ? "Agent" : "You"}
        </Text>
        <Text style={styles.messageText}>{item.text || "..."}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />

      {isDisconnected ? (
        /* ── Main Menu ── */
        <View style={styles.menuContainer}>
          <View style={styles.menuContent}>
            <Image
              source={require("../assets/logo.png")}
              style={styles.menuLogo}
              resizeMode="contain"
              tintColor="#ffffff"
            />
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, mode === "voice" && styles.modeButtonActive]}
                onPress={() => setMode("voice")}
              >
                <Text style={[styles.modeButtonText, mode === "voice" && styles.modeButtonTextActive]}>
                  Voice
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, mode === "text" && styles.modeButtonActive]}
                onPress={() => setMode("text")}
              >
                <Text style={[styles.modeButtonText, mode === "text" && styles.modeButtonTextActive]}>
                  Text
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.startButton} onPress={handleStart}>
              <Text style={styles.startButtonText}>Start Conversation</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ── Conversation View ── */
        <>
          <View style={styles.header}>
            <Image
              source={require("../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
              tintColor="#ffffff"
            />
          </View>

          {error && (
            <View style={styles.errorBar}>
              <Text style={styles.errorText}>{error.error.message}</Text>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            ListFooterComponent={
              <StatusIndicators agentState={agentState} userState={userState} />
            }
          />

          <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {isConnected && mode === "text" && (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#555"
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                />
                <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                  <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            )}

            {isConnected && mode === "voice" && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.muteButton, isMicMuted && styles.muteButtonActive]}
                  onPress={toggleMic}
                >
                  <Text style={[styles.muteButtonText, isMicMuted && styles.muteButtonTextActive]}>
                    {isMicMuted ? "Unmute Mic" : "Mute Mic"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.muteButton, isAudioMuted && styles.muteButtonActive]}
                  onPress={toggleAudio}
                >
                  <Text style={[styles.muteButtonText, isAudioMuted && styles.muteButtonTextActive]}>
                    {isAudioMuted ? "Unmute Agent" : "Mute Agent"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.endButton} onPress={endConversation}>
              <Text style={styles.endButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  logo: {
    width: 160,
    height: 40,
  },

  /* ── Main Menu ── */
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  menuContent: {
    gap: 20,
  },
  menuLogo: {
    width: 300,
    height: 75,
    alignSelf: "center",
    marginBottom: 80,
  },
  modeToggle: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: ORANGE,
  },
  modeButtonText: {
    color: TEXT_SECONDARY,
    fontWeight: "bold",
    fontSize: 17,
  },
  modeButtonTextActive: {
    color: "#fff",
  },
  startButton: {
    backgroundColor: ORANGE,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  startButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },

  /* ── Conversation ── */
  errorBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  errorText: {
    color: RED,
    fontSize: 13,
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  indicatorText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    gap: 8,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 14,
    maxWidth: "80%",
  },
  agentBubble: {
    backgroundColor: SURFACE,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: ORANGE_DIM,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  messageRole: {
    fontSize: 11,
    marginBottom: 4,
    fontWeight: "600",
  },
  agentRole: {
    color: TEXT_SECONDARY,
  },
  userRole: {
    color: ORANGE,
  },
  messageText: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 21,
  },
  controls: {
    padding: 16,
    backgroundColor: SURFACE,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: BG,
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sendButton: {
    backgroundColor: ORANGE,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  muteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  muteButtonActive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: RED,
  },
  muteButtonText: {
    color: TEXT_PRIMARY,
    fontWeight: "600",
  },
  muteButtonTextActive: {
    color: RED,
  },
  endButton: {
    backgroundColor: RED,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  endButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
});

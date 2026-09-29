import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { CyberTheme } from '../theme/colors';

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  isDelivered: boolean;
  isRead: boolean;
  isStreakSnap?: boolean;
}

interface ChatScreenProps {
  friendId: string;
  friendUsername: string;
  currentStreak: number;
  isExpiringSoon?: boolean;
  onSendSnapPress: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  friendUsername,
  currentStreak,
  isExpiringSoon = false,
  onSendSnapPress,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      senderId: 'friend',
      text: 'Hey! Did you check out the new dark cyberpunk theme on X Chatter?',
      timestamp: '11:02 AM',
      isDelivered: true,
      isRead: true,
    },
    {
      id: '2',
      senderId: 'me',
      text: 'Yes! The glowing pink and blue accents look futuristic 🔥',
      timestamp: '11:03 AM',
      isDelivered: true,
      isRead: true,
    },
    {
      id: '3',
      senderId: 'friend',
      text: 'Sent you our daily photo snap! 📸 Keep the fire going!',
      timestamp: '11:04 AM',
      isDelivered: true,
      isRead: true,
      isStreakSnap: true,
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'me',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isDelivered: true,
      isRead: false,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Top Chat Header */}
      <View style={styles.header}>
        <View style={styles.headerUserInfo}>
          <View style={styles.avatarBorder}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }}
              style={styles.avatar}
            />
            <View style={styles.onlineBadge} />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerTitle}>{friendUsername}</Text>
            <Text style={styles.headerSubtitle}>Signal Protocol E2EE • Active</Text>
          </View>
        </View>

        {/* Streak Counter Header Pill */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={onSendSnapPress}
            style={[
              styles.streakBadge,
              isExpiringSoon && styles.streakExpiringGlow,
            ]}
          >
            <Text style={styles.streakText}>🔥 {currentStreak}</Text>
            {isExpiringSoon && (
              <Text style={styles.urgencyText}>2h left!</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Persistent Chat Notice */}
      <View style={styles.encryptionNotice}>
        <Text style={styles.encryptionNoticeText}>
          🔒 End-to-End Encrypted. Chat history is preserved (No auto-delete).
        </Text>
      </View>

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => {
          const isMe = item.senderId === 'me';
          return (
            <View
              style={[
                styles.messageRow,
                isMe ? styles.messageRowMe : styles.messageRowFriend,
              ]}
            >
              {item.isStreakSnap ? (
                // Streak Photo Snap Card
                <View style={styles.snapCard}>
                  <View style={styles.snapCardHeader}>
                    <Text style={styles.snapCardTitle}>🔥 Daily Photo Snap</Text>
                    <Text style={styles.snapCardTag}>24h Snap</Text>
                  </View>
                  <Text style={styles.snapCardBody}>{item.text}</Text>
                  <TouchableOpacity
                    style={styles.snapReplyButton}
                    onPress={onSendSnapPress}
                  >
                    <Text style={styles.snapReplyButtonText}>Snap Back 📸</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Regular Encrypted Chat Bubble
                <View
                  style={[
                    styles.chatBubble,
                    isMe ? styles.bubbleMe : styles.bubbleFriend,
                  ]}
                >
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                    {item.text}
                  </Text>
                </View>
              )}

              {/* Timestamp & Read Status */}
              <View style={styles.metaRow}>
                <Text style={styles.timestampText}>{item.timestamp}</Text>
                {isMe && (
                  <Text style={styles.readReceipt}>
                    {item.isRead ? '✓✓' : '✓'}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Typing Indicator */}
      {isTyping && (
        <View style={styles.typingIndicatorContainer}>
          <Text style={styles.typingText}>{friendUsername} is typing...</Text>
        </View>
      )}

      {/* Bottom Multimedia Chat Input Bar */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.iconButton} onPress={onSendSnapPress}>
          <Text style={styles.iconText}>📸</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <Text style={styles.iconText}>🎙️</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          placeholder="Encrypted message..."
          placeholderTextColor={CyberTheme.textMuted}
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendMessage}
        >
          <Text style={styles.sendButtonText}>➔</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CyberTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: CyberTheme.surface,
    borderBottomWidth: 1,
    borderBottomColor: CyberTheme.surfaceBorder,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBorder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: CyberTheme.neonPink,
    padding: 2,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: CyberTheme.onlineGreen,
    borderWidth: 2,
    borderColor: CyberTheme.surface,
  },
  headerTitle: {
    color: CyberTheme.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerSubtitle: {
    color: CyberTheme.neonCyan,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderWidth: 1,
    borderColor: CyberTheme.streakOrange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  streakExpiringGlow: {
    borderColor: CyberTheme.neonPink,
    backgroundColor: 'rgba(255, 0, 127, 0.2)',
  },
  streakText: {
    color: CyberTheme.streakOrange,
    fontWeight: 'bold',
    fontSize: 13,
  },
  urgencyText: {
    color: CyberTheme.neonPink,
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  encryptionNotice: {
    backgroundColor: '#0a0a14',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2b',
    alignItems: 'center',
  },
  encryptionNoticeText: {
    color: CyberTheme.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  messageList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  messageRowMe: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowFriend: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  chatBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: CyberTheme.neonPink,
    borderTopRightRadius: 4,
    ...CyberTheme.shadowGlowPink,
  },
  bubbleFriend: {
    backgroundColor: CyberTheme.surfaceLight,
    borderWidth: 1,
    borderColor: CyberTheme.surfaceBorder,
    borderTopLeftRadius: 4,
  },
  bubbleText: {
    color: CyberTheme.textPrimary,
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleTextMe: {
    fontWeight: '500',
  },
  snapCard: {
    width: 240,
    backgroundColor: CyberTheme.surface,
    borderWidth: 1,
    borderColor: CyberTheme.streakOrange,
    borderRadius: 16,
    padding: 12,
  },
  snapCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  snapCardTitle: {
    color: CyberTheme.streakOrange,
    fontWeight: 'bold',
    fontSize: 12,
  },
  snapCardTag: {
    color: CyberTheme.neonCyan,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  snapCardBody: {
    color: CyberTheme.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  snapReplyButton: {
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    borderWidth: 1,
    borderColor: CyberTheme.streakOrange,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  snapReplyButtonText: {
    color: '#FFA500',
    fontWeight: 'bold',
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginHorizontal: 4,
  },
  timestampText: {
    color: CyberTheme.textMuted,
    fontSize: 10,
  },
  readReceipt: {
    color: CyberTheme.neonCyan,
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  typingIndicatorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingText: {
    color: CyberTheme.neonCyan,
    fontSize: 11,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: CyberTheme.surface,
    borderTopWidth: 1,
    borderTopColor: CyberTheme.surfaceBorder,
  },
  iconButton: {
    padding: 8,
    marginRight: 4,
  },
  iconText: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    backgroundColor: CyberTheme.surfaceLight,
    borderWidth: 1,
    borderColor: CyberTheme.surfaceBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: CyberTheme.textPrimary,
    fontSize: 14,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CyberTheme.neonCyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    ...CyberTheme.shadowGlowCyan,
  },
  sendButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

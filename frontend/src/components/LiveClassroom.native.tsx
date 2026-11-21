import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  PermissionsAndroid,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  RtcSurfaceView,
  VideoSourceType,
  type IRtcEngine,
} from 'react-native-agora';
import type { Socket } from 'socket.io-client';

import { getErrorMessage } from '../api/apiClient';
import {
  endClassroom,
  getClassroomMessages,
  getClassroomParticipants,
  leaveClassroom,
  refreshClassroomToken,
  type ClassroomMessage,
  type ClassroomParticipant,
} from '../api/classroomApi';
import { createClassroomSocket } from '../api/classroomSocket';
import { getStoredUser } from '../api/session';
import { Button, COLORS, Header, Screen } from './portal';

const requiredParam = (value: string | string[] | undefined, name: string) => {
  const result = Array.isArray(value) ? value[0] : value;
  if (!result) throw new Error(`Missing classroom ${name}.`);
  return result;
};

const checkAgora = (result: number, action: string) => {
  if (result < 0) throw new Error(`Agora could not ${action} (error ${result}).`);
};

export default function LiveClassroom() {
  const params = useLocalSearchParams<{
    classroomId?: string;
    title?: string;
  }>();
  const classroomId = Array.isArray(params.classroomId)
    ? params.classroomId[0]
    : params.classroomId;
  const title = Array.isArray(params.title) ? params.title[0] : params.title;

  const engineRef = useRef<IRtcEngine | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const leavingRef = useRef(false);
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [classTitle, setClassTitle] = useState(title || 'Live classroom');
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [sharedScreenUids, setSharedScreenUids] = useState<number[]>([]);
  const [participants, setParticipants] = useState<ClassroomParticipant[]>([]);
  const [messages, setMessages] = useState<ClassroomMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const refreshParticipants = useCallback(async () => {
    if (!classroomId) return;
    setParticipants(await getClassroomParticipants(classroomId));
  }, [classroomId]);

  const refreshToken = useCallback(async () => {
    if (!classroomId || !engineRef.current) return;
    const updated = await refreshClassroomToken(classroomId);
    engineRef.current.renewToken(updated.token);
  }, [classroomId]);

  const joinRealtimeRoom = useCallback(
    (socket: Socket) => {
      if (!classroomId) return;
      socket.emit('classroom:join', { classroomId }, (result: { success: boolean; message?: string }) => {
        if (!result?.success && result?.message) setError(result.message);
      });
    },
    [classroomId]
  );

  useEffect(() => {
    let active = true;
    let engine: IRtcEngine | null = null;
    let socket: Socket | null = null;

    const initialize = async () => {
      try {
        const id = requiredParam(classroomId, 'ID');
        const credentials = await refreshClassroomToken(id);
        const channel = requiredParam(credentials.channelName, 'channel');
        const token = requiredParam(credentials.token, 'token');
        const agoraAppId = requiredParam(credentials.appId, 'App ID');
        const uid = credentials.uid;
        if (!Number.isSafeInteger(uid) || uid <= 0) {
          throw new Error('The classroom participant ID is invalid.');
        }
        if (active) setClassTitle(title || credentials.title);

        if (Platform.OS === 'android') {
          const permissionResults = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
          if (
            permissionResults[PermissionsAndroid.PERMISSIONS.CAMERA] !== PermissionsAndroid.RESULTS.GRANTED ||
            permissionResults[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED
          ) {
            throw new Error('Camera and microphone permissions are required to join.');
          }
        }

        const [storedUser, initialMessages, initialParticipants] = await Promise.all([
          getStoredUser(),
          getClassroomMessages(id),
          getClassroomParticipants(id),
        ]);
        if (!active) return;
        setUserRole(storedUser?.role || '');
        setUserId(storedUser?.id || storedUser?._id || '');
        setMessages(initialMessages);
        setParticipants(initialParticipants);

        engine = createAgoraRtcEngine();
        engineRef.current = engine;
        engine.initialize({ appId: agoraAppId });
        engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
        engine.enableVideo();
        engine.startPreview();
        engine.setEnableSpeakerphone(true);
        engine.registerEventHandler({
          onJoinChannelSuccess: () => {
            if (active) setJoined(true);
          },
          onUserJoined: (_connection, remoteUid) => {
            if (active) setRemoteUids((previous) => [...new Set([...previous, remoteUid])]);
          },
          onUserOffline: (_connection, remoteUid) => {
            if (active) setRemoteUids((previous) => previous.filter((id) => id !== remoteUid));
          },
          onTokenPrivilegeWillExpire: () => {
            void refreshToken().catch((tokenError) => {
              if (active) setError(getErrorMessage(tokenError, 'Unable to refresh the live-class token.'));
            });
          },
        });
        checkAgora(
          engine.joinChannel(token, channel, uid, {
            channelProfile: ChannelProfileType.ChannelProfileCommunication,
            clientRoleType: ClientRoleType.ClientRoleBroadcaster,
            publishCameraTrack: true,
            publishMicrophoneTrack: true,
            autoSubscribeAudio: true,
            autoSubscribeVideo: true,
          }),
          'join the class'
        );

        socket = await createClassroomSocket();
        if (!active) {
          socket.disconnect();
          return;
        }
        socketRef.current = socket;
        socket.on('classroom:message', (message: ClassroomMessage) => {
          if (active) setMessages((previous) => [...previous, message]);
        });
        socket.on('classroom:presence-changed', () => {
          void refreshParticipants().catch((participantError) => {
            if (active) setError(getErrorMessage(participantError, 'Unable to refresh the participant list.'));
          });
        });
        socket.on('classroom:screen-sharing', (event: { uid: number; sharing: boolean }) => {
          if (!active || !Number.isSafeInteger(event?.uid)) return;
          setSharedScreenUids((previous) =>
            event.sharing
              ? [...new Set([...previous, event.uid])]
              : previous.filter((uid) => uid !== event.uid)
          );
        });
        socket.on('classroom:screen-sharing-state', (uids: number[]) => {
          if (active && Array.isArray(uids)) {
            setSharedScreenUids(uids.filter((uid) => Number.isSafeInteger(uid)));
          }
        });
        socket.on('classroom:ended', () => {
          if (active && !leavingRef.current) {
            Alert.alert('Class ended', 'The faculty has ended this live class.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          }
        });
        socket.on('classroom:error', (socketError: { message?: string }) => {
          if (active && socketError.message) setError(socketError.message);
        });
        socket.on('connect', () => {
          void refreshToken()
            .then(() => joinRealtimeRoom(socket as Socket))
            .catch((tokenError) => {
              if (active) setError(getErrorMessage(tokenError, 'Unable to reconnect to the live class.'));
            });
        });
        socket.on('connect_error', (socketError) => {
          if (active) setError(getErrorMessage(socketError, 'Live chat connection failed.'));
        });
        socket.connect();
        if (socket.connected) joinRealtimeRoom(socket);
        setBusy(false);
      } catch (e) {
        if (active) {
          setError(getErrorMessage(e, 'Unable to join the live classroom.'));
          setBusy(false);
        }
        if (engine) {
          engine.leaveChannel();
          engine.release();
          engineRef.current = null;
        }
      }
    };

    void initialize();

    return () => {
      active = false;
      socket?.disconnect();
      socketRef.current = null;
      if (engine) {
        engine.stopScreenCapture();
        engine.leaveChannel();
        engine.release();
        engineRef.current = null;
      }
      if (!leavingRef.current && classroomId) {
        void leaveClassroom(classroomId).catch((leaveError) => {
          console.warn('Unable to record classroom leave:', leaveError);
        });
      }
    };
  }, [
    classroomId,
    joinRealtimeRoom,
    refreshParticipants,
    refreshToken,
    title,
  ]);

  const activeParticipants = useMemo(
    () => participants.filter((participant) => !participant.leftAt),
    [participants]
  );

  const toggleMicrophone = () => {
    const next = !muted;
    try {
      checkAgora(engineRef.current?.muteLocalAudioStream(next) ?? -1, 'change the microphone');
      setMuted(next);
    } catch (e) {
      Alert.alert('Microphone', getErrorMessage(e, 'Unable to change the microphone.'));
    }
  };

  const toggleCamera = () => {
    const next = !cameraOff;
    try {
      checkAgora(engineRef.current?.enableLocalVideo(!next) ?? -1, 'change the camera');
      setCameraOff(next);
    } catch (e) {
      Alert.alert('Camera', getErrorMessage(e, 'Unable to change the camera.'));
    }
  };

  const toggleSpeaker = () => {
    const next = !speakerOn;
    try {
      checkAgora(engineRef.current?.setEnableSpeakerphone(next) ?? -1, 'change the speaker');
      setSpeakerOn(next);
    } catch (e) {
      Alert.alert('Audio output', getErrorMessage(e, 'Unable to change the audio output.'));
    }
  };

  const toggleScreenShare = () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Screen sharing unavailable',
        'Android screen sharing is supported. iOS requires a ReplayKit broadcast extension in the native project.'
      );
      return;
    }
    const engine = engineRef.current;
    if (!engine) return;
    try {
      if (sharing) {
        checkAgora(engine.stopScreenCapture(), 'stop screen sharing');
        checkAgora(
          engine.updateChannelMediaOptions({ publishScreenCaptureVideo: false }),
          'stop publishing the screen'
        );
        socketRef.current?.emit('classroom:screen-sharing', {
          classroomId,
          sharing: false,
        });
        setSharing(false);
      } else {
        checkAgora(
          engine.startScreenCapture({
            captureAudio: false,
            captureVideo: true,
            videoParams: { dimensions: { width: 1280, height: 720 }, frameRate: 15 },
          }),
          'start screen sharing'
        );
        try {
          checkAgora(
            engine.updateChannelMediaOptions({ publishScreenCaptureVideo: true }),
            'publish the screen'
          );
        } catch (error) {
          engine.stopScreenCapture();
          throw error;
        }
        socketRef.current?.emit('classroom:screen-sharing', {
          classroomId,
          sharing: true,
        });
        setSharing(true);
      }
    } catch (e) {
      Alert.alert('Screen sharing', getErrorMessage(e, 'Unable to change screen sharing.'));
    }
  };

  const sendMessage = () => {
    const message = draft.trim();
    const socket = socketRef.current;
    if (!message || !socket?.connected || !classroomId || sending) return;
    setSending(true);
    socket.emit('classroom:message', { classroomId, message });
    setDraft('');
    setSending(false);
  };

  const leave = async (endForEveryone: boolean) => {
    if (!classroomId || leavingRef.current) return;
    leavingRef.current = true;
    try {
      if (endForEveryone) {
        await endClassroom(classroomId);
      } else {
        await leaveClassroom(classroomId);
      }
      router.back();
    } catch (e) {
      leavingRef.current = false;
      Alert.alert('Unable to leave class', getErrorMessage(e, 'Please try again.'));
    }
  };

  return (
    <Screen>
      <Header
        title={classTitle}
        subtitle={joined ? 'Live now' : 'Connecting…'}
        right={
          userRole === 'faculty' ? (
            <Pressable onPress={() => void leave(true)} style={styles.endButton}>
              <Text style={styles.endText}>End class</Text>
            </Pressable>
          ) : undefined
        }
      />
      {busy ? (
        <View style={styles.center}>
          <Text style={styles.statusText}>Joining live classroom…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.videoArea}>
            {joined ? (
              <RtcSurfaceView
                canvas={{ uid: remoteUids[0] ?? 0 }}
                style={styles.mainVideo}
                zOrderMediaOverlay={false}
              />
            ) : (
              <View style={[styles.mainVideo, styles.center]}>
                <Text style={styles.statusText}>Connecting video…</Text>
              </View>
            )}
            {remoteUids.length > 0 &&
              (cameraOff ? (
                <View style={[styles.localPreview, styles.center, { backgroundColor: '#263744' }]}>
                  <Ionicons name="videocam-off" size={22} color="#FFF" />
                  <Text style={styles.localName}>Camera off</Text>
                </View>
              ) : (
                <RtcSurfaceView
                  canvas={{ uid: 0 }}
                  style={styles.localPreview}
                  zOrderMediaOverlay
                />
              ))}
            {cameraOff && remoteUids.length === 0 && (
              <View style={[styles.localPreview, styles.center, { backgroundColor: '#263744' }]}>
                <Ionicons name="videocam-off" size={26} color="#FFF" />
                <Text style={styles.localName}>Camera off</Text>
              </View>
            )}
            <View style={styles.nameBadge}>
              <Text style={styles.nameBadgeText}>
                {remoteUids.length ? `Participant ${remoteUids[0]}` : 'You'}
                {muted ? ' · muted' : ''}
              </Text>
            </View>
            {remoteUids.slice(1).map((remoteUid, index) => (
              <View
                key={remoteUid}
                style={[styles.remoteVideoCard, { bottom: 10 + index * 138 }]}
              >
                <RtcSurfaceView canvas={{ uid: remoteUid }} style={styles.remoteVideo} />
                <Text style={styles.remoteLabel}>Participant {remoteUid}</Text>
              </View>
            ))}
            {sharedScreenUids.map((remoteUid) => (
              <View key={`screen-${remoteUid}`} style={styles.sharedScreenCard}>
                <RtcSurfaceView
                  canvas={{
                    uid: remoteUid,
                    sourceType: VideoSourceType.VideoSourceScreenPrimary,
                  }}
                  style={styles.remoteVideo}
                />
                <Text style={styles.remoteLabel}>Shared screen</Text>
              </View>
            ))}
            {sharing && (
              <View style={styles.sharingBadge}>
                <Ionicons name="desktop-outline" size={15} color="#FFF" />
                <Text style={styles.nameBadgeText}>Sharing screen</Text>
              </View>
            )}
          </View>

          <View style={styles.controlRow}>
            <ControlButton
              icon={muted ? 'mic-off' : 'mic'}
              label={muted ? 'Unmute' : 'Mute'}
              active={muted}
              onPress={toggleMicrophone}
            />
            <ControlButton
              icon={cameraOff ? 'videocam-off' : 'videocam'}
              label={cameraOff ? 'Camera on' : 'Camera'}
              active={cameraOff}
              onPress={toggleCamera}
            />
            <ControlButton
              icon={speakerOn ? 'volume-high' : 'volume-mute'}
              label="Speaker"
              active={!speakerOn}
              onPress={toggleSpeaker}
            />
            <ControlButton
              icon={sharing ? 'stop-circle-outline' : 'share-outline'}
              label={sharing ? 'Stop share' : 'Share'}
              active={sharing}
              onPress={toggleScreenShare}
            />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.sectionTitle}>Participants ({activeParticipants.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.participantList}>
              {activeParticipants.map((participant) => (
                <View key={participant.id} style={styles.participantChip}>
                  <Ionicons
                    name={participant.role === 'faculty' ? 'school-outline' : 'person-outline'}
                    size={15}
                    color={COLORS.primary}
                  />
                  <Text style={styles.participantName} numberOfLines={1}>
                    {participant.id === userId ? 'You' : participant.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.chatContainer}>
            <Text style={styles.sectionTitle}>Live chat</Text>
            <ScrollView style={styles.chatList} contentContainerStyle={styles.chatMessages}>
              {messages.map((message) => (
                <View key={message._id} style={styles.message}>
                  <Text style={styles.messageSender}>{message.senderName}</Text>
                  <Text style={styles.messageText}>{message.message}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.chatComposer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message the class"
                placeholderTextColor="#9AAEBB"
                maxLength={2000}
                style={styles.chatInput}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <Pressable
                onPress={sendMessage}
                disabled={!draft.trim() || sending}
                style={[styles.sendButton, (!draft.trim() || sending) && styles.disabled]}
                accessibilityLabel="Send message"
              >
                <Ionicons name="send" size={18} color="#FFF" />
              </Pressable>
            </View>
          </View>

          <Button
            label="Leave class"
            variant="ghost"
            onPress={() => void leave(false)}
          />
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

function ControlButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.control}>
      <View style={[styles.controlIcon, active && styles.controlIconActive]}>
        <Ionicons name={icon} size={20} color={active ? '#FFF' : COLORS.primaryDark} />
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 14, gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  statusText: { color: COLORS.sub, fontSize: 14, fontWeight: '700' },
  error: { color: COLORS.danger, fontSize: 13 },
  endButton: { backgroundColor: COLORS.danger, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  endText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  videoArea: { minHeight: 220, maxHeight: 320, flex: 1, backgroundColor: '#0A1722', borderRadius: 18, overflow: 'hidden' },
  mainVideo: { width: '100%', height: '100%', backgroundColor: '#102432' },
  localPreview: { position: 'absolute', top: 10, right: 10, width: 92, height: 118, borderWidth: 1, borderColor: '#FFF8', borderRadius: 12, overflow: 'hidden', backgroundColor: '#263744' },
  localName: { color: '#FFF', fontWeight: '700', marginTop: 6 },
  nameBadge: { position: 'absolute', left: 10, bottom: 10, backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  nameBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  remoteVideoCard: { position: 'absolute', top: 10, right: 10, width: 105, height: 130, borderWidth: 1, borderColor: '#FFF8', borderRadius: 12, overflow: 'hidden', backgroundColor: '#21313C' },
  sharedScreenCard: { position: 'absolute', left: 10, top: 10, width: '70%', height: '70%', borderWidth: 1, borderColor: '#FFF8', borderRadius: 12, overflow: 'hidden', backgroundColor: '#21313C' },
  remoteVideo: { width: '100%', height: '100%' },
  remoteLabel: { position: 'absolute', left: 5, bottom: 4, color: '#FFF', fontSize: 10, fontWeight: '700' },
  sharingBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0009', borderRadius: 8, padding: 7 },
  controlRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 2 },
  control: { alignItems: 'center', gap: 4, minWidth: 62 },
  controlIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  controlIconActive: { backgroundColor: COLORS.danger },
  controlLabel: { color: COLORS.sub, fontSize: 10.5, fontWeight: '700' },
  infoRow: { gap: 8 },
  sectionTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  participantList: { gap: 8 },
  participantChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7, maxWidth: 150 },
  participantName: { color: COLORS.text, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  chatContainer: { flex: 1, minHeight: 140, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 10, gap: 8 },
  chatList: { flex: 1 },
  chatMessages: { gap: 7, paddingBottom: 8 },
  message: { alignSelf: 'flex-start', maxWidth: '90%', backgroundColor: COLORS.primarySoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  messageSender: { color: COLORS.primaryDark, fontSize: 10, fontWeight: '800' },
  messageText: { color: COLORS.text, fontSize: 12.5 },
  chatComposer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chatInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: COLORS.text, backgroundColor: COLORS.card },
  sendButton: { width: 38, height: 38, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
});

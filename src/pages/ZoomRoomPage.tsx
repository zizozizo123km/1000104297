/**
 * Zoom Live Page — Bac DZ AI
 * WebRTC Video/Audio via Socket.io Signaling
 * ─────────────────────────────────────────
 * Server: cd server && npm install && node index.js
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare,
  Monitor, MonitorOff, Crown, Send, Volume2, VolumeX,
  Plus, Trash2, Eye, Search, Copy, Users, Wifi, WifiOff,
  X, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getSocket } from '../lib/socket';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Room {
  id: string; name: string; subject: string;
  hostName: string; hostId?: string;
  code: string; maxSeats: number;
  seatCount: number; viewerCount: number;
  createdAt: number;
}
interface Seat {
  userId: string; userName: string;
  micOn: boolean; camOn: boolean; joinedAt: number;
}
interface ChatMsg {
  id: string; text: string; userName: string;
  userId: string; timestamp: number; isViewer?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_SEATS = 10;
const SUBJECTS = [
  'رياضيات','فيزياء','كيمياء','علوم طبيعية','فلسفة',
  'لغة عربية','لغة فرنسية','لغة إنجليزية','تاريخ وجغرافيا','اقتصاد وتسيير'
];
const COLORS = [
  '#7c3aed','#2563eb','#059669','#d97706',
  '#dc2626','#db2777','#0891b2','#65a30d',
];
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
};

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}
function initials(name: string) {
  return name?.slice(0, 2).toUpperCase() || '??';
}

// ─── VideoTile ────────────────────────────────────────────────────────────────
function VideoTile({
  seat, stream, isLocal, speaking
}: {
  seat: Seat | null; stream: MediaStream | null;
  isLocal?: boolean; speaking?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) { setVideoReady(false); return; }
    el.srcObject = stream;
    const onReady = () => { el.play().catch(() => {}); setVideoReady(true); };
    el.addEventListener('loadedmetadata', onReady);
    el.addEventListener('canplay', onReady);
    if (el.readyState >= 2) onReady();
    return () => {
      el.removeEventListener('loadedmetadata', onReady);
      el.removeEventListener('canplay', onReady);
    };
  }, [stream]);

  useEffect(() => {
    if (!stream || !seat?.camOn) setVideoReady(false);
  }, [stream, seat?.camOn]);

  const color  = seat ? getColor(seat.userName) : '#374151';
  const name   = seat?.userName || '';
  const showVid = stream && seat?.camOn && videoReady;

  return (
    <div
      className={`relative aspect-square rounded-xl overflow-hidden bg-gray-900 border-2 transition-all duration-200
        ${speaking ? 'border-green-400 shadow-lg shadow-green-400/30' : 'border-gray-700'}
        ${isLocal ? 'ring-2 ring-blue-500' : ''}`}
    >
      {/* Avatar */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-1"
        style={{ background: `${color}22` }}
      >
        <div
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base border-2"
          style={{ backgroundColor: color, borderColor: color }}
        >
          {initials(name)}
        </div>
        <span className="text-white text-[9px] sm:text-[10px] font-medium truncate max-w-[90%] text-center">
          {name.split(' ')[0] || ''}
        </span>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        autoPlay playsInline muted={isLocal}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300
          ${showVid ? 'opacity-100' : 'opacity-0'}
          ${isLocal ? 'scale-x-[-1]' : ''}`}
      />

      {/* Status badges */}
      <div className="absolute top-1 left-1 flex gap-0.5">
        {!seat?.micOn && (
          <div className="bg-red-500/90 rounded-full p-0.5">
            <MicOff className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" />
          </div>
        )}
        {!seat?.camOn && (
          <div className="bg-gray-600/90 rounded-full p-0.5">
            <VideoOff className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Voice indicator */}
      {speaking && seat?.micOn && (
        <div className="absolute bottom-1 right-1 flex items-end gap-px">
          {[3,5,4,6,3].map((h, i) => (
            <div key={i} className="w-0.5 bg-green-400 rounded-full animate-pulse"
              style={{ height: h + 'px', animationDelay: i * 80 + 'ms' }} />
          ))}
        </div>
      )}

      {isLocal && (
        <div className="absolute bottom-1 left-1 bg-blue-500/90 rounded px-1 py-0.5">
          <span className="text-white text-[8px] font-bold">أنت</span>
        </div>
      )}
    </div>
  );
}

// ─── EmptySeat ────────────────────────────────────────────────────────────────
function EmptySeat({ num, onJoin }: { num: number; onJoin?: () => void }) {
  return (
    <div
      onClick={onJoin}
      className={`aspect-square rounded-xl border-2 border-dashed border-gray-600 bg-gray-800/40
        flex flex-col items-center justify-center gap-1 transition-all duration-200
        ${onJoin ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-500/10 active:scale-95' : ''}`}
    >
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-700 flex items-center justify-center">
        <span className="text-gray-400 text-xs">{num}</span>
      </div>
    </div>
  );
}

// ─── RemoteAudio ──────────────────────────────────────────────────────────────
function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);
  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ZoomRoomPage() {
  const { user, isDarkMode: isDark } = useApp();

  // ── Socket state
  const [socketConnected, setSocketConnected] = useState(false);

  // ── Lobby state
  const [rooms, setRooms]           = useState<Room[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [foundRoom, setFoundRoom]   = useState<Room | null>(null);
  const [searching, setSearching]   = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newSubject, setNewSubject] = useState('رياضيات');
  const [creating, setCreating]     = useState(false);
  const [newRoomNotif, setNewRoomNotif] = useState<Room | null>(null);

  // ── Join dialog
  const [joinTarget, setJoinTarget] = useState<Room | null>(null);

  // ── Room/call state
  const [inRoom, setInRoom]         = useState(false);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [seats, setSeats]           = useState<Record<string, Seat>>({});
  const [viewers, setViewers]       = useState<Record<string, any>>({});
  const [isViewer, setIsViewer]     = useState(false);
  const [chat, setChat]             = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]   = useState('');
  const [showChat, setShowChat]     = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [micOn, setMicOn]           = useState(true);
  const [camOn, setCamOn]           = useState(true);
  const [speakerOn, setSpeakerOn]   = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [speaking, setSpeaking]     = useState<Record<string, boolean>>({});

  // ── WebRTC refs
  const userId         = useRef(user?.uid || genId());
  const userName       = useRef(user?.displayName || user?.email?.split('@')[0] || 'تلميذ');
  const localStream    = useRef<MediaStream | null>(null);
  const peerConns      = useRef<Record<string, RTCPeerConnection>>({});
  const remoteStreams   = useRef<Record<string, MediaStream>>({});
  const iceCandidates  = useRef<Record<string, RTCIceCandidate[]>>({});
  const [remoteStreamsState, setRemoteStreamsState] = useState<Record<string, MediaStream>>({});

  // ── Misc refs
  const chatEndRef     = useRef<HTMLDivElement>(null);
  const vadIntervalRef = useRef<any>(null);

  // ─── Socket.io setup ────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    const onConnect    = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setSocketConnected(true);

    // New room notification
    socket.on('new-room', (room: Room) => {
      setNewRoomNotif(room);
      setTimeout(() => setNewRoomNotif(null), 8000);
    });

    // Rooms list
    socket.on('rooms-list', (list: Room[]) => setRooms(list));

    // Room found by code
    socket.on('room-found',     (room: Room) => {
      setFoundRoom(room);
      setSearching(false);
      setJoinTarget(room);
    });
    socket.on('room-not-found', () => {
      toast.error('❌ لم يُعثر على غرفة بهذا الكود');
      setSearching(false);
    });

    // Room created
    socket.on('room-created', ({ roomId }: { roomId: string }) => {
      setCreating(false);
      toast.success('✅ تم إنشاء الغرفة!');
    });

    // Join success
    socket.on('join-success', ({ seats: s, viewers: v, chat: c }: any) => {
      setSeats(s || {});
      setViewers(v || {});
      setChat((c || []).map((m: any) => ({ ...m, id: m.id || genId() })));
      setInRoom(true);
    });

    // Join error
    socket.on('join-error', (msg: string) => {
      toast.error(msg);
    });

    // Room state update
    socket.on('room-state', ({ seats: s, viewers: v }: any) => {
      setSeats(s || {});
      setViewers(v || {});
    });

    // A new user joined → initiate WebRTC
    socket.on('user-joined', async ({ userId: uid, userName: uname }: any) => {
      if (uid === userId.current) return;
      await new Promise(r => setTimeout(r, 500));
      await createAndSendOffer(uid, uname);
    });

    // User left
    socket.on('user-left', ({ userId: uid }: { userId: string }) => {
      closePeer(uid);
      setSeats(prev => { const n = { ...prev }; delete n[uid]; return n; });
      setRemoteStreamsState(prev => { const n = { ...prev }; delete n[uid]; return n; });
    });

    // WebRTC signaling
    socket.on('signal-offer', handleOffer);
    socket.on('signal-answer', handleAnswer);
    socket.on('signal-ice', handleIce);

    // Media update
    socket.on('media-updated', ({ userId: uid, micOn: m, camOn: c }: any) => {
      setSeats(prev => prev[uid] ? { ...prev, [uid]: { ...prev[uid], micOn: m, camOn: c } } : prev);
    });

    // Chat
    socket.on('chat-message', (msg: ChatMsg) => {
      setChat(prev => [...prev, msg]);
      if (!showChat) setUnreadChat(n => n + 1);
    });

    // Room deleted
    socket.on('room-deleted', () => {
      toast.error('🗑️ تم حذف الغرفة');
      leaveRoom();
    });

    // Get rooms on mount
    socket.emit('get-rooms');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('new-room');
      socket.off('rooms-list');
      socket.off('room-found');
      socket.off('room-not-found');
      socket.off('room-created');
      socket.off('join-success');
      socket.off('join-error');
      socket.off('room-state');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('signal-offer');
      socket.off('signal-answer');
      socket.off('signal-ice');
      socket.off('media-updated');
      socket.off('chat-message');
      socket.off('room-deleted');
    };
  }, []);

  // Chat scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Reset unread when chat opens
  useEffect(() => {
    if (showChat) setUnreadChat(0);
  }, [showChat]);

  // ─── WebRTC: Create Peer ──────────────────────────────────────────────────
  const createPeer = useCallback((peerId: string): RTCPeerConnection => {
    if (peerConns.current[peerId]) {
      peerConns.current[peerId].close();
    }
    const pc = new RTCPeerConnection(ICE_CONFIG);
    peerConns.current[peerId] = pc;
    iceCandidates.current[peerId] = [];

    // Add local tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });
    }

    // ICE candidate
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      getSocket().emit('signal-ice', {
        toUserId:   peerId,
        fromUserId: userId.current,
        candidate:  e.candidate,
        roomId:     activeRoom?.id,
      });
    };

    // ICE connection state
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
      if (pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            closePeer(peerId);
          }
        }, 5000);
      }
    };

    // Remote track
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      remoteStreams.current[peerId] = stream;
      setRemoteStreamsState(prev => ({ ...prev, [peerId]: stream }));
    };

    return pc;
  }, [activeRoom]);

  const closePeer = (peerId: string) => {
    peerConns.current[peerId]?.close();
    delete peerConns.current[peerId];
    delete remoteStreams.current[peerId];
    delete iceCandidates.current[peerId];
  };

  // ─── WebRTC: Create & Send Offer ─────────────────────────────────────────
  const createAndSendOffer = useCallback(async (peerId: string, peerName: string) => {
    try {
      const pc = createPeer(peerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      getSocket().emit('signal-offer', {
        toUserId:     peerId,
        fromUserId:   userId.current,
        fromUserName: peerName,
        sdp:          offer,
        roomId:       activeRoom?.id,
      });
    } catch (err) {
      console.error('Offer error:', err);
    }
  }, [createPeer, activeRoom]);

  // ─── WebRTC: Handle Offer ────────────────────────────────────────────────
  const handleOffer = useCallback(async ({ fromUserId, sdp }: any) => {
    try {
      const pc = createPeer(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Apply queued ICE candidates
      const queued = iceCandidates.current[fromUserId] || [];
      for (const c of queued) {
        await pc.addIceCandidate(c).catch(() => {});
      }
      iceCandidates.current[fromUserId] = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket().emit('signal-answer', {
        toUserId:   fromUserId,
        fromUserId: userId.current,
        sdp:        answer,
        roomId:     activeRoom?.id,
      });
    } catch (err) {
      console.error('Handle offer error:', err);
    }
  }, [createPeer, activeRoom]);

  // ─── WebRTC: Handle Answer ───────────────────────────────────────────────
  const handleAnswer = useCallback(async ({ fromUserId, sdp }: any) => {
    try {
      const pc = peerConns.current[fromUserId];
      if (!pc) return;
      if (pc.signalingState !== 'have-local-offer') return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Apply queued ICE
      const queued = iceCandidates.current[fromUserId] || [];
      for (const c of queued) {
        await pc.addIceCandidate(c).catch(() => {});
      }
      iceCandidates.current[fromUserId] = [];
    } catch (err) {
      console.error('Handle answer error:', err);
    }
  }, []);

  // ─── WebRTC: Handle ICE ──────────────────────────────────────────────────
  const handleIce = useCallback(async ({ fromUserId, candidate }: any) => {
    try {
      const pc = peerConns.current[fromUserId];
      if (!pc || !candidate) return;
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        if (!iceCandidates.current[fromUserId]) iceCandidates.current[fromUserId] = [];
        iceCandidates.current[fromUserId].push(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('ICE error:', err);
    }
  }, []);

  // ─── Get Local Media ─────────────────────────────────────────────────────
  const getLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStream.current = stream;
      startVAD(stream);
      return stream;
    } catch (err) {
      console.warn('Camera denied, trying audio only:', err);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream.current = audioStream;
        setCamOn(false);
        return audioStream;
      } catch {
        toast.error('⚠️ لا يمكن الوصول للكاميرا أو الميكروفون');
        return null;
      }
    }
  };

  // ─── Voice Activity Detection ─────────────────────────────────────────────
  const startVAD = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      vadIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setSpeaking(prev => ({ ...prev, [userId.current]: avg > 15 }));
      }, 150);
    } catch {}
  };

  // ─── Create Room ─────────────────────────────────────────────────────────
  const createRoom = async () => {
    if (!newName.trim()) return;
    if (!socketConnected) {
      toast.error('❌ الخادم غير متصل — شغّل: cd server && node index.js');
      return;
    }
    setCreating(true);
    const roomId = genId();
    const code   = genCode();
    getSocket().emit('create-room', {
      roomId,
      roomName: newName.trim(),
      subject:  newSubject,
      hostId:   userId.current,
      hostName: userName.current,
      code,
      maxSeats: MAX_SEATS,
    });
    const room: Room = {
      id: roomId, name: newName.trim(), subject: newSubject,
      hostName: userName.current, hostId: userId.current,
      code, maxSeats: MAX_SEATS, seatCount: 0, viewerCount: 0,
      createdAt: Date.now(),
    };
    setShowCreate(false);
    setNewName('');
    await joinAsParticipant(room);
  };

  // ─── Join as Participant ──────────────────────────────────────────────────
  const joinAsParticipant = async (room: Room) => {
    setJoinTarget(null);
    setActiveRoom(room);
    const stream = await getLocalMedia();
    if (!stream) return;
    getSocket().emit('join-room', {
      roomId:   room.id,
      userId:   userId.current,
      userName: userName.current,
      micOn:    true,
      camOn:    true,
    });
    setIsViewer(false);
    setMicOn(true);
    setCamOn(true);
  };

  // ─── Join as Viewer ───────────────────────────────────────────────────────
  const joinAsViewer = (room: Room) => {
    setJoinTarget(null);
    setActiveRoom(room);
    getSocket().emit('join-viewer', {
      roomId:   room.id,
      userId:   userId.current,
      userName: userName.current,
    });
    setIsViewer(true);
  };

  // ─── Leave Room ───────────────────────────────────────────────────────────
  const leaveRoom = useCallback(() => {
    if (activeRoom) {
      getSocket().emit('leave-room', { roomId: activeRoom.id, userId: userId.current });
    }
    // Stop local stream
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    // Close all peers
    Object.keys(peerConns.current).forEach(closePeer);
    // Stop VAD
    if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
    // Reset state
    setInRoom(false);
    setActiveRoom(null);
    setSeats({});
    setViewers({});
    setChat([]);
    setIsViewer(false);
    setScreenSharing(false);
    setRemoteStreamsState({});
    setSpeaking({});
  }, [activeRoom]);

  // ─── Toggle Mic ───────────────────────────────────────────────────────────
  const toggleMic = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) track.enabled = !micOn;
    setMicOn(v => {
      const next = !v;
      getSocket().emit('toggle-media', {
        roomId: activeRoom?.id, userId: userId.current,
        micOn: next, camOn,
      });
      return next;
    });
  };

  // ─── Toggle Camera ────────────────────────────────────────────────────────
  const toggleCam = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) track.enabled = !camOn;
    setCamOn(v => {
      const next = !v;
      getSocket().emit('toggle-media', {
        roomId: activeRoom?.id, userId: userId.current,
        micOn, camOn: next,
      });
      return next;
    });
  };

  // ─── Screen Share ─────────────────────────────────────────────────────────
  const toggleScreen = async () => {
    if (screenSharing) {
      const cam = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = cam.getVideoTracks()[0];
      Object.values(peerConns.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(track);
      });
      if (localStream.current) {
        const old = localStream.current.getVideoTracks()[0];
        old?.stop();
        localStream.current.removeTrack(old);
        localStream.current.addTrack(track);
      }
      setScreenSharing(false);
    } else {
      try {
        const disp = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        const track = disp.getVideoTracks()[0];
        Object.values(peerConns.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(track);
        });
        if (localStream.current) {
          const old = localStream.current.getVideoTracks()[0];
          old?.stop();
          localStream.current.removeTrack(old);
          localStream.current.addTrack(track);
        }
        track.onended = () => { setScreenSharing(false); };
        setScreenSharing(true);
        toast.success('🖥️ مشاركة الشاشة نشطة');
      } catch {}
    }
  };

  // ─── Send Chat ────────────────────────────────────────────────────────────
  const sendChat = () => {
    if (!chatInput.trim() || !activeRoom) return;
    getSocket().emit('chat-message', {
      roomId:   activeRoom.id,
      userId:   userId.current,
      userName: userName.current,
      text:     chatInput.trim(),
      isViewer,
    });
    setChatInput('');
  };

  // ─── Delete Room ──────────────────────────────────────────────────────────
  const deleteRoom = () => {
    if (!activeRoom) return;
    getSocket().emit('delete-room', { roomId: activeRoom.id, userId: userId.current });
  };

  // ─── Search Room ─────────────────────────────────────────────────────────
  const searchRoom = () => {
    if (!searchCode.trim()) return;
    setSearching(true);
    setFoundRoom(null);
    getSocket().emit('find-room', { code: searchCode.trim().toUpperCase() });
  };

  // ─── Refresh rooms ────────────────────────────────────────────────────────
  const refreshRooms = () => getSocket().emit('get-rooms');

  // ─────────────────────────────────────────────────────────────────────────
  // Build seat tiles (10 fixed)
  const seatList = Object.values(seats);
  const myLocalSeat: Seat = {
    userId: userId.current, userName: userName.current,
    micOn, camOn, joinedAt: Date.now(),
  };
  const isInSeats = !!seats[userId.current];

  // ─── LOBBY ────────────────────────────────────────────────────────────────
  if (!inRoom) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}
        dir="rtl">

        {/* Header */}
        <div className={`sticky top-0 z-30 ${isDark ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} px-4 py-3`}>
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Video className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-sm sm:text-base">Zoom Live</h1>
                <div className="flex items-center gap-1">
                  {socketConnected
                    ? <><Wifi className="w-3 h-3 text-green-500" /><span className="text-[10px] text-green-500">الخادم متصل</span></>
                    : <><WifiOff className="w-3 h-3 text-red-500" /><span className="text-[10px] text-red-500">الخادم غير متصل</span></>
                  }
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={refreshRooms}
                className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition active:scale-95">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition active:scale-95">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">إنشاء غرفة</span>
                <span className="sm:hidden">جديد</span>
              </button>
            </div>
          </div>
        </div>

        {/* Server offline warning */}
        {!socketConnected && (
          <div className="bg-red-500/10 border border-red-500/30 mx-4 mt-4 rounded-xl p-4 max-w-4xl mx-auto">
            <p className="font-bold text-red-400 text-sm mb-1">⚠️ الخادم غير متصل</p>
            <p className="text-red-300 text-xs mb-2">يجب تشغيل Socket.io server:</p>
            <div className="bg-black/50 rounded-lg p-3 font-mono text-xs text-green-400 space-y-1">
              <div>cd server</div>
              <div>npm install</div>
              <div>node index.js</div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">

          {/* Search by code */}
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-500" />
              البحث عن غرفة بالكود
            </h2>
            <div className="flex gap-2">
              <input
                value={searchCode}
                onChange={e => setSearchCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && searchRoom()}
                placeholder="أدخل كود الغرفة (مثال: ABC123)"
                maxLength={6}
                className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-mono tracking-widest
                  ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300'}
                  focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button onClick={searchRoom} disabled={searching || !searchCode.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition active:scale-95">
                {searching ? '...' : 'بحث'}
              </button>
            </div>
          </div>

          {/* Create room form */}
          {showCreate && (
            <div className={`rounded-xl p-4 border-2 border-blue-500 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className="font-bold text-sm mb-3">🎥 إنشاء غرفة جديدة</h2>
              <div className="space-y-3">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="اسم الغرفة..."
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm
                    ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300'}
                    focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <select
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm
                    ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'}
                    focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => setShowCreate(false)}
                    className={`flex-1 py-2.5 rounded-lg text-sm border ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'} transition`}>
                    إلغاء
                  </button>
                  <button onClick={createRoom} disabled={creating || !newName.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition active:scale-95">
                    {creating ? 'جاري الإنشاء...' : 'إنشاء وبدء البث 🎥'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rooms list */}
          <div>
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              الغرف المتاحة
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                {rooms.length}
              </span>
            </h2>
            {rooms.length === 0 ? (
              <div className={`rounded-xl p-8 text-center border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <Video className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm opacity-60">لا توجد غرف — أنشئ أول غرفة!</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {rooms.map(room => (
                  <div key={room.id}
                    className={`rounded-xl p-4 border cursor-pointer hover:border-blue-500 transition
                      ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    onClick={() => setJoinTarget(room)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-sm">{room.name}</h3>
                        <p className="text-xs opacity-60">{room.subject} • {room.hostName}</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(room.code); toast.success('تم نسخ الكود!'); }}
                        className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg text-xs font-mono hover:bg-blue-500/30 transition"
                      >
                        <Copy className="w-3 h-3" />
                        {room.code}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs opacity-60">
                      <span>🪑 {room.seatCount}/{room.maxSeats}</span>
                      <span>👁️ {room.viewerCount} مشاهد</span>
                      <span className={`mr-auto px-1.5 py-0.5 rounded-full text-[10px] ${
                        room.seatCount >= room.maxSeats
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {room.seatCount >= room.maxSeats ? 'ممتلئة' : 'متاحة'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* New room notification */}
        {newRoomNotif && (
          <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
            <div className="bg-blue-600 text-white rounded-xl p-4 shadow-2xl animate-bounce-once">
              <div className="flex items-start justify-between mb-2">
                <p className="font-bold text-sm">🔔 غرفة جديدة!</p>
                <button onClick={() => setNewRoomNotif(null)}>
                  <X className="w-4 h-4 opacity-70" />
                </button>
              </div>
              <p className="text-xs opacity-90 mb-3">
                {newRoomNotif.hostName} أنشأ غرفة: {newRoomNotif.name}
                <span className="font-mono mr-1 bg-white/20 px-1 rounded">{newRoomNotif.code}</span>
              </p>
              <button
                onClick={() => setJoinTarget(newRoomNotif)}
                className="w-full bg-white text-blue-600 py-1.5 rounded-lg text-sm font-bold transition hover:bg-blue-50"
              >
                انضم الآن
              </button>
            </div>
          </div>
        )}

        {/* Join dialog */}
        {joinTarget && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
            onClick={() => setJoinTarget(null)}>
            <div
              className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg mb-1">{joinTarget.name}</h3>
              <p className="text-sm opacity-60 mb-4">
                {joinTarget.subject} • {joinTarget.seatCount}/{joinTarget.maxSeats} مقعد
              </p>
              <p className="text-sm mb-5">هل تريد الانضمام للبث؟</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  onClick={() => joinAsParticipant(joinTarget)}
                  disabled={joinTarget.seatCount >= joinTarget.maxSeats}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-bold transition active:scale-95"
                >
                  📹 نعم — انضم
                </button>
                <button
                  onClick={() => joinAsViewer(joinTarget)}
                  className="bg-gray-600 hover:bg-gray-500 text-white py-3 rounded-xl text-sm font-bold transition active:scale-95"
                >
                  👁️ مشاهدة فقط
                </button>
              </div>
              <button
                onClick={() => setJoinTarget(null)}
                className={`w-full py-2.5 rounded-xl text-sm border ${isDark ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'} transition`}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── IN ROOM ─────────────────────────────────────────────────────────────
  const allSeatsArr = Array.from({ length: MAX_SEATS }, (_, i) => {
    const s = seatList[i] || null;
    return s;
  });

  const isHost = activeRoom?.hostId === userId.current || activeRoom?.hostName === userName.current;

  return (
    <div className="h-[100dvh] bg-[#0a0a0f] text-white flex flex-col overflow-hidden" dir="rtl">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#111118] border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <span className="font-bold text-sm truncate">{activeRoom?.name}</span>
          <span className="text-xs text-gray-400 hidden sm:inline">{activeRoom?.subject}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { navigator.clipboard.writeText(activeRoom?.code || ''); toast.success('تم نسخ الكود!'); }}
            className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-lg text-xs font-mono transition"
          >
            <Copy className="w-3 h-3" />
            {activeRoom?.code}
          </button>
          <span className="text-xs text-gray-400">{seatList.length}/{MAX_SEATS}</span>
          {isHost && (
            <button onClick={deleteRoom} className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Video Grid ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Seats Grid — 5x2, all visible, no scroll */}
          <div className="flex-1 p-2 overflow-hidden">
            <div className="grid grid-cols-5 gap-1.5 h-full" style={{ gridTemplateRows: 'repeat(2, 1fr)' }}>
              {allSeatsArr.map((seat, i) => {
                if (!seat) {
                  // Empty seat — if viewer wants to join
                  const canJoin = isViewer && seatList.length < MAX_SEATS;
                  return (
                    <EmptySeat
                      key={i} num={i + 1}
                      onJoin={canJoin ? () => joinAsParticipant(activeRoom!) : undefined}
                    />
                  );
                }
                const isLocalSeat = seat.userId === userId.current;
                const stream = isLocalSeat
                  ? (localStream.current || null)
                  : (remoteStreamsState[seat.userId] || null);
                return (
                  <VideoTile
                    key={seat.userId}
                    seat={isLocalSeat ? { ...seat, micOn, camOn } : seat}
                    stream={stream}
                    isLocal={isLocalSeat}
                    speaking={speaking[seat.userId]}
                  />
                );
              })}
            </div>
          </div>

          {/* Viewer badge */}
          {isViewer && (
            <div className="mx-2 mb-1 flex items-center justify-between bg-yellow-500/20 border border-yellow-500/30 rounded-lg px-3 py-1.5">
              <span className="text-yellow-400 text-xs flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                أنت في وضع المشاهدة
              </span>
              {seatList.length < MAX_SEATS && (
                <button
                  onClick={() => joinAsParticipant(activeRoom!)}
                  className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded-lg font-medium"
                >
                  انضم للبث
                </button>
              )}
            </div>
          )}

          {/* Viewers count */}
          {Object.keys(viewers).length > 0 && (
            <div className="mx-2 mb-1 text-xs text-gray-400 flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {Object.keys(viewers).length} مشاهد
            </div>
          )}

          {/* ── Controls Bar ── */}
          <div className="bg-[#111118] border-t border-gray-800 px-3 py-2 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">

              {/* Left controls */}
              <div className="flex items-center gap-1.5">
                {!isViewer && (
                  <>
                    <button
                      onClick={toggleMic}
                      className={`flex flex-col items-center gap-0.5 p-2 sm:p-2.5 rounded-xl transition active:scale-90 min-w-[44px]
                        ${micOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500/90 hover:bg-red-600'}`}
                    >
                      {micOn ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                      <span className="text-[9px] hidden sm:block">{micOn ? 'ميك' : 'مكتوم'}</span>
                    </button>
                    <button
                      onClick={toggleCam}
                      className={`flex flex-col items-center gap-0.5 p-2 sm:p-2.5 rounded-xl transition active:scale-90 min-w-[44px]
                        ${camOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500/90 hover:bg-red-600'}`}
                    >
                      {camOn ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                      <span className="text-[9px] hidden sm:block">{camOn ? 'كاميرا' : 'مطفأة'}</span>
                    </button>
                    <button
                      onClick={toggleScreen}
                      className={`hidden sm:flex flex-col items-center gap-0.5 p-2.5 rounded-xl transition active:scale-90 min-w-[44px]
                        ${screenSharing ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                      {screenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                      <span className="text-[9px]">{screenSharing ? 'إيقاف' : 'شاشة'}</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setSpeakerOn(v => !v)}
                  className={`flex flex-col items-center gap-0.5 p-2 sm:p-2.5 rounded-xl transition active:scale-90 min-w-[44px]
                    ${speakerOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-orange-500/90 hover:bg-orange-600'}`}
                >
                  {speakerOn ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
                  <span className="text-[9px] hidden sm:block">صوت</span>
                </button>
              </div>

              {/* Center — Chat */}
              <button
                onClick={() => setShowChat(v => !v)}
                className="relative flex flex-col items-center gap-0.5 p-2 sm:p-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl transition active:scale-90 min-w-[44px]"
              >
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[9px] hidden sm:block">دردشة</span>
                {unreadChat > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[9px] flex items-center justify-center font-bold">
                    {unreadChat > 9 ? '9+' : unreadChat}
                  </span>
                )}
              </button>

              {/* Right — Leave */}
              <button
                onClick={leaveRoom}
                className="flex flex-col items-center gap-0.5 p-2 sm:p-2.5 bg-red-600 hover:bg-red-700 rounded-xl transition active:scale-90 min-w-[44px]"
              >
                <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[9px] hidden sm:block">مغادرة</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Chat Panel ── */}
        {showChat && (
          <div className={`
            flex flex-col
            fixed inset-0 z-40 sm:relative sm:w-72 sm:inset-auto
            bg-[#111118] border-l border-gray-800
          `}>
            {/* Chat header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800 flex-shrink-0">
              <span className="font-bold text-sm">💬 الدردشة</span>
              <button onClick={() => setShowChat(false)} className="p-1 rounded-lg hover:bg-gray-700 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chat.length === 0 && (
                <p className="text-center text-gray-500 text-xs mt-8">لا توجد رسائل بعد</p>
              )}
              {chat.map((msg) => {
                const isMe = msg.userId === userId.current;
                const color = getColor(msg.userName);
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ backgroundColor: color }}
                    >
                      {initials(msg.userName)}
                    </div>
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] opacity-60" style={{ color }}>
                          {isMe ? 'أنت' : msg.userName.split(' ')[0]}
                        </span>
                        {msg.isViewer && <Eye className="w-2.5 h-2.5 opacity-40" />}
                      </div>
                      <div className={`px-3 py-1.5 rounded-2xl text-xs leading-relaxed
                        ${isMe
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-gray-700 text-gray-100 rounded-tl-none'}`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="p-3 border-t border-gray-800 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Type..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2 rounded-xl transition active:scale-90"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Remote Audio elements */}
      {Object.entries(remoteStreamsState).map(([uid, stream]) => (
        <RemoteAudio key={uid} stream={stream} muted={!speakerOn} />
      ))}
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { useChatStore, ChatChannel, ChatMessage } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import api from '../api';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { classNames, formatDate, formatTime } from '../utils/format';
import { socket } from '../socket';
import {
  Send,
  Paperclip,
  Smile,
  Users,
  Search,
  MessageSquare,
  Plus,
  CornerUpLeft,
  X,
  FileCode,
  AlertCircle,
  Hash,
  MessageCircle,
  Link,
  ChevronRight,
  Info
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

export const ChatPage: React.FC = () => {
  const {
    channels,
    activeChannel,
    messages,
    nextCursor,
    typingUsers,
    onlineUsers,
    fetchChannels,
    selectChannel,
    fetchMessages,
    sendMessage,
    addMessage,
    createGroup,
    startDM,
    setTyping,
    setPresence
  } = useChatStore();

  const { user } = useAuthStore();

  // Search/Filters
  const [channelSearch, setChannelSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Message Form State
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Group creation modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupError, setGroupError] = useState('');

  // DM creation modal
  const [isDMModalOpen, setIsDMModalOpen] = useState(false);
  const [dmPartnerId, setDmPartnerId] = useState('');
  const [dmError, setDmError] = useState('');

  // Directory users for modals
  const [directoryUsers, setDirectoryUsers] = useState<any[]>([]);

  // Mentions State
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionTriggerPos, setMentionTriggerPos] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (val: string, selectionStart: number | null) => {
    setText(val);
    if (selectionStart === null) return;
    
    const textBeforeCursor = val.slice(0, selectionStart);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    
    if (lastAt !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAt + 1);
      if (!/\s/.test(textAfterAt)) {
        setShowMentions(true);
        setMentionSearch(textAfterAt);
        setMentionTriggerPos(lastAt);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const filteredSuggestions = directoryUsers.filter(u =>
    u.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const insertMention = (targetUser: any) => {
    if (mentionTriggerPos === -1) return;
    const nameWithUnderscores = targetUser.name.replace(/\s+/g, '_');
    const beforeMention = text.slice(0, mentionTriggerPos);
    const afterMention = text.slice(inputRef.current?.selectionStart || text.length);
    const newText = `${beforeMention}@${nameWithUnderscores} ${afterMention}`;
    
    setText(newText);
    setShowMentions(false);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const cursorPosition = mentionTriggerPos + nameWithUnderscores.length + 2;
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentions) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(prev => (prev + 1) % filteredSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredSuggestions.length > 0) {
        e.preventDefault();
        insertMention(filteredSuggestions[mentionIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowMentions(false);
    }
  };

  // Refs for auto-scroll and pagination
  const messageEndRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);

  // Hovered reactions state
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [reactionsList, setReactionsList] = useState<Record<string, { emoji: string; users: string[] }[]>>({});

  const loadPageData = async () => {
    await fetchChannels();
    try {
      const { data } = await api.get('/api/users');
      setDirectoryUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  // Join room when active channel or socket connection changes
  useEffect(() => {
    if (socket && activeChannel) {
      socket.emit('chat:join-channel', { channelId: activeChannel.id });
    }
  }, [activeChannel, socket]);

  // Listen to Socket.io events
  useEffect(() => {
    const currentSocket = socket;
    if (!currentSocket) return;

    // Handle incoming chat messages
    const handleIncomingMessage = (payload: { message: ChatMessage; channelId: string }) => {
      addMessage(payload.message);
      // Auto scroll if user is near bottom
      scrollToBottom();
    };

    // Handle typing indicators
    const handleTypingEvent = (payload: { userId: string; channelId: string; isTyping: boolean }) => {
      const typist = directoryUsers.find(u => u.id === payload.userId);
      if (typist) {
        setTyping(payload.channelId, payload.userId, payload.isTyping, typist.name);
      }
    };

    // Handle reactions
    const handleReactionEvent = (payload: { messageId: string; reaction: string; userId: string }) => {
      const rxKey = payload.messageId;
      setReactionsList(prev => {
        const currentRx = prev[rxKey] || [];
        const match = currentRx.find(r => r.emoji === payload.reaction);
        let newRx;

        if (match) {
          const userExists = match.users.includes(payload.userId);
          newRx = currentRx.map(r => {
            if (r.emoji === payload.reaction) {
              return {
                ...r,
                users: userExists ? r.users.filter(id => id !== payload.userId) : [...r.users, payload.userId]
              };
            }
            return r;
          });
        } else {
          newRx = [...currentRx, { emoji: payload.reaction, users: [payload.userId] }];
        }

        // Filter out empty reactions
        newRx = newRx.filter(r => r.users.length > 0);

        return { ...prev, [rxKey]: newRx };
      });
    };

    // Handle user online/offline presence updates
    const handlePresenceEvent = (payload: { userId: string; isOnline: boolean }) => {
      setPresence(payload.userId, payload.isOnline);
    };

    currentSocket.on('chat:message', handleIncomingMessage);
    currentSocket.on('chat:typing', handleTypingEvent);
    currentSocket.on('chat:reaction', handleReactionEvent);
    currentSocket.on('user:presence', handlePresenceEvent);

    return () => {
      currentSocket.off('chat:message', handleIncomingMessage);
      currentSocket.off('chat:typing', handleTypingEvent);
      currentSocket.off('chat:reaction', handleReactionEvent);
      currentSocket.off('user:presence', handlePresenceEvent);
    };
  }, [directoryUsers]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Auto scroll on channel switch
  useEffect(() => {
    scrollToBottom();
  }, [activeChannel]);

  // Handle typing alerts emit
  useEffect(() => {
    if (!socket || !activeChannel) return;

    if (text) {
      socket.emit('chat:typing-start', { channelId: activeChannel.id });
    } else {
      socket.emit('chat:typing-stop', { channelId: activeChannel.id });
    }

    // Debounce clear typing
    const typingTimeout = setTimeout(() => {
      if (socket) socket.emit('chat:typing-stop', { channelId: activeChannel.id });
    }, 3000);

    return () => clearTimeout(typingTimeout);
  }, [text, activeChannel]);

  // Handles infinite scroll pagination
  const handleScroll = async () => {
    const el = feedContainerRef.current;
    if (!el || !activeChannel || !nextCursor) return;

    // If scrolled to top, fetch older messages
    if (el.scrollTop === 0) {
      const prevHeight = el.scrollHeight;
      await fetchMessages(activeChannel.id, true);
      
      // Retain scroll position relative to previous top
      setTimeout(() => {
        el.scrollTop = el.scrollHeight - prevHeight;
      }, 50);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!text.trim() && attachments.length === 0) || !activeChannel || isSending) return;

    setIsSending(true);
    setSendError(null);
    try {
      await sendMessage(text, replyingTo?.id || null, attachments);
      setText('');
      setAttachments([]);
      setReplyingTo(null);
      scrollToBottom();
    } catch (err: any) {
      console.error(err);
      setSendError(err?.response?.data?.message || err?.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  // Create Channel Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupError('');
    try {
      const channel = await createGroup(groupName, groupMembers);
      setGroupName('');
      setGroupMembers([]);
      setIsGroupModalOpen(false);
      selectChannel(channel);
    } catch (err: any) {
      setGroupError(err.response?.data?.message || 'Failed to create group.');
    }
  };

  // Start DM channel
  const handleStartDM = async (e: React.FormEvent) => {
    e.preventDefault();
    setDmError('');
    try {
      const channel = await startDM(dmPartnerId);
      setDmPartnerId('');
      setIsDMModalOpen(false);
      selectChannel(channel);
    } catch (err: any) {
      setDmError(err.response?.data?.message || 'Failed to start direct message.');
    }
  };

  // Add Reaction click handler
  const handleReactClick = (messageId: string, emoji: string) => {
    if (!socket || !activeChannel) return;
    
    socket.emit('chat:react', {
      messageId,
      reaction: emoji,
      channelId: activeChannel.id
    });

    // Handle local toggle for immediate feedback
    const rxKey = messageId;
    setReactionsList(prev => {
      const currentRx = prev[rxKey] || [];
      const match = currentRx.find(r => r.emoji === emoji);
      let newRx;

      if (match) {
        const userExists = match.users.includes(user?.id || '');
        newRx = currentRx.map(r => {
          if (r.emoji === emoji) {
            return {
              ...r,
              users: userExists ? r.users.filter(id => id !== user?.id) : [...r.users, user?.id || '']
            };
          }
          return r;
        });
      } else {
        newRx = [...currentRx, { emoji, users: [user?.id || ''] }];
      }

      newRx = newRx.filter(r => r.users.length > 0);
      return { ...prev, [rxKey]: newRx };
    });
  };

  // Filter channels based on search
  const filteredChannels = channels.filter(c =>
    (c.name || '').toLowerCase().includes(channelSearch.toLowerCase())
  );

  const globalChannels = filteredChannels.filter(c => c.type === 'GLOBAL');
  const groupChannels = filteredChannels.filter(c => c.type === 'GROUP');
  const dmChannels = filteredChannels.filter(c => c.type === 'DM');
  const taskChannels = filteredChannels.filter(c => c.type === 'TASK');

  // Filter messages based on query search
  const filteredMessages = messageSearch
    ? messages.filter(m => m.content.toLowerCase().includes(messageSearch.toLowerCase()))
    : messages;

  // Active channel details right sidebar members list
  const channelMembers = activeChannel?.members || [];
  
  // Extract all files sent in this channel
  const sharedFiles = messages.flatMap(m => m.attachments || []);

  const basicEmojis = ['👍', '❤️', '🔥', '😂', '😮'];

  return (
    <div className="h-[calc(100vh-100px)] flex bg-[#0A0A0A] border border-[rgba(255,255,255,0.08)] rounded-xl overflow-hidden max-w-7xl mx-auto">
      
      {/* 1. LEFT COLUMN: Channel List (240px) */}
      <div className="w-60 border-r border-[rgba(255,255,255,0.08)] bg-[#111111] flex flex-col select-none shrink-0">
        
        {/* Search Bar */}
        <div className="p-4 border-b border-[rgba(255,255,255,0.08)] flex flex-col gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3.5 text-text-muted" />
            <input
              type="text"
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="Search channels..."
              className="w-full pl-9 pr-3 py-2 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] focus:border-[#00E676] rounded-lg text-xs text-white placeholder-[#525252] focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setIsGroupModalOpen(true)}
              variant="ghost"
              size="sm"
              className="flex-1 text-[10px] uppercase font-bold py-1.5 gap-1"
            >
              <Plus className="w-3 h-3" />
              Group
            </Button>
            <Button
              onClick={() => setIsDMModalOpen(true)}
              variant="ghost"
              size="sm"
              className="flex-1 text-[10px] uppercase font-bold py-1.5 gap-1"
            >
              <MessageSquare className="w-3 h-3" />
              DM
            </Button>
          </div>
        </div>

        {/* Group lists scroll */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin text-xs">
          
          {/* Global Channels */}
          <div>
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-2 px-2">Public Channels</span>
            <div className="space-y-0.5">
              {globalChannels.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectChannel(c)}
                  className={classNames(
                    'w-full px-2 py-1.5 rounded-lg text-left font-medium flex items-center justify-between',
                    activeChannel?.id === c.id ? 'bg-[#1B4332]/50 text-[#00E676] border-l-2 border-[#00E676]' : 'text-text-secondary hover:text-white hover:bg-[#161616]'
                  )}
                >
                  <span className="truncate"># {c.name}</span>
                  {c.unreadCount ? (
                    <span className="w-4 h-4 rounded-full bg-[#FF3D3D] text-white text-[9px] font-bold flex items-center justify-center">{c.unreadCount}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Group Chats */}
          <div>
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-2 px-2">Groups</span>
            <div className="space-y-0.5">
              {groupChannels.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectChannel(c)}
                  className={classNames(
                    'w-full px-2 py-1.5 rounded-lg text-left font-medium flex items-center justify-between',
                    activeChannel?.id === c.id ? 'bg-[#1B4332]/50 text-[#00E676] border-l-2 border-[#00E676]' : 'text-text-secondary hover:text-white hover:bg-[#161616]'
                  )}
                >
                  <span className="truncate"># {c.name}</span>
                  {c.unreadCount ? (
                    <span className="w-4 h-4 rounded-full bg-[#FF3D3D] text-white text-[9px] font-bold flex items-center justify-center">{c.unreadCount}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Messages */}
          <div>
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-2 px-2">Direct Messages</span>
            <div className="space-y-0.5">
              {dmChannels.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectChannel(c)}
                  className={classNames(
                    'w-full px-2 py-1.5 rounded-lg text-left font-medium flex items-center justify-between',
                    activeChannel?.id === c.id ? 'bg-[#1B4332]/50 text-[#00E676] border-l-2 border-[#00E676]' : 'text-text-secondary hover:text-white hover:bg-[#161616]'
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  {c.unreadCount ? (
                    <span className="w-4 h-4 rounded-full bg-[#FF3D3D] text-white text-[9px] font-bold flex items-center justify-center">{c.unreadCount}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Task Threads */}
          <div>
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-2 px-2">Task Threads</span>
            <div className="space-y-0.5">
              {taskChannels.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectChannel(c)}
                  className={classNames(
                    'w-full px-2 py-1.5 rounded-lg text-left font-medium flex items-center justify-between',
                    activeChannel?.id === c.id ? 'bg-[#1B4332]/50 text-[#00E676] border-l-2 border-[#00E676]' : 'text-text-secondary hover:text-white hover:bg-[#161616]'
                  )}
                >
                  <span className="truncate"># {c.name}</span>
                  {c.unreadCount ? (
                    <span className="w-4 h-4 rounded-full bg-[#FF3D3D] text-white text-[9px] font-bold flex items-center justify-center">{c.unreadCount}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* 2. MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col bg-[#0A0A0A] overflow-hidden relative">
        {activeChannel ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 border-b border-[rgba(255,255,255,0.08)] bg-[#111111] flex items-center justify-between shrink-0 select-none">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {activeChannel.name || 'Private Chat'}
                </h3>
                <span className="text-[10px] text-text-secondary">
                  {activeChannel.type === 'DM' ? 'Direct 1:1 conversation' : `${channelMembers.length} Members`}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Search Messages */}
                <div className="relative hidden md:block">
                  <Search className="w-3 h-3 absolute left-2.5 top-2 text-text-muted" />
                  <input
                    type="text"
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    placeholder="Search thread..."
                    className="pl-8 pr-3 py-1 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] focus:border-[#00E676] rounded-md text-[11px] text-white placeholder-text-muted focus:outline-none w-36 focus:w-48 transition-all"
                  />
                </div>

                <button
                  onClick={() => setShowRightPanel(!showRightPanel)}
                  className="text-text-secondary hover:text-white"
                  title="Channel Information"
                >
                  <Info className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Stream Container */}
            <div
              ref={feedContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin"
            >
              {nextCursor && (
                <div className="text-center py-2">
                  <span className="text-[10px] text-text-muted">Scroll up to load older messages</span>
                </div>
              )}

              {filteredMessages.map((msg) => {
                const isMyMessage = msg.senderId === user?.id;
                const msgReactions = reactionsList[msg.id] || [];

                return (
                  <div
                    key={msg.id}
                    className={classNames('flex gap-3 group relative max-w-[85%]', isMyMessage ? 'ml-auto flex-row-reverse text-right' : '')}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                  >
                    <Avatar src={msg.sender.avatarUrl} name={msg.sender.name} size="sm" />
                    
                    <div className="space-y-1 text-left">
                      {/* Meta header */}
                      <div className={classNames('flex items-center gap-2', isMyMessage ? 'justify-end' : '')}>
                        <span className="text-xs font-bold text-white">{msg.sender.name}</span>
                        <span className="text-[9px] text-text-muted font-mono">{formatTime(msg.createdAt)}</span>
                      </div>

                      {/* Replying indicator snippet */}
                      {msg.parentMessageId && (
                        <div className="bg-[#1C1C1C]/60 border-l-2 border-[#00E676] px-2 py-0.5 rounded text-[10px] text-text-secondary leading-snug truncate max-w-sm mb-1">
                          Reply to message
                        </div>
                      )}

                      {/* Content Card */}
                      <div className={classNames(
                        'p-3 rounded-lg border text-xs leading-relaxed max-w-xl whitespace-pre-wrap relative',
                        isMyMessage
                          ? 'bg-[#1B4332]/25 border-[rgba(0,230,118,0.2)] text-white'
                          : 'bg-[#161616] border-[rgba(255,255,255,0.06)] text-white'
                      )}>
                        {msg.content}

                        {/* Attachments rendering */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1 pt-1 border-t border-white/5">
                            {msg.attachments.map((url, i) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-[#00E676] hover:underline font-mono text-[10px]"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                File Attachment {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reactions display */}
                      {msgReactions.length > 0 && (
                        <div className={classNames('flex flex-wrap gap-1 mt-1', isMyMessage ? 'justify-end' : '')}>
                          {msgReactions.map((rx, i) => {
                            const reactedByMe = rx.users.includes(user?.id || '');
                            return (
                              <button
                                key={i}
                                onClick={() => handleReactClick(msg.id, rx.emoji)}
                                className={classNames(
                                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold font-mono transition-colors',
                                  reactedByMe
                                    ? 'bg-[#1B4332] border-[#00E676] text-[#00E676]'
                                    : 'bg-[#161616] border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-white'
                                )}
                              >
                                <span>{rx.emoji}</span>
                                <span>{rx.users.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Emoji Reaction Selector (on Hover) */}
                    {hoveredMessageId === msg.id && (
                      <div className={classNames(
                        'absolute top-0 z-10 flex bg-[#161616] border border-[rgba(255,255,255,0.08)] px-1 py-0.5 rounded-lg shadow-xl gap-0.5 select-none',
                        isMyMessage ? 'right-full mr-2' : 'left-full ml-2'
                      )}>
                        {basicEmojis.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handleReactClick(msg.id, emoji)}
                            className="p-1 hover:bg-[#1C1C1C] rounded text-xs transition-transform hover:scale-110"
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="p-1 hover:bg-[#1C1C1C] rounded text-[#00E676] transition-colors"
                          title="Reply Message"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={messageEndRef} />
            </div>

            {/* Typing status alerts */}
            {activeChannel && typingUsers[activeChannel.id] && typingUsers[activeChannel.id].length > 0 && (
              <div className="px-6 py-1 text-[10px] text-text-secondary italic bg-[#0A0A0A] border-t border-[rgba(255,255,255,0.04)] animate-pulse">
                {typingUsers[activeChannel.id].join(', ')} {typingUsers[activeChannel.id].length === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            {/* Input Bar Footer */}
            <div className="p-4 border-t border-[rgba(255,255,255,0.08)] bg-[#111111] shrink-0 relative">
              
              {/* Mentions Autocomplete Dropdown */}
              {showMentions && filteredSuggestions.length > 0 && (
                <div className="absolute bottom-full left-4 mb-2 w-64 bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-lg shadow-2xl overflow-hidden z-50 max-h-48 overflow-y-auto scrollbar-thin">
                  {filteredSuggestions.map((u, idx) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => insertMention(u)}
                      className={classNames(
                        'w-full px-3 py-2 flex items-center gap-2.5 text-xs text-left transition-colors',
                        idx === mentionIndex ? 'bg-[#1B4332] text-white' : 'text-text-secondary hover:bg-[#1C1C1C] hover:text-white'
                      )}
                    >
                      <Avatar src={u.avatarUrl} name={u.name} size="xs" />
                      <div className="truncate">
                        <p className="font-semibold text-white truncate">{u.name}</p>
                        <p className="text-[10px] text-text-muted truncate">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Error banner */}
              {sendError && (
                <div className="bg-[#3D1414] border border-[#FF3D3D]/30 p-2 rounded-lg flex items-center gap-2 text-xs text-[#FF8585] mb-3 animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{sendError}</span>
                  <button onClick={() => setSendError(null)} className="text-[#FF8585] hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Replying preview banner */}
              {replyingTo && (
                <div className="bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] p-2 rounded-lg flex items-center justify-between text-xs mb-3">
                  <div className="flex items-center gap-2 truncate">
                    <CornerUpLeft className="w-3.5 h-3.5 text-[#00E676]" />
                    <span className="text-text-secondary">Replying to <b>{replyingTo.sender.name}</b>:</span>
                    <span className="text-white italic truncate pr-2">"{replyingTo.content}"</span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-text-secondary hover:text-white p-0.5 rounded hover:bg-[#252525]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Attachments preview list */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] px-2.5 py-1 rounded-md text-[10px] font-semibold font-mono text-white">
                      <FileCode className="w-3.5 h-3.5 text-[#00E676]" />
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                        className="text-[#FF3D3D] ml-1"
                        disabled={isSending}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSend} className="flex items-center gap-2.5">
                {/* File Upload Trigger */}
                <label className={classNames(
                  'p-2.5 rounded-lg bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-white cursor-pointer transition-colors shrink-0',
                  isSending && 'opacity-50 pointer-events-none'
                )}>
                  <Paperclip className="w-4 h-4" />
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setAttachments([...attachments, ...Array.from(e.target.files)]);
                      }
                    }}
                    className="hidden"
                    disabled={isSending}
                  />
                </label>

                {/* Text Entry */}
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart)}
                  onKeyDown={(e) => {
                    handleKeyDown(e);
                    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={isSending ? 'Sending...' : `Send message to #${activeChannel.name || 'Channel'}...`}
                  className="flex-1 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] focus:border-[#00E676] px-4 py-2.5 rounded-lg text-xs text-white placeholder-[#525252] focus:outline-none disabled:opacity-50"
                  disabled={isSending}
                />

                <Button type="submit" size="md" className="shrink-0 py-2.5" disabled={isSending}>
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-text-muted">
            <MessageCircle className="w-12 h-12 mb-3 text-[#00E676]/40 animate-pulse" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider">No Active Conversation</h3>
            <p className="text-xs text-text-secondary max-w-sm mt-1">
              Select a conversation channel or task thread from the sidebar list to start chatting.
            </p>
          </div>
        )}
      </div>

      {/* 3. RIGHT SIDEBAR PANEL: Channel Details / Attachments (Toggled) */}
      {activeChannel && showRightPanel && (
        <div className="w-64 border-l border-[rgba(255,255,255,0.08)] bg-[#111111] flex flex-col select-none shrink-0 overflow-y-auto scrollbar-thin p-5 space-y-6">
          <div>
            <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Channel Info</h4>
            <div className="space-y-2.5 text-xs text-left">
              <div>
                <span className="text-text-secondary uppercase text-[9px] font-bold block mb-1">Type</span>
                <Badge variant="info">{activeChannel.type}</Badge>
              </div>
              
              {activeChannel.task && (
                <div>
                  <span className="text-text-secondary uppercase text-[9px] font-bold block mb-1">Linked Task</span>
                  <a href="#" className="text-[#00E676] hover:underline font-semibold block">
                    {activeChannel.task.title}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-[rgba(255,255,255,0.08)] w-full" />

          {/* Member List */}
          <div>
            <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Members ({channelMembers.length})</h4>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {channelMembers.map(mem => {
                const isOnline = onlineUsers[mem.userId] || false;
                return (
                  <div key={mem.userId} className="flex items-center gap-2.5 text-xs text-left">
                    <Avatar src={mem.user.avatarUrl} name={mem.user.name} size="xs" isOnline={isOnline} />
                    <span className="font-semibold text-white truncate">{mem.user.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[rgba(255,255,255,0.08)] w-full" />

          {/* Shared Attachments Files */}
          <div>
            <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Shared Files ({sharedFiles.length})</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {sharedFiles.length === 0 ? (
                <p className="text-[11px] text-text-secondary italic text-left">No shared files found.</p>
              ) : (
                sharedFiles.map((url, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 bg-[#1C1C1C] border border-[rgba(255,255,255,0.04)] px-2.5 py-2 rounded text-[10px] font-mono text-left">
                    <span className="truncate text-text-secondary">File Attachment {i + 1}</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00E676] hover:underline shrink-0"
                    >
                      Open
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      <Modal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} title="Create Group Conversation">
        {groupError && (
          <div className="bg-[#3D1414] border border-[#FF3D3D]/20 text-[#FF3D3D] text-xs font-semibold px-4 py-3 rounded-lg mb-4">
            {groupError}
          </div>
        )}
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <Input label="Group Name" placeholder="e.g. Frontend Engineering Sync" value={groupName} onChange={(e) => setGroupName(e.target.value)} required />
          
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Select Group Members</label>
            <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto bg-[#161616] p-3 rounded-lg border border-[rgba(255,255,255,0.05)] scrollbar-thin">
              {directoryUsers
                .filter(u => u.id !== user?.id)
                .map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-xs text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={groupMembers.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setGroupMembers([...groupMembers, u.id]);
                        } else {
                          setGroupMembers(groupMembers.filter(id => id !== u.id));
                        }
                      }}
                      className="rounded border-[rgba(255,255,255,0.08)] text-[#00E676] focus:ring-0 focus:ring-offset-0 bg-[#1C1C1C]"
                    />
                    <span>{u.name}</span>
                  </label>
                ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsGroupModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Create Group</Button>
          </div>
        </form>
      </Modal>

      {/* CREATE DM MODAL */}
      <Modal isOpen={isDMModalOpen} onClose={() => setIsDMModalOpen(false)} title="Start Private Conversation">
        {dmError && (
          <div className="bg-[#3D1414] border border-[#FF3D3D]/20 text-[#FF3D3D] text-xs font-semibold px-4 py-3 rounded-lg mb-4">
            {dmError}
          </div>
        )}
        <form onSubmit={handleStartDM} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Select Partner User</label>
            <select
              value={dmPartnerId}
              onChange={(e) => setDmPartnerId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-lg text-white focus:outline-none focus:border-[#00E676] text-sm"
              required
            >
              <option value="">Choose employee...</option>
              {directoryUsers
                .filter(u => u.id !== user?.id)
                .map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsDMModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Start DM</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
export default ChatPage;

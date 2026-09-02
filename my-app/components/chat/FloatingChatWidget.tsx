'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Send, X, Shield, User as UserIcon, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';

export default function FloatingChatWidget({ currentUserId }: { currentUserId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'members'>('chat');
  const [selectedDmUser, setSelectedDmUser] = useState<{ id: string; username: string } | null>(null);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  
  const [collapsedAdmins, setCollapsedAdmins] = useState(false);
  const [collapsedBoarders, setCollapsedBoarders] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!currentUserId) return;

    supabase.from('profiles').select('*').then(({ data }) => {
      if (data) setProfiles(data);
    });

    supabase
      .from('messages')
      .select('id, content, sender_id, recipient_id, created_at, profiles(username, avatar_url)')
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (error) console.error("Error fetching messages:", error.message);
        if (data) {
          setMessages(data);
        }
      });

    const channel = supabase
      .channel('public:messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', payload.new.sender_id)
          .single();

        const enrichedMessage = { ...payload.new, profiles: senderProfile };
        setMessages((prev) => {
          if (prev.some((m) => m.id === enrichedMessage.id)) return prev;
          return [...prev, enrichedMessage];
        });

        const isMe = payload.new.sender_id === currentUserId;
        const msgRecipient = payload.new.recipient_id ? String(payload.new.recipient_id).trim() : null;
        const current = String(currentUserId).trim();
        const isGroupMessage = !msgRecipient;
        const isDmToMe = msgRecipient === current;

        if (!isMe && (isGroupMessage || isDmToMe)) {
          setHasUnread(true);
        }
      })
      .subscribe();

    const presenceChannel = supabase.channel('online-boarders', {
      config: { presence: { key: currentUserId } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUsers(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, selectedDmUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId) return;

    const messagePayload: any = {
      content: newMessage.trim(),
      sender_id: currentUserId,
    };

    if (selectedDmUser) {
      messagePayload.recipient_id = selectedDmUser.id;
    }

    const { data, error } = await supabase.from('messages').insert(messagePayload).select('id, content, sender_id, recipient_id, created_at, profiles(username, avatar_url)').single();

    if (error) {
      console.error("Error sending message:", error.message);
      alert(`Failed to send: ${error.message}`);
    } else if (data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setNewMessage('');
    }
  };

  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  const uniqueMessages = Array.from(
    new Map(messages.map(msg => [msg.id, msg])).values()
  ).filter(msg => {
    const messageTime = new Date(msg.created_at).getTime();
    return messageTime > twentyFourHoursAgo;
  });

  const filteredMessages = uniqueMessages.filter((msg) => {
    const msgRecipient = msg.recipient_id ? String(msg.recipient_id).trim() : null;
    
    if (selectedDmUser) {
      const targetDmId = String(selectedDmUser.id).trim();
      const msgSender = String(msg.sender_id).trim();
      const current = String(currentUserId).trim();

      return (
        (msgSender === current && msgRecipient === targetDmId) ||
        (msgSender === targetDmId && msgRecipient === current)
      );
    }
    return !msgRecipient;
  });

  const admins = profiles.filter(p => p.role?.toLowerCase() === 'admin');
  const boarders = profiles.filter(p => p.role?.toLowerCase() === 'boarder' || p.role?.toLowerCase() === 'user');

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setHasUnread(false);
          }}
          className="w-12 h-12 bg-[#4B49AC] hover:bg-[#3f3d91] text-white rounded-full shadow-xl flex items-center justify-center transition transform hover:scale-105 cursor-pointer relative"
        >
          <MessageSquare size={20} />
          {hasUnread && !isOpen && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
              !
            </span>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="fixed bottom-22 right-6 w-80 sm:w-96 h-[480px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          
          <div className="bg-[#4B49AC] text-white px-4 py-3 flex items-center justify-between shrink-0">
            {selectedDmUser ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedDmUser(null)}
                  className="p-1 hover:bg-white/10 rounded-lg text-white transition cursor-pointer"
                >
                  <ArrowLeft size={16} />
                </button>
                <h3 className="text-sm font-bold truncate">DM: {selectedDmUser.username}</h3>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'chat' ? 'bg-white text-[#4B49AC]' : 'text-white/80 hover:text-white'}`}
                >
                  Group Chat
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'members' ? 'bg-white text-[#4B49AC]' : 'text-white/80 hover:text-white'}`}
                >
                  Members ({profiles.length})
                </button>
              </div>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {(activeTab === 'chat' || selectedDmUser) && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {filteredMessages.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs py-20">
                    {selectedDmUser ? `No direct messages with ${selectedDmUser.username} yet.` : "No messages in group chat yet. Say hello! 👋"}
                  </div>
                ) : (
                  filteredMessages.map((msg) => {
                    const isMe = msg.sender_id === currentUserId;
                    const senderProfile = profiles.find(p => p.id === msg.sender_id);
                    const senderName = senderProfile?.username || msg.profiles?.username || 'Member';

                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-slate-400 mb-0.5 px-1 font-semibold">
                          {isMe ? 'You' : senderName}
                        </span>
                        <div
                          className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-[#4B49AC] text-white rounded-br-xs'
                              : 'bg-white text-slate-800 border border-slate-200/60 rounded-bl-xs'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={selectedDmUser ? `Message ${selectedDmUser.username}...` : "Type a message to everyone..."}
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#4B49AC]"
                />
                <button
                  type="submit"
                  className="bg-[#4B49AC] hover:bg-[#3f3d91] text-white p-2 rounded-xl transition cursor-pointer shrink-0"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}

          {activeTab === 'members' && !selectedDmUser && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-slate-900 text-slate-300">
              <div className="space-y-1">
                <button 
                  onClick={() => setCollapsedAdmins(!collapsedAdmins)}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 w-full cursor-pointer"
                >
                  {collapsedAdmins ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  Admins — {admins.length}
                </button>
                
                {!collapsedAdmins && admins.map(user => {
                  const isOnline = onlineUsers.includes(user.id);
                  const isMe = user.id === currentUserId;
                  return (
                    <div key={user.id} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-indigo-400 font-bold flex items-center justify-center text-xs border border-slate-700 shrink-0 overflow-hidden">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                            ) : (
                              user.username?.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate flex items-center gap-1">
                            <span className="truncate">{user.username}</span>
                            {isMe && <span className="text-[9px] text-slate-500">(You)</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Shield size={9} className="text-amber-500" /> Admin
                          </p>
                        </div>
                      </div>
                      {!isMe && (
                        <button
                          onClick={() => setSelectedDmUser({ id: user.id, username: user.username })}
                          className="px-2 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded text-[10px] font-bold transition cursor-pointer"
                        >
                          Message
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1">
                <button 
                  onClick={() => setCollapsedBoarders(!collapsedBoarders)}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 w-full cursor-pointer"
                >
                  {collapsedBoarders ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  Boarders — {boarders.length}
                </button>
                
                {!collapsedBoarders && boarders.map(user => {
                  const isOnline = onlineUsers.includes(user.id);
                  const isMe = user.id === currentUserId;
                  return (
                    <div key={user.id} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-indigo-400 font-bold flex items-center justify-center text-xs border border-slate-700 shrink-0 overflow-hidden">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                            ) : (
                              user.username?.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate flex items-center gap-1">
                            <span className="truncate">{user.username}</span>
                            {isMe && <span className="text-[9px] text-slate-500">(You)</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1">
                            <UserIcon size={9} className="text-indigo-400" /> Boarder
                          </p>
                        </div>
                      </div>
                      {!isMe && (
                        <button
                          onClick={() => setSelectedDmUser({ id: user.id, username: user.username })}
                          className="px-2 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded text-[10px] font-bold transition cursor-pointer"
                        >
                          Message
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
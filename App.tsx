
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Phone, Users, User as UserIcon, Settings, 
  Send, Paperclip, Mic, Video, ArrowLeft, MoreVertical, 
  Trash2, Edit2, Smile, Check, Shield, Globe, Plus, Image as ImageIcon, 
  Music, X, Download, Smartphone, MessageSquarePlus, UserPlus, Search, Copy, RefreshCw
} from 'lucide-react';
import { User, Chat, Message, MessageType, ScreenView, LANGUAGES, Story } from './types';
import { translateMessage, getAIResponse } from './services/geminiService';
import { CallInterface } from './components/CallInterface';

// --- Persistence Helpers (Simulated Backend) ---
const STORAGE_KEYS = {
  USERS: 'pt_global_users',
  MESSAGES: 'pt_global_messages',
  CURRENT_USER: 'prep_talk_user'
};

const getGlobalUsers = (): User[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  } catch { return []; }
};

const registerGlobalUser = (user: User) => {
  const users = getGlobalUsers();
  // Update or add user
  const existingIndex = users.findIndex(u => u.id === user.id);
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  window.dispatchEvent(new Event('local-storage-update'));
};

const getGlobalMessages = (): Message[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
  } catch { return []; }
};

const saveGlobalMessage = (msg: Message) => {
  const msgs = getGlobalMessages();
  msgs.push(msg);
  // Keep last 1000 messages to prevent quota issues
  if (msgs.length > 1000) msgs.shift();
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(msgs));
  window.dispatchEvent(new Event('local-storage-update'));
};

// Deterministic ID for direct chats to ensure both parties see the same chat
const getDirectChatId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join('_');
};

// --- Mock Data ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const MOCK_USERS: User[] = [
  { id: 'bot_1', nickname: 'PrepBot (AI)', language: 'English', isBlocked: false, avatarUrl: 'https://picsum.photos/id/1/200/200' },
  { id: 'chan_1', nickname: 'Global News', language: 'English', isBlocked: false, avatarUrl: 'https://picsum.photos/id/180/200/200' },
];

const INITIAL_CHATS: Chat[] = [
  {
    id: 'c_bot',
    name: 'PrepBot (AI)',
    type: 'direct',
    participants: [MOCK_USERS[0]],
    messages: [
      { id: 'm1', senderId: 'bot_1', content: 'Welcome to Prep Talk! I can translate everything.', type: MessageType.TEXT, timestamp: Date.now() }
    ],
    unreadCount: 1
  }
];

// --- Components ---

const AuthScreen = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [nick, setNick] = useState('');
  const [lang, setLang] = useState('English');
  
  const handleRegister = () => {
    if (!nick.trim()) return;
    const newUser: User = {
      id: generateId(), // Unique ID for "Real" connection
      nickname: nick,
      language: lang,
      avatarUrl: `https://picsum.photos/200/200?random=${Math.random()}`
    };
    
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
    registerGlobalUser(newUser); // Save to global registry
    onLogin(newUser);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-gray-900 to-blue-900 p-6 relative">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">Prep Talk</h1>
        <p className="text-blue-200 mt-2">Secure. Global. Limitless.</p>
      </div>
      
      <div className="w-full max-w-xs space-y-4">
        <div>
          <label className="text-xs text-gray-400 uppercase font-bold ml-1">Nickname</label>
          <input 
            type="text" 
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="Enter unique nickname"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase font-bold ml-1">Native Language</label>
          <select 
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-white outline-none"
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <button 
          onClick={handleRegister}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transform active:scale-95 transition-all mt-4"
        >
          Create ID & Start
        </button>
        
        <p className="text-xs text-gray-500 text-center mt-4">
          Your ID will be generated securely locally.
        </p>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ScreenView>('auth');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [isInCall, setIsInCall] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [lastView, setLastView] = useState<ScreenView>('chat_list');
  
  // Data for "Real" interaction
  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [selectionMode, setSelectionMode] = useState<'create' | 'add'>('create');
  const [searchQuery, setSearchQuery] = useState('');

  // Load User
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      registerGlobalUser(u); // Ensure user is in registry
      setView('chat_list');
    }
    // Initial load of global registry
    setGlobalUsers(getGlobalUsers());
  }, []);

  // Sync Logic: Listen for changes in other tabs (Simulating WebSocket)
  const syncData = useCallback(() => {
    if (!user) return;
    
    const allMessages = getGlobalMessages();
    const allUsers = getGlobalUsers();
    setGlobalUsers(allUsers);

    setChats(prevChats => {
      const newChats = [...prevChats];
      
      // 1. Discover new chats from incoming messages
      // If someone messaged me, I should see a chat with them even if I didn't create it
      const incomingMessages = allMessages.filter(m => m.recipientId === user.id);
      
      incomingMessages.forEach(msg => {
         // Only for direct chats logic
         const sender = allUsers.find(u => u.id === msg.senderId);
         if (sender) {
           const chatId = getDirectChatId(user.id, sender.id);
           if (!newChats.find(c => c.id === chatId)) {
             newChats.push({
               id: chatId,
               name: sender.nickname,
               type: 'direct',
               participants: [user, sender],
               messages: [],
               unreadCount: 0
             });
           }
         }
      });

      // 2. Update messages in all chats
      return newChats.map(chat => {
        // Identify which global messages belong to this chat
        const chatMsgs = allMessages.filter(m => {
           if (chat.type === 'direct') {
             const pIds = chat.participants.map(p => p.id);
             // Msg is relevant if sender is in participants AND (recipient matches or is undefined)
             const isP1Sender = m.senderId === pIds[0];
             const isP2Sender = m.senderId === pIds[1];
             
             if (m.recipientId) {
               // Strict check: Sender A -> Recipient B OR Sender B -> Recipient A
               return (isP1Sender && m.recipientId === pIds[1]) || (isP2Sender && m.recipientId === pIds[0]);
             } else {
               // Legacy/Bot check: Sender is participant, and it's not self-to-self (unless needed)
               return (isP1Sender || isP2Sender) && chat.participants.some(p => p.id !== m.senderId); 
             }
           }
           // Simple group support (not fully implemented with ID)
           return false;
        });

        // Merge messages uniquely by ID
        const currentMsgIds = new Set(chat.messages.map(m => m.id));
        const newMsgs = chatMsgs.filter(m => !currentMsgIds.has(m.id));
        
        if (newMsgs.length > 0) {
          const updatedMsgs = [...chat.messages, ...newMsgs].sort((a,b) => a.timestamp - b.timestamp);
          
          // Calculate unread: if I am not the sender of the last message and chat is not active
          const addedCount = newMsgs.filter(m => m.senderId !== user.id).length;
          
          return {
            ...chat,
            messages: updatedMsgs,
            lastMessage: updatedMsgs[updatedMsgs.length - 1],
            unreadCount: (chat.id !== activeChatId && addedCount > 0) ? chat.unreadCount + addedCount : chat.unreadCount
          };
        }
        return chat;
      });
    });

  }, [user, activeChatId]);

  useEffect(() => {
    // Poll/Listen for storage events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.MESSAGES || e.key === STORAGE_KEYS.USERS) {
        syncData();
      }
    };
    
    const handleLocalUpdate = () => syncData();
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleLocalUpdate);
    
    // Also poll every 2 seconds for robustness
    const interval = setInterval(syncData, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
      clearInterval(interval);
    };
  }, [syncData]);


  const handleSendMessage = async (content: string, type: MessageType = MessageType.TEXT) => {
    if (!activeChatId || !user) return;

    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;

    let translatedContent: string | undefined;
    let recipientId: string | undefined;

    // Identify recipient
    if (activeChat.type === 'direct') {
      const recipient = activeChat.participants.find(p => p.id !== user.id);
      recipientId = recipient?.id;

      // Auto-translation
      if (type === MessageType.TEXT && recipient && recipient.language && recipient.language !== user.language) {
        try {
          translatedContent = await translateMessage(content, recipient.language);
        } catch (error) {
          console.error("Auto-translation failed:", error);
        }
      }
    }

    const newMessage: Message = {
      id: generateId(),
      senderId: user.id,
      recipientId,
      content,
      type,
      timestamp: Date.now(),
      translatedContent
    };

    // 1. Update Local State
    setChats(prev => prev.map(c => {
      if (c.id === activeChatId) {
        return { ...c, messages: [...c.messages, newMessage], lastMessage: newMessage };
      }
      return c;
    }));

    // 2. Save to Global Backend (Simulated)
    saveGlobalMessage(newMessage);

    // 3. AI Bot Logic
    if (activeChat?.participants.some(p => p.id === 'bot_1')) {
      setTimeout(async () => {
        const replyContent = await getAIResponse(
          activeChat.messages.map(m => `${m.senderId === user.id ? 'User' : 'Bot'}: ${m.content}`),
          content
        );
        
        const botMsg: Message = {
          id: generateId(),
          senderId: 'bot_1',
          recipientId: user.id,
          content: replyContent,
          type: MessageType.TEXT,
          timestamp: Date.now()
        };
        
        setChats(prev => prev.map(c => {
          if (c.id === activeChatId) {
            return { ...c, messages: [...c.messages, botMsg], lastMessage: botMsg };
          }
          return c;
        }));
      }, 1500);
    }
  };

  const handleDeleteChat = (chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setView('chat_list');
    }
  };

  const startCall = (video: boolean) => {
    setIsVideoCall(video);
    setIsInCall(true);
  };

  const handleUserSelect = (selectedUser: User) => {
    if (selectionMode === 'create') {
      // Deterministic Chat ID for direct messages
      const chatId = getDirectChatId(user!.id, selectedUser.id);
      
      const existingChat = chats.find(c => c.id === chatId);

      if (existingChat) {
        setActiveChatId(existingChat.id);
        setView('chat_room');
      } else {
        const newChat: Chat = {
          id: chatId,
          name: selectedUser.nickname,
          type: 'direct',
          participants: [user!, selectedUser],
          messages: [],
          unreadCount: 0
        };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setView('chat_room');
      }
    } else if (selectionMode === 'add' && activeChatId) {
      // Add to existing chat (Mock Group)
      setChats(prev => prev.map(c => {
        if (c.id === activeChatId) {
          if (c.participants.some(p => p.id === selectedUser.id)) return c;
          const newParticipants = [...c.participants, selectedUser];
          return { ...c, participants: newParticipants, type: 'group', name: `${c.name}, ${selectedUser.nickname}` };
        }
        return c;
      }));
      setView('chat_room');
    }
  };

  // Filter users for search: Combine Mock + Global
  // Show ALL global users by default
  const allDisplayUsers = [...MOCK_USERS.filter(m => !globalUsers.some(g => g.id === m.id)), ...globalUsers];
  
  const filteredUsers = allDisplayUsers.filter(u => {
    // Don't show self
    if (u.id === user?.id) return false;
    
    // If adding to group, filter out existing members
    if (selectionMode === 'add' && chats.find(c => c.id === activeChatId)) {
       const isMember = chats.find(c => c.id === activeChatId)?.participants.some(p => p.id === u.id);
       if (isMember) return false;
    }

    // Search Filter
    if (!searchQuery.trim()) return true; // Show all if no search
    return u.nickname.toLowerCase().includes(searchQuery.toLowerCase()) || u.id === searchQuery;
  });

  if (!user) return <AuthScreen onLogin={(u) => { setUser(u); setView('chat_list'); }} />;

  if (isInCall && chats.find(c => c.id === activeChatId)) {
    return (
      <CallInterface 
        participants={chats.find(c => c.id === activeChatId)!.participants} 
        isVideo={isVideoCall} 
        onEndCall={() => setIsInCall(false)} 
      />
    );
  }

  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="h-full w-full flex flex-col bg-gray-900">
      {/* Top Bar */}
      {view === 'chat_room' && activeChat ? (
         <div className="h-16 bg-gray-800 flex items-center px-4 shadow-md z-20">
           <button onClick={() => setView(lastView)} className="p-2 mr-2 text-gray-300 hover:text-white">
             <ArrowLeft size={24} />
           </button>
           <div className="flex-1 flex items-center overflow-hidden">
             <img src={activeChat.avatarUrl || activeChat.participants[0]?.avatarUrl || 'https://picsum.photos/50'} className="w-10 h-10 rounded-full mr-3 flex-shrink-0" />
             <div className="flex flex-col overflow-hidden">
               <span className="font-bold text-white truncate">{activeChat.name}</span>
               <span className="text-xs text-gray-400 truncate">
                 {activeChat.type === 'direct' ? 'Secure Connection' : `${activeChat.participants.length} members`}
               </span>
             </div>
           </div>
           <div className="flex space-x-3">
             <button onClick={() => startCall(false)} className="text-blue-400"><Phone size={22} /></button>
             <button onClick={() => startCall(true)} className="text-blue-400"><Video size={24} /></button>
             <div className="relative group">
                <button className="text-gray-400"><MoreVertical size={22} /></button>
                <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl hidden group-hover:block z-50">
                   <button 
                     onClick={() => { setSelectionMode('add'); setView('select_contact'); }} 
                     className="w-full text-left px-4 py-3 text-blue-400 hover:bg-gray-700 flex items-center"
                   >
                     <UserPlus size={16} className="mr-2" /> Add Member
                   </button>
                   <div className="h-px bg-gray-700 my-1"></div>
                   <button onClick={() => handleDeleteChat(activeChat.id)} className="w-full text-left px-4 py-3 text-red-400 hover:bg-gray-700 flex items-center">
                     <Trash2 size={16} className="mr-2" /> Delete Chat
                   </button>
                </div>
             </div>
           </div>
         </div>
      ) : view === 'select_contact' ? (
        <div className="h-16 bg-gray-800 flex items-center px-4 shadow-md z-20">
           <button 
             onClick={() => setView(selectionMode === 'add' ? 'chat_room' : 'chat_list')} 
             className="p-2 mr-2 text-gray-300 hover:text-white"
           >
             <ArrowLeft size={24} />
           </button>
           <span className="text-xl font-bold text-white">
             {selectionMode === 'create' ? 'New Chat' : 'Add Member'}
           </span>
        </div>
      ) : (
        <div className="h-16 bg-gray-900 flex items-center justify-between px-4 shadow-sm z-20">
           <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Prep Talk</span>
           <div className="flex items-center space-x-3">
             <button onClick={() => setView('profile')} className="p-2 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
               {user.avatarUrl ? <img src={user.avatarUrl} className="w-6 h-6 rounded-full" /> : <UserIcon size={20} />}
             </button>
           </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        
        {view === 'select_contact' && (
          <div className="h-full flex flex-col bg-gray-900">
             <div className="p-4">
                <div className="bg-gray-800 rounded-xl flex items-center px-4 py-3 mb-2">
                   <Search size={20} className="text-gray-400 mr-3" />
                   <input 
                     type="text" 
                     placeholder="Search People..." 
                     className="bg-transparent text-white outline-none w-full placeholder-gray-500"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                   />
                </div>
                <p className="text-xs text-gray-500 px-1">
                   Users from other browser tabs will appear here automatically.
                </p>
             </div>
             
             <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-20">
                <h3 className="text-gray-400 text-xs font-bold uppercase px-4 mb-2 flex justify-between">
                   <span>Registered Users ({filteredUsers.length})</span>
                   <span className="text-green-500 flex items-center"><div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div> Live</span>
                </h3>
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p>No other users found.</p>
                    <p className="text-xs mt-2">Open this app in a new tab to create another user!</p>
                  </div>
                ) : (
                  filteredUsers.map(u => (
                    <div 
                      key={u.id}
                      onClick={() => handleUserSelect(u)} 
                      className="flex items-center p-4 hover:bg-gray-800 rounded-xl cursor-pointer transition-colors group"
                    >
                       <div className="relative">
                          <img src={u.avatarUrl} className="w-12 h-12 rounded-full object-cover" />
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
                       </div>
                       <div className="ml-4 border-b border-gray-800 flex-1 pb-4 group-hover:border-transparent">
                          <div className="flex justify-between">
                             <h4 className="text-white font-bold">{u.nickname}</h4>
                             {MOCK_USERS.some(m => m.id === u.id) && <span className="text-[10px] bg-blue-900 text-blue-300 px-1 rounded">BOT</span>}
                          </div>
                          <span className="text-gray-500 text-xs font-mono block mt-1">ID: {u.id}</span>
                          <span className="text-gray-500 text-xs">Native: {u.language}</span>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {view === 'chat_list' && (
          <div className="h-full overflow-y-auto no-scrollbar pb-20 relative">
            {/* Stories Row */}
            <div className="flex space-x-4 p-4 overflow-x-auto no-scrollbar border-b border-gray-800">
              <div className="flex flex-col items-center space-y-1">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-blue-500 flex items-center justify-center bg-gray-800 relative cursor-pointer">
                  <Plus size={24} className="text-blue-500" />
                  <input type="file" className="absolute inset-0 opacity-0" onChange={() => alert("Story uploaded!")} />
                </div>
                <span className="text-xs text-gray-400">Your Story</span>
              </div>
              {[1,2].map(i => (
                <div key={i} className="flex flex-col items-center space-y-1 opacity-50">
                   <div className="w-16 h-16 rounded-full p-[2px] bg-gray-700">
                     <div className="w-full h-full rounded-full bg-gray-800"></div>
                   </div>
                   <span className="text-xs text-gray-400">...</span>
                </div>
              ))}
            </div>

            {/* Chat List */}
            <div className="px-2 mt-2">
              {chats.map(chat => (
                <div 
                  key={chat.id} 
                  onClick={() => { setActiveChatId(chat.id); setView('chat_room'); setLastView('chat_list'); }}
                  className="flex items-center p-4 hover:bg-gray-800 rounded-xl cursor-pointer transition-colors"
                >
                  <div className="relative">
                    <img src={chat.avatarUrl || chat.participants[0]?.avatarUrl || 'https://picsum.photos/60'} className="w-14 h-14 rounded-full object-cover" />
                    {chat.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-gray-900">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="ml-4 flex-1 border-b border-gray-800 pb-4 overflow-hidden">
                    <div className="flex justify-between items-baseline">
                       <h3 className="font-semibold text-white truncate pr-2">{chat.name}</h3>
                       <span className="text-xs text-gray-500 flex-shrink-0">{chat.lastMessage ? new Date(chat.lastMessage.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                    <p className="text-sm text-gray-400 truncate pr-4">
                       {chat.lastMessage ? 
                          (chat.lastMessage.type === MessageType.TEXT ? chat.lastMessage.content : `Sent a ${chat.lastMessage.type.toLowerCase()}`) 
                          : 'No messages yet'}
                    </p>
                  </div>
                </div>
              ))}
              {chats.length === 0 && (
                 <div className="text-center text-gray-500 mt-10">
                    <p>No chats yet.</p>
                    <p className="text-sm">Tap + to find people.</p>
                 </div>
              )}
            </div>

            {/* New Chat FAB */}
            <button 
              onClick={() => { setSelectionMode('create'); setView('select_contact'); }}
              className="fixed bottom-20 right-6 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-2xl transform hover:scale-105 transition-all z-40 flex items-center justify-center"
            >
              <MessageSquarePlus size={24} />
            </button>
          </div>
        )}

        {view === 'channels' && (
           <div className="h-full p-4 overflow-y-auto pb-20">
              <h2 className="text-2xl font-bold mb-4">Channels</h2>
              <div className="bg-gray-800 p-4 rounded-xl flex items-center justify-between mb-4">
                 <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center font-bold">N</div>
                    <div className="ml-3">
                       <div className="font-bold">Global News</div>
                       <div className="text-xs text-gray-400">1.2M Subscribers</div>
                    </div>
                 </div>
                 <button className="px-4 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold">View</button>
              </div>
           </div>
        )}

        {view === 'profile' && (
          <div className="h-full p-6 bg-gray-900 overflow-y-auto">
             <button onClick={() => setView('chat_list')} className="mb-4 text-blue-400 flex items-center"><ArrowLeft size={20} className="mr-2"/> Back</button>
             <div className="flex flex-col items-center mb-8">
                <img src={user.avatarUrl} className="w-24 h-24 rounded-full border-4 border-gray-800" />
                <h2 className="text-2xl font-bold mt-4">{user.nickname}</h2>
                
                <div className="flex items-center mt-2 bg-gray-800 px-4 py-2 rounded-full border border-gray-700">
                  <span className="text-gray-400 text-sm font-mono mr-2">{user.id}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(user.id)} 
                    className="text-blue-400 hover:text-white"
                    title="Copy ID"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Share this ID to let others find you.</p>
             </div>
             
             <div className="space-y-4">
                <div className="bg-gray-800 p-4 rounded-xl flex items-center">
                   <Globe className="text-gray-400 mr-3" />
                   <div className="flex-1">
                      <div className="text-sm text-gray-300">App Language</div>
                      <div className="text-white font-bold">{user.language}</div>
                   </div>
                </div>
                
                <div className="mt-8 pt-8 border-t border-gray-800">
                   <button 
                    onClick={() => { localStorage.clear(); window.location.reload(); }}
                    className="w-full py-3 bg-red-500/20 text-red-400 rounded-xl font-bold"
                   >
                     Reset ID & Clear All Data
                   </button>
                </div>
             </div>
          </div>
        )}

        {view === 'chat_room' && activeChat && (
          <ChatRoom 
            chat={activeChat} 
            currentUser={user} 
            onSendMessage={handleSendMessage}
            onDeleteMessage={(msgId) => {
               setChats(prev => prev.map(c => {
                  if(c.id === activeChat.id) {
                     return { ...c, messages: c.messages.filter(m => m.id !== msgId) };
                  }
                  return c;
               }));
            }} 
          />
        )}

      </div>

      {/* Bottom Nav */}
      {!(['chat_room', 'profile', 'select_contact'] as ScreenView[]).includes(view) && (
        <div className="h-16 bg-gray-900 border-t border-gray-800 flex items-center justify-around fixed bottom-0 w-full z-30">
          <button onClick={() => setView('chat_list')} className={`flex flex-col items-center ${view === 'chat_list' ? 'text-blue-500' : 'text-gray-500'}`}>
            <MessageCircle size={24} />
            <span className="text-[10px] mt-1">Chats</span>
          </button>
          <button onClick={() => setView('channels')} className={`flex flex-col items-center ${view === 'channels' ? 'text-blue-500' : 'text-gray-500'}`}>
            <Users size={24} />
            <span className="text-[10px] mt-1">Channels</span>
          </button>
          <button onClick={() => setView('profile')} className={`flex flex-col items-center ${view === 'profile' ? 'text-blue-500' : 'text-gray-500'}`}>
            <Settings size={24} />
            <span className="text-[10px] mt-1">Profile</span>
          </button>
        </div>
      )}
    </div>
  );
}

// --- Chat Room Component ---

interface ChatRoomProps {
  chat: Chat;
  currentUser: User;
  onSendMessage: (txt: string, type?: MessageType) => void;
  onDeleteMessage: (id: string) => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ 
  chat, 
  currentUser, 
  onSendMessage,
  onDeleteMessage
}) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text);
      setText('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       let type = MessageType.TEXT;
       if (file.type.startsWith('image')) type = MessageType.IMAGE;
       else if (file.type.startsWith('video')) type = MessageType.VIDEO;
       else if (file.type.startsWith('audio')) type = MessageType.AUDIO;

       const url = URL.createObjectURL(file);
       onSendMessage(url, type);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-900">
       {/* Messages List */}
       <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {chat.messages.map(msg => (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              isMe={msg.senderId === currentUser.id}
              targetLang={currentUser.language}
              onDelete={() => onDeleteMessage(msg.id)}
            />
          ))}
          <div ref={messagesEndRef} />
       </div>

       {/* Input Area */}
       <div className="bg-gray-800 p-3 flex items-end space-x-2 border-t border-gray-700">
          <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-blue-400">
            <Paperclip size={24} />
          </button>
          <input 
             type="file" 
             ref={fileInputRef} 
             hidden 
             onChange={handleFileUpload} 
             accept="image/*,video/*,audio/*"
          />
          
          <div className="flex-1 bg-gray-700 rounded-2xl flex items-center px-4 py-2 min-h-[50px]">
             <input 
               type="text" 
               value={text}
               onChange={(e) => setText(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               className="bg-transparent flex-1 outline-none text-white placeholder-gray-400"
               placeholder="Message..."
             />
             <button className="text-gray-400 hover:text-yellow-400 ml-2">
               <Smile size={24} />
             </button>
          </div>

          <button 
            onClick={handleSend}
            disabled={!text.trim()}
            className={`p-3 rounded-full ${text.trim() ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500'} transition-all shadow-lg`}
          >
            <Send size={24} />
          </button>
       </div>
    </div>
  );
};

// --- Message Bubble with Translation ---

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  targetLang: string;
  onDelete: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, targetLang, onDelete }) => {
  const [translatedText, setTranslatedText] = useState<string | null>(message.translatedContent || null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleTranslate = async () => {
    if (message.type !== MessageType.TEXT) return;
    if (translatedText) {
       setTranslatedText(null);
       return;
    }
    
    setIsTranslating(true);
    const result = await translateMessage(message.content, targetLang);
    setTranslatedText(result);
    setIsTranslating(false);
  };

  return (
    <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`relative max-w-[80%] p-3 rounded-2xl group ${
          isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-700 text-white rounded-bl-none'
        }`}
        onClick={() => setShowMenu(!showMenu)}
      >
        {message.type === MessageType.IMAGE && (
          <img src={message.content} className="rounded-lg max-h-60 object-cover mb-1" />
        )}
        {message.type === MessageType.VIDEO && (
          <video src={message.content} controls className="rounded-lg max-h-60 bg-black mb-1" />
        )}
        {message.type === MessageType.AUDIO && (
          <div className="flex items-center space-x-2 bg-gray-800/50 p-2 rounded-lg mb-1 min-w-[150px]">
             <Music size={20} />
             <div className="h-1 flex-1 bg-gray-500 rounded"></div>
          </div>
        )}

        {message.type === MessageType.TEXT && (
          <div className="text-sm md:text-base leading-relaxed">
            {message.content}
          </div>
        )}

        {translatedText && (
          <div className="mt-2 pt-2 border-t border-white/20 text-sm text-yellow-200 italic animate-in fade-in">
            <span className="text-[10px] uppercase font-bold text-yellow-500/80 mr-2">Translated:</span>
            {translatedText}
          </div>
        )}

        <div className="flex justify-between items-center mt-1 space-x-2">
           <span className={`text-[10px] opacity-70`}>
             {new Date(message.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
           </span>
           {isMe && <Check size={12} className="opacity-70" />}
        </div>

        {showMenu && (
          <div className="absolute -bottom-10 z-10 flex bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
             {!isMe && message.type === MessageType.TEXT && (
               <button 
                 onClick={(e) => { e.stopPropagation(); handleTranslate(); setShowMenu(false); }}
                 className="p-2 hover:bg-gray-700 text-blue-400"
                 title="Translate"
               >
                 {isTranslating ? '...' : <Globe size={16} />}
               </button>
             )}
             {isMe && (
               <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-2 hover:bg-gray-700 text-red-400"
               >
                  <Trash2 size={16} />
               </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

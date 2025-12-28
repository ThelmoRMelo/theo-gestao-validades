import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatList from '@/components/chat/ChatList';
import ChatRoom from '@/components/chat/ChatRoom';
import UserSelect from '@/components/chat/UserSelect';
import { GLOBAL_CONVERSATION_ID } from '@/lib/chatDb';
import * as chatSync from '@/lib/chatSync';

type View = 'list' | 'room' | 'select-user';

const ChatGlobal = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('list');
  const [currentConversation, setCurrentConversation] = useState<{
    id: string;
    type: 'global' | 'private';
    title: string;
  } | null>(null);

  useEffect(() => {
    // Baixar dados do cloud ao abrir
    chatSync.downloadChatFromCloud();
  }, []);

  const handleSelectConversation = (id: string, type: 'global' | 'private', title: string) => {
    setCurrentConversation({ id, type, title });
    setView('room');
  };

  const handleCreatePrivate = () => {
    setView('select-user');
  };

  const handleUserSelected = (conversationId: string, userName: string) => {
    setCurrentConversation({
      id: conversationId,
      type: 'private',
      title: userName,
    });
    setView('room');
  };

  const handleBack = () => {
    if (view === 'room' || view === 'select-user') {
      setView('list');
      setCurrentConversation(null);
    } else {
      navigate('/');
    }
  };

  if (view === 'select-user') {
    return (
      <UserSelect
        onSelect={handleUserSelected}
        onBack={handleBack}
      />
    );
  }

  if (view === 'room' && currentConversation) {
    return (
      <ChatRoom
        conversationId={currentConversation.id}
        conversationType={currentConversation.type}
        title={currentConversation.title}
        onBack={handleBack}
      />
    );
  }

  return (
    <ChatList
      onSelectConversation={handleSelectConversation}
      onCreatePrivate={handleCreatePrivate}
    />
  );
};

export default ChatGlobal;

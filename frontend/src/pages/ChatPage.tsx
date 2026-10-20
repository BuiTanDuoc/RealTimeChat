import { ChatProvider } from '../context/ChatContext';
import ChatWindow from '../components/ChatWindow';
import Sidebar from '../components/Sidebar';

export default function ChatPage() {
  return (
    <ChatProvider>
      <div className="flex h-full overflow-hidden">
        <Sidebar />
        <ChatWindow />
      </div>
    </ChatProvider>
  );
}

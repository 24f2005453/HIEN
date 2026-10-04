import React, { useState } from "react";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { useApp } from "../context/AppContext";
import { ConversationList } from "../components/messages/ConversationList";
import { ChatWindow } from "../components/messages/ChatWindow";

export const MessagesView: React.FC = () => {
  const { conversations, activeConversationId, setActiveConversationId, activeConversation } = useApp();
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(!!activeConversationId);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setMobileShowChat(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <div className="h-[calc(100vh-140px)] min-h-[500px] max-h-[700px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12">
        {/* Left Column: Conversation List */}
        <div
          className={`md:col-span-5 lg:col-span-4 border-r border-slate-200 flex flex-col bg-white ${
            mobileShowChat ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Inquiries</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">
              {conversations.length} active
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={handleSelectConversation}
            />
          </div>
        </div>

        {/* Right Column: Chat Window */}
        <div
          className={`md:col-span-7 lg:col-span-8 flex flex-col h-full bg-white ${
            !mobileShowChat ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Mobile Back Button */}
          <div className="md:hidden p-2.5 bg-white border-b border-slate-200">
            <button
              onClick={() => setMobileShowChat(false)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Conversations</span>
            </button>
          </div>

          {activeConversation ? (
            <ChatWindow conversation={activeConversation} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 text-slate-300 mb-2" />
              <h3 className="font-semibold text-sm text-slate-700 mb-0.5">Select an inquiry</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Choose a conversation from the left to coordinate product inspection or pickup.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

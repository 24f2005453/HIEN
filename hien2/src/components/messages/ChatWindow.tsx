import React, { useState, useRef, useEffect } from "react";
import { Phone, Send, Store, User, ShoppingBag, CheckCheck } from "lucide-react";
import { Conversation } from "../../types";
import { useApp } from "../../context/AppContext";

interface Props {
  conversation: Conversation;
}

export const ChatWindow: React.FC<Props> = ({ conversation }) => {
  const { role, user, sendMessage, startMockCall } = useApp();
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(conversation.id, inputText);
    setInputText("");
  };

  const handlePhoneClick = () => {
    if (role === "buyer") {
      startMockCall({
        name: conversation.accessPointName,
        subtitle: `Access Point ${conversation.accessPointCode}`,
        role: "manager",
        accessPointCode: conversation.accessPointCode,
        phone: "+91 98401 23456"
      });
    } else {
      startMockCall({
        name: conversation.buyerName,
        subtitle: `Buyer for ${conversation.productName}`,
        role: "buyer",
        phone: "+91 98405 99887"
      });
    }
  };

  const otherPartyTitle =
    role === "manager" ? conversation.buyerName : conversation.accessPointName;
  const otherPartySub =
    role === "manager"
      ? `Buyer · ${conversation.productName}`
      : `${conversation.accessPointCode} · Verified Partner`;

  return (
    <div className="flex flex-col h-full bg-white text-slate-900">
      {/* Header (Section 35: Express Electronics, AP #04, ● Online, Phone button) */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold">
            {role === "manager" ? (
              <User className="w-5 h-5 text-slate-600" />
            ) : (
              <Store className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900">{otherPartyTitle}</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
            </div>
            <p className="text-xs text-slate-500 font-mono">{otherPartySub}</p>
          </div>
        </div>

        <button
          onClick={handlePhoneClick}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Phone className="w-3.5 h-3.5 text-emerald-600" />
          <span>Phone</span>
        </button>
      </div>

      {/* Product Reference Strip */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-1.5 truncate">
          <ShoppingBag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-500">Item:</span>
          <span className="font-semibold text-slate-800 truncate">{conversation.productName}</span>
        </div>
        <span className="font-mono text-[11px] text-emerald-700 font-medium shrink-0">
          Open Box Hold
        </span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F6F8FB]">
        {conversation.messages.map((msg) => {
          const isMe = msg.senderRole === role || msg.senderId === user.id;
          const isSystem = msg.senderId === "system";

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center my-2">
                <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-slate-200/80 text-slate-600">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <span className="text-[10px] text-slate-400 font-medium mb-0.5 px-1">
                {msg.senderName}
              </span>
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                  isMe
                    ? "bg-slate-900 text-white rounded-tr-xs"
                    : "bg-white text-slate-800 border border-slate-200 rounded-tl-xs"
                }`}
              >
                <p>{msg.text}</p>
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                    isMe ? "text-slate-400" : "text-slate-400"
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {isMe && <CheckCheck className="w-3 h-3 text-emerald-400" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer (Section 35: Type a message... Send button) */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors cursor-pointer shadow-xs"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

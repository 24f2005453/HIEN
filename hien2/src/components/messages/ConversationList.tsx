import React from "react";
import { MessageSquare, Store, User, ShoppingBag } from "lucide-react";
import { Conversation } from "../../types";
import { useApp } from "../../context/AppContext";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export const ConversationList: React.FC<Props> = ({ conversations, activeId, onSelect }) => {
  const { role } = useApp();

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400">
        <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-xs font-semibold text-slate-700">No conversations yet</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Inquiries on reserved items will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 overflow-y-auto">
      {conversations.map((conv) => {
        const isActive = conv.id === activeId;
        const otherPartyName = role === "manager" ? conv.buyerName : conv.accessPointName;

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full p-3.5 text-left transition-colors flex items-start gap-3 cursor-pointer ${
              isActive ? "bg-slate-50 border-l-3 border-emerald-600" : "hover:bg-slate-50/80"
            }`}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                {role === "manager" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Store className="w-4 h-4 text-emerald-600" />
                )}
              </div>
              {conv.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </div>

            {/* Conversation text (Section 35: Express Electronics, AP #04, Nike Air Zoom, snippet, 2 min) */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <h4 className="text-xs font-bold text-slate-900 truncate">{otherPartyName}</h4>
                <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                  {conv.lastMessageTime}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium mb-0.5">
                <ShoppingBag className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{conv.productName}</span>
              </div>

              <p className="text-[11px] text-slate-500 truncate line-clamp-1">
                {conv.lastMessageSnippet}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

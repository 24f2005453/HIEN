import { Conversation, Message, UserRole } from "../types";

export class MessageService {
  public static createNewMessage(
    senderId: string,
    senderRole: UserRole,
    senderName: string,
    text: string
  ): Message {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId,
      senderRole,
      senderName,
      text,
      timestamp: timeStr
    };
  }

  public static findOrCreateConversation(
    conversations: Conversation[],
    buyerId: string,
    buyerName: string,
    accessPointId: string,
    accessPointName: string,
    accessPointCode: string,
    productId: string,
    productName: string,
    productImageUrl?: string
  ): { conversation: Conversation; isNew: boolean } {
    const existing = conversations.find(
      (c) => c.productId === productId && (c.buyerId === buyerId || c.accessPointId === accessPointId)
    );

    if (existing) {
      return { conversation: existing, isNew: false };
    }

    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      buyerId,
      buyerName,
      accessPointId,
      accessPointName,
      accessPointCode,
      productId,
      productName,
      productImageUrl,
      lastMessageSnippet: "Conversation started",
      lastMessageTime: "Just now",
      unreadCount: 0,
      messages: [
        {
          id: `msg-${Date.now()}`,
          senderId: "system",
          senderRole: "manager",
          senderName: "HIEN System",
          text: `Inquiry opened regarding ${productName} (Pickup at ${accessPointName}, ${accessPointCode}).`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]
    };

    return { conversation: newConv, isNew: true };
  }
}

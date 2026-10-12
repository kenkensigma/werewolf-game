import { useState, useRef, useEffect } from "react";
import "./DiscussionChat.css";

export function DiscussionChat({
  messages = [],
  currentUserId,
  isAlive = true,
  onSendMessage,
}) {
  const [inputText, setInputText] = useState("");
  const listEndRef = useRef(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText || !isAlive) return;

    onSendMessage(cleanText);
    setInputText("");
  };

  return (
    <div className="discussion-chat-card" role="region" aria-label="Village Deliberation Chat">
      <div className="chat-header">
        <h3 className="chat-title">Deliberation Scroll</h3>
        <span className="chat-timestamp">{messages.length} utterances</span>
      </div>

      <ul className="chat-message-list" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <li className="chat-empty-state">
            The hall is quiet. Break the silence and share your suspicions.
          </li>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <li
                key={msg.id}
                className={`chat-bubble-item ${isSelf ? "is-self" : ""}`}
              >
                <div className="chat-sender-row">
                  <span className="chat-sender-name">{msg.senderName}</span>
                  <span className="chat-timestamp">{timeStr}</span>
                </div>
                <div className="chat-message-bubble">{msg.text}</div>
              </li>
            );
          })
        )}
        <div ref={listEndRef} />
      </ul>

      {isAlive ? (
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="form-input chat-text-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Voice your suspicion..."
            maxLength={300}
            aria-label="Discussion message text"
          />
          <button
            type="submit"
            className="btn-primary chat-send-btn"
            disabled={!inputText.trim()}
          >
            Speak
          </button>
        </form>
      ) : (
        <div className="chat-disabled-notice" role="alert">
          The departed cannot participate in village deliberation.
        </div>
      )}
    </div>
  );
}

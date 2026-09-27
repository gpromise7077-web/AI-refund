"use client";

import { useState } from "react";
import { FaArrowUp } from "react-icons/fa";
import { SiChatbot } from "react-icons/si";

interface ChatMessage {
  Text: string;
  sender: "user" | "bot";
}

export default function Home() {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  async function sendMessage() {
    if (input === "") return;

    const userText = input;
    setChat((prev) => [...prev, { Text: userText, sender: "user" }]);
    setInput("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userText,
      }),
    });

    const data = await res.json();
    setChat((prev) => [...prev, { Text: data.message, sender: "bot" }]);
  }

  return (
    <div className="flex flex-col items-center w-full h-screen">
      <div className="flex items-center bg-blue-600 w-full justify-center p-5 gap-3">
        <SiChatbot size={50} className="text-white" />
        <h1 className="text-2xl font-extrabold text-white">
          AI Refund Assistant
        </h1>
      </div>

      <div className="bg-[azure] w-full flex-1 flex flex-col p-4 overflow-y-auto">
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {chat.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <p
                className={`px-4 py-2 rounded-lg max-w-xs ${
                  msg.sender === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-black"
                }`}
              >
                {msg.Text}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <input
            type="text"
            value={input}
            placeholder="Type your message..."
            className="flex-1 border rounded px-3 py-2 bg-[black]"
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 text-white p-2 rounded"
          >
            <FaArrowUp size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

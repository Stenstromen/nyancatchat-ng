/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { decrypt, encrypt, generateKey } from "@/utils/crypto";
import { decryptRoomKey, generateShareableLink } from "@/utils/sharing";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import UsernameModal from "./UsernameModal";
import Image from "next/image";
import { socket } from "@/socket";

interface Message {
  user: string;
  text: string;
  date: string;
}

interface TypingSignal {
  user: string;
}

export default function Chat() {
  const AVAILABLE_ROOMS = ["KittyRoom", "NyanRoom", "DogerRoom", "PusheenRoom"];
  const AVAILABLE_NAMES = [
    "Pusheen",
    "Doland",
    "Gooby",
    "NyanCat",
    "Doge",
    "Stormy",
    "Pip",
    "Sunflower",
    "Biscuit",
    "Vilde",
    "Pussel",
    "Malin",
    "Laban",
    "Prinsessan",
    "Musse",
  ];
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");
  const token = searchParams.get("token");
  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState(roomParam || AVAILABLE_ROOMS[0]);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingSignal[]>([]);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [urlJoinPending, setUrlJoinPending] = useState(false);
  const pendingRoomRef = useRef<string | null>(null);
  const [shareLink, setShareLink] = useState<string>("");
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isItalic, setIsItalic] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);

  const addItalics = () => {
    document.execCommand('italic', false);
    setIsItalic(!isItalic);
    editorRef.current?.focus();
  };

  const addBold = () => {
    document.execCommand('bold', false);
    setIsBold(!isBold);
    editorRef.current?.focus();
  };

  const addUnderline = () => {
    document.execCommand('underline', false);
    setIsUnderline(!isUnderline);
    editorRef.current?.focus();
  };

  const addStrike = () => {
    document.execCommand('strikeThrough', false);
    setIsStrike(!isStrike);
    editorRef.current?.focus();
  };

  useEffect(() => {
    if (!socket) return;

    socket.on("message", async (message: Message) => {
      const decryptedMessage = await decrypt(message.text);
      setMessages((prev) => [...prev, { ...message, text: decryptedMessage }]);
    });

    socket.on("messages", async (data: { messages: Message[] }) => {
      const decryptedMessages = await Promise.all(
        data.messages.map(async (msg: Message) => ({
          ...msg,
          text: await decrypt(msg.text),
        }))
      );
      setMessages(decryptedMessages);
    });

    socket.on("message-echo", async (message: Message) => {
      const decryptedMessage = await decrypt(message.text);
      setMessages((prev) => [...prev, { ...message, text: decryptedMessage }]);
    });

    socket.on("server_message", (message: string) => {
      setMessages((prev) => [
        ...prev,
        { user: "System", text: message, date: new Date().toISOString() },
      ]);
    });

    socket.on("typing", (user: TypingSignal) => {
      setTypingUsers((prev) => {
        if (!prev.some((u) => u.user === user.user)) {
          return [...prev, { user: user.user }];
        }
        return prev;
      });
    });

    socket.on("stop_typing", (user: TypingSignal) => {
      setTypingUsers((prev) => prev.filter((u) => u.user !== user.user));
    });

    return () => {
      socket.off("messages");
      socket.off("message");
      socket.off("server_message");
      socket.off("typing");
      socket.off("stop_typing");
    };
  }, [socket]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateRoomSuffix = () => {
    return (
      "-" +
      Math.floor(Math.random() * 0xffff)
        .toString(16)
        .padStart(4, "0")
    );
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseRoom = room.split("-")[0];

    if (!AVAILABLE_ROOMS.includes(baseRoom)) {
      setMessages((prev) => [
        ...prev,
        {
          user: "System",
          text: "Invalid room. Please select from: kittyroom, nyanroom, dogeroom, or pusheenroom",
          date: new Date().toISOString(),
        },
      ]);
      return;
    }

    if (socket && room && name) {
      const roomWithSuffix = baseRoom + generateRoomSuffix();
      setRoom(roomWithSuffix);

      const currentKey = window.sessionStorage.getItem("ENCRYPTION_KEY");
      const key = currentKey || generateKey();

      if (!currentKey) {
        window.sessionStorage.setItem("ENCRYPTION_KEY", key);
      }

      try {
        const shareUrl = await generateShareableLink(roomWithSuffix, key);
        setShareLink(shareUrl);
      } catch (error) {
        console.error("Failed to generate share link:", error);
      }

      socket.emit("join", {
        room: roomWithSuffix,
        user: name,
      });
      setJoined(true);
    }
  };

  const handleLeave = () => {
    if (socket && room) {
      socket.emit("leave", { room: room });
      setJoined(false);
      setRoom("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editorRef.current?.textContent?.trim()) return;

    const html = editorRef.current.innerHTML;
    const encryptedHtml = await encrypt(html);

    if (socket) {
      socket.emit("message", {
        text: encryptedHtml,
      });
      editorRef.current.innerHTML = "";
    }
  };

  let typingTimeout: NodeJS.Timeout;
  const handleTyping = () => {
    if (socket) {
      socket.emit("typing", {
        user: name,
      });

      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      typingTimeout = setTimeout(() => {
        socket.emit("stop_typing", {
          user: name,
        });
      }, 2000);
    }
  };

  useEffect(() => {
    if (roomParam && token) {
      pendingRoomRef.current = roomParam;

      decryptRoomKey(token)
        .then((key) => {
          window.sessionStorage.setItem("ENCRYPTION_KEY", key);
          setShowUsernameModal(true);
          setUrlJoinPending(true);
        })
        .catch((error) => {
          console.error("Failed to decrypt room key:", error);
        });
    } else {
      const randomIndex = Math.floor(Math.random() * AVAILABLE_ROOMS.length);
      setRoom(AVAILABLE_ROOMS[randomIndex]);
      const randomNameIndex = Math.floor(
        Math.random() * AVAILABLE_NAMES.length
      );
      setName(AVAILABLE_NAMES[randomNameIndex]);
    }
  }, [roomParam, token]);

  const handleUsernameSubmit = (username: string) => {
    setName(username);
    setShowUsernameModal(false);

    if (urlJoinPending && socket && pendingRoomRef.current) {
      socket.emit("join", {
        room: pendingRoomRef.current,
        user: username,
      });
      setJoined(true);
      setUrlJoinPending(false);
    }
  };

  const handleCopyClick = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyConfirmed(true);
      setTimeout(() => setCopyConfirmed(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'i':
          e.preventDefault();
          addItalics();
          break;
        case 'b':
          e.preventDefault();
          addBold();
          break;
        case 'u':
          e.preventDefault();
          addUnderline();
          break;
      }
    }
  };

  return (
    <div className="fixed inset-0 md:static md:h-[calc(100vh-80px)] max-w-4xl md:max-w-md md:mx-auto flex flex-col bg-deep-blue h-[100dvh]">
      <UsernameModal
        isOpen={showUsernameModal}
        onSubmit={handleUsernameSubmit}
      />

      {!joined ? (
        <form onSubmit={handleJoin} className="space-y-4 p-4">
          <div className="space-y-2">
            <div className="relative w-full h-28">
              <Image
                src="/nyan.gif"
                alt="NyanCat"
                fill
                className="object-cover"
              />
            </div>
            <label className="block text-white text-lg font-medium mb-2">
              Room
            </label>
            <div className="grid grid-cols-1 gap-4">
              {AVAILABLE_ROOMS.map((roomOption) => (
                <label
                  key={roomOption}
                  className={`flex items-center p-3 rounded border cursor-pointer transition-colors
                    ${
                      room === roomOption
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-gray-700 border-gray-600 text-white hover:bg-gray-650"
                    }`}
                >
                  <input
                    type="radio"
                    name="room"
                    value={roomOption}
                    checked={room === roomOption}
                    onChange={(e) => setRoom(e.target.value)}
                    className="hidden"
                  />
                  <span className="text-white">{roomOption}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-white text-lg font-medium mb-2">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-2 pr-8 border rounded bg-gray-700 text-white border-gray-600"
              />
              {name && (
                <button
                  onClick={() => setName("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded transition"
          >
            Join Room
          </button>
        </form>
      ) : (
        <div className="flex flex-col h-[100dvh] md:h-full md:w-[1000px] md:-ml-[308px] bg-deep-blue md:rounded-lg overflow-hidden">
          <div className="bg-gray-900 p-4 shadow flex justify-between items-center w-full md:rounded-t-lg">
            <div className="flex items-center gap-4 flex-1">
              <h2 className="text-base md:text-xl font-bold text-white">
                #{room}
              </h2>
              {shareLink && (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="hidden md:flex flex-1 p-2 text-sm bg-gray-700 text-white rounded border border-gray-600"
                  />
                  <button
                    onClick={handleCopyClick}
                    className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded transition text-sm flex items-center gap-1"
                  >
                    {copyConfirmed ? (
                      <>
                        <span className="animate-fadeIn">✅</span>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <span>🔗</span>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleLeave}
              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded transition ml-4 text-sm flex items-center gap-1"
            >
              <span>🔥</span>
              <span>Leave</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-[80px] md:pb-4 space-y-4 bg-gray-800">
            {messages.map((msg, i) => (
              <div key={i} className="flex items-start gap-4">
                {msg.user === "System" ? (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
                    <Image
                      src="/nyan.gif"
                      alt="System"
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center text-white font-bold">
                    {msg.user[0]}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-indigo-400">
                      {msg.user}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.date).toLocaleTimeString()}
                    </span>
                  </div>
                  <p 
                    className="text-gray-100 mt-1"
                    dangerouslySetInnerHTML={{ __html: msg.text }}
                  />
                </div>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>

          <div className="fixed md:static bottom-0 left-0 right-0 p-4 pb-safe bg-gray-750 w-full md:rounded-b-lg">
            {typingUsers.length > 0 && (
              <div className="absolute -top-6 left-4 text-gray-400 text-sm flex items-center gap-1">
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
                </div>
                <span>
                  {typingUsers.map((user) => user.user).join(", ")}{" "}
                  {typingUsers.length === 1 ? "is" : "are"} typing
                </span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <div className="flex gap-1 bg-gray-800 p-1 rounded-t-md">
                <button
                  type="button"
                  onClick={addBold}
                  className={`p-2 md:p-1 text-lg md:text-base hover:bg-gray-700 rounded text-white ${
                    isBold ? 'bg-gray-600' : ''
                  }`}
                  title="Bold (Ctrl+B)"
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={addItalics}
                  className={`p-2 md:p-1 text-lg md:text-base hover:bg-gray-700 rounded text-white ${
                    isItalic ? 'bg-gray-600' : ''
                  }`}
                  title="Italic (Ctrl+I)"
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  onClick={addUnderline}
                  className={`p-2 md:p-1 text-lg md:text-base hover:bg-gray-700 rounded text-white ${
                    isUnderline ? 'bg-gray-600' : ''
                  }`}
                  title="Underline (Ctrl+U)"
                >
                  <u>U</u>
                </button>
                <button
                  type="button"
                  onClick={addStrike}
                  className={`p-2 md:p-1 text-lg md:text-base hover:bg-gray-700 rounded text-white ${
                    isStrike ? 'bg-gray-600' : ''
                  }`}
                  title="Strikethrough"
                >
                  <s>S</s>
                </button>
              </div>
              <div className="flex gap-2">
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={handleTyping}
                  onKeyDown={handleKeyPress}
                  className="flex-1 p-3 rounded-md bg-gray-700 text-white border-none focus:ring-2 focus:ring-indigo-500 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-500"
                  role="textbox"
                  data-placeholder="Type your message..."
                  aria-multiline="true"
                />
                <button
                  type="submit"
                  className="p-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

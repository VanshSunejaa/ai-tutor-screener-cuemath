type Props = {
  role: "assistant" | "user";
  text: string;
};

export function ChatBubble({ role, text }: Props) {
  const isUser = role === "user";
  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
          isUser
            ? "bg-zinc-900 text-white rounded-br-md"
            : "bg-white text-zinc-900 border border-zinc-200 rounded-bl-md",
        ].join(" ")}
      >
        <div className="whitespace-pre-wrap">{text}</div>
      </div>
    </div>
  );
}


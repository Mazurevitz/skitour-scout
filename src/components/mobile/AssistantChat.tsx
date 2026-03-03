/**
 * Assistant Chat Component
 *
 * Conversational interface for the ski touring trip planning assistant.
 * Uses RAG to provide context-aware responses based on historical reports
 * and current conditions.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User, Sparkles, AlertCircle, Info } from 'lucide-react';
import {
  sendMessage,
  SUGGESTION_QUERIES,
  WELCOME_MESSAGE,
  type ChatMessage,
  type CurrentConditions,
} from '@/services/assistant';

interface AssistantChatProps {
  region: string;
  currentConditions?: CurrentConditions;
}

export function AssistantChat({ region, currentConditions }: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }, []);

  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    setError(null);
    setInput('');

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { response, error: apiError } = await sendMessage(
        text,
        messages,
        {
          region: region === 'Wszystkie' ? undefined : region,
          currentConditions,
        }
      );

      if (apiError) {
        setError(apiError);
        // Add error message from assistant
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Przepraszam, nie udało się przetworzyć zapytania. Spróbuj ponownie.',
            timestamp: new Date(),
          },
        ]);
      } else if (response) {
        setMessages((prev) => [...prev, response]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, region, currentConditions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleSuggestionClick = useCallback((query: string) => {
    handleSend(query);
  }, [handleSend]);

  // Show suggestions only after welcome message
  const showSuggestions = messages.length === 1 && messages[0] === WELCOME_MESSAGE;

  return (
    <div className="flex flex-col h-full">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-800 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Myślę...</span>
              </div>
            </div>
          </div>
        )}

        {/* Suggestion chips */}
        {showSuggestions && !isLoading && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTION_QUERIES.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion.query)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-full text-sm text-gray-300 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2 text-sm text-red-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-800 pt-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Napisz wiadomość..."
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none min-h-[48px] max-h-[120px]"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* Context indicator */}
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <Info className="w-3 h-3" />
          <span>
            Region: {region === 'Wszystkie' ? 'Wszystkie regiony' : region}
            {currentConditions?.avalancheLevel && ` • Stopień ${currentConditions.avalancheLevel}`}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Message bubble component
 */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-green-600' : 'bg-blue-600'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message content */}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-none'
            : 'bg-gray-800 text-gray-100 rounded-tl-none'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Źródła ({message.sources.length}):</p>
            <div className="flex flex-wrap gap-1">
              {message.sources.slice(0, 3).map((source, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300"
                >
                  {source.type === 'community' && 'Społeczność'}
                  {source.type === 'admin' && 'Zweryfikowany'}
                  {source.type === 'route' && 'Trasa'}
                  {source.location && `: ${source.location}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
          {message.timestamp.toLocaleTimeString('pl-PL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

/**
 * Componente de mensagem do chat.
 *
 * Exibe mensagens do usuário e do assistente com estilos diferentes.
 */
import { motion } from 'framer-motion';
import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponseRenderer } from './ResponseRenderer';
import type { AiMessage } from '@/types';

interface ChatMessageProps {
  message: AiMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex gap-3 rounded-lg p-4',
        isUser ? 'ml-8 bg-muted' : 'mr-8 border border-primary/10 bg-primary/5'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-muted-foreground/20' : 'bg-primary/20'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-sm font-medium">{isUser ? 'Você' : 'Assistente'}</div>

        {isUser ? (
          <p className="whitespace-pre-wrap text-foreground">{message.content}</p>
        ) : (
          <ResponseRenderer
            content={message.content}
            displayType={message.displayType || 'text'}
            data={message.data}
          />
        )}

        {/* Timestamp */}
        {message.timestamp && (
          <div className="mt-2 text-xs text-muted-foreground">
            {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

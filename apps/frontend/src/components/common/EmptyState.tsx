import { motion } from 'framer-motion';
import React from 'react';

import { emptyStateVariants } from '@/lib/animations';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
}

/**
 * Padrão do app para listas vazias: só ícone + rótulo, sem texto de apoio nem
 * botões, alinhado ao início do espaço livre da página (`page-fill`); dentro
 * de cards fica na altura natural (ver index.css).
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title }) => (
  <div data-empty-state className="page-fill flex flex-1 flex-col">
    <motion.div
      variants={emptyStateVariants}
      initial="initial"
      animate="animate"
      aria-label={title}
      className="gap-md bg-card/50 px-xl flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center"
    >
      {icon && (
        <div
          data-testid="icon-container"
          className="bg-primary/10 text-primary ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset [&>svg]:h-7 [&>svg]:w-7"
        >
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
    </motion.div>
  </div>
);

import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div 
    className={cn(
      "bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 md:p-6 overflow-hidden transition-all hover:border-zinc-700",
      className
    )} 
    {...props}
  >
    {children}
  </div>
);

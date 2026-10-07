import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Mescla classes e resolve conflitos do Tailwind
export function cn(...inputs) {
    return twMerge(clsx(inputs))
}

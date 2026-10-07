import { ref } from 'vue'

// Fila global de notificações
const toasts = ref([])
let toastCount = 0

export function useToast() {
    // Remove o toast pelo ID
    const remove = (id) => {
        toasts.value = toasts.value.filter((t) => t.id !== id)
    }

    // Adiciona o toast e agenda remoção
    const add = (options) => {
        const id = toastCount++
        toasts.value.push({ id, ...options })

        if (options.duration !== Infinity) {
            setTimeout(() => {
                remove(id)
            }, options.duration || 3000)
        }
    }

    return { toasts, remove, add }
}

// API imperativa para uso simplificado
export const toast = {
    default: (title, description = '', duration = 3000) =>
        useToast().add({ title, description, variant: 'default', duration }),
    success: (title, description = '', duration = 3000) =>
        useToast().add({ title, description, variant: 'success', duration }),
    error: (title, description = '', duration = 5000) =>
        useToast().add({ title, description, variant: 'destructive', duration }),
}

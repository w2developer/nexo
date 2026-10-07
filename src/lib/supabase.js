import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: (url, options) => {
            const token = sessionStorage.getItem('token_acesso')
            if (token) {
                if (!options.headers) {
                    options.headers = new Headers()
                }
                if (options.headers instanceof Headers) {
                    options.headers.set('Authorization', `Bearer ${token}`)
                } else {
                    options.headers = {
                        ...options.headers,
                        Authorization: `Bearer ${token}`,
                    }
                }
            }
            return fetch(url, options)
        },
    },
})

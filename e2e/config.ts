/** Порты e2e-прогона. Специально не совпадают с дев-серверами, чтобы прогон не цеплялся
 *  к процессу, с которым в этот момент работает человек. */
export const API_PORT = 3101
export const WEB_PORT = 4173
export const API_URL = `http://127.0.0.1:${API_PORT}`
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Chat from '../views/Chat.vue'
import Login from '../views/Login.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    { path: '/', name: 'chat', component: Chat },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) {
    await auth.check()
  }
  if (!auth.authed && to.path !== '/login') {
    return { path: '/login' }
  }
  if (auth.authed && to.path === '/login') {
    return { path: '/' }
  }
  return true
})

export default router
